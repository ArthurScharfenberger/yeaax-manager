import { z } from 'zod';

import type { PostFilters, Repositories } from '@/db/repositories';
import type { Clock } from '@/lib/clock';
import { AppError, toAppError } from '@/lib/errors';
import { createId } from '@/lib/ids';
import { POST_STATUS_LABELS } from '@/lib/labels';
import { PLATFORM_INFO } from '@/lib/platforms';
import {
  type Id,
  type Platform,
  type PlatformOptions,
  platformOptionsSchema,
  type Post,
  type PostHistoryEvent,
  type PostStatus,
  type PostWithRelations,
} from '@/types';
import { formatDateTime } from '@/utils/format';

import {
  canCancel,
  canDelete,
  canTransition,
  checkCaption,
  COMPOSER_STATUSES,
  DUPLICATE_GUARD_STATUSES,
  isEditable,
} from './postRules';
import {
  normalizeTikTokOptions,
  requiresPostOptions,
  TIKTOK_OPTION_ISSUE_MESSAGES,
  tiktokOptionIssues,
} from './tiktokOptionsRules';

export const postInputSchema = z.object({
  channelId: z.string().min(1, 'Selecione um canal.'),
  mediaId: z.string().min(1).nullable(),
  caption: z.string(),
  status: z.enum(COMPOSER_STATUSES),
  scheduledAt: z.iso.datetime({ error: 'Data de agendamento inválida.' }).nullable(),
  /** Escolhas da plataforma (TikTok: privacidade, interações, divulgação comercial). */
  platformOptions: platformOptionsSchema.nullable().default(null),
});

export type PostInput = z.input<typeof postInputSchema>;
type ValidPostInput = z.output<typeof postInputSchema>;

export interface DuplicateResult {
  created: Post[];
  failed: { channelId: Id; message: string }[];
}

interface PostServiceDeps {
  repositories: Pick<Repositories, 'posts' | 'postHistory' | 'channels' | 'media'>;
  clock: Clock;
}

function describeSchedule(iso: string | null): string {
  return iso ? formatDateTime(new Date(iso)) : 'sem data';
}

/** Casos de uso de posts. Toda alteração relevante gera uma entrada em `post_history`. */
export function createPostService({ repositories, clock }: PostServiceDeps) {
  const { posts, postHistory, channels, media } = repositories;

  async function record(
    postId: Id,
    event: PostHistoryEvent,
    extra: { fromStatus?: PostStatus; toStatus?: PostStatus; message?: string } = {},
  ): Promise<void> {
    await postHistory.insert({
      id: createId(),
      postId,
      event,
      fromStatus: extra.fromStatus ?? null,
      toStatus: extra.toStatus ?? null,
      message: extra.message ?? null,
      createdAt: clock.now().toISOString(),
    });
  }

  async function requirePost(id: Id): Promise<Post> {
    const post = await posts.getById(id);
    if (!post) throw new AppError('NOT_FOUND', 'Post não encontrado.');
    return post;
  }

  /** Validação compartilhada por criação e edição. */
  async function validate(input: PostInput, currentPostId?: Id): Promise<ValidPostInput> {
    const data = postInputSchema.parse(input);

    const channel = await channels.getById(data.channelId);
    if (!channel) throw new AppError('NOT_FOUND', 'Canal não encontrado.');
    const selectedMedia = data.mediaId ? await media.getById(data.mediaId) : null;
    if (data.mediaId && !selectedMedia) {
      throw new AppError('NOT_FOUND', 'Vídeo não encontrado na biblioteca.');
    }

    const caption = checkCaption(data.caption, channel.platform);
    const platformLabel = PLATFORM_INFO[channel.platform].label;
    if (caption.tooLong) {
      throw new AppError(
        'VALIDATION',
        `A legenda tem ${caption.length} caracteres; o limite do ${platformLabel} é ${caption.maxLength}.`,
      );
    }
    if (caption.tooManyHashtags) {
      throw new AppError(
        'VALIDATION',
        `O ${platformLabel} aceita no máximo ${caption.maxHashtags ?? 0} hashtags por post.`,
      );
    }
    if (caption.tooManyMentions) {
      throw new AppError(
        'VALIDATION',
        `O ${platformLabel} aceita no máximo ${caption.maxMentions ?? 0} menções (@) por post.`,
      );
    }

    if (data.status === 'scheduled') {
      if (!data.scheduledAt) {
        throw new AppError('VALIDATION', 'Defina data e horário para agendar.');
      }
      if (new Date(data.scheduledAt).getTime() <= clock.now().getTime()) {
        throw new AppError('SCHEDULE_IN_PAST', 'O horário de agendamento precisa estar no futuro.');
      }
      if (data.mediaId) {
        const duplicates = await posts.findByChannelAndMedia({
          channelId: data.channelId,
          mediaId: data.mediaId,
          statuses: DUPLICATE_GUARD_STATUSES,
          ...(currentPostId ? { excludePostId: currentPostId } : {}),
        });
        if (duplicates.length > 0) {
          throw new AppError(
            'DUPLICATE_POST',
            'Este vídeo já está agendado ou publicado neste canal.',
          );
        }
      }
    }

    return {
      ...data,
      caption: data.caption.trim(),
      platformOptions: resolvePlatformOptions(
        channel.platform,
        data.status,
        data.platformOptions,
        selectedMedia?.duration ?? null,
      ),
    };
  }

  /**
   * TikTok (DEC-029): agendar exige as escolhas das diretrizes (privacidade sem padrão, divulgação comercial
   * coerente, duração) e registra o consentimento do usuário (`consentedAt`) no momento em que ele confirma.
   * As regras que dependem da conta (opções de privacidade, interações bloqueadas) são checadas no compositor
   * com o `creator_info` e de novo na publicação.
   */
  function resolvePlatformOptions(
    platform: Platform,
    status: PostStatus,
    options: PlatformOptions | null,
    durationSeconds: number | null,
  ): PlatformOptions | null {
    if (!requiresPostOptions(platform)) return null;
    const tiktok = options?.platform === 'tiktok' ? options : null;
    if (status !== 'scheduled') {
      return tiktok ? normalizeTikTokOptions(tiktok, null) : null;
    }
    if (!tiktok) {
      throw new AppError(
        'VALIDATION',
        'Defina a privacidade e as opções do TikTok antes de agendar.',
      );
    }
    const issue = tiktokOptionIssues(tiktok, null, durationSeconds)[0];
    if (issue) throw new AppError('VALIDATION', TIKTOK_OPTION_ISSUE_MESSAGES[issue]);
    return normalizeTikTokOptions(tiktok, clock.now().toISOString());
  }

  async function createPost(input: PostInput, historyMessage?: string): Promise<Post> {
    const data = await validate(input);
    const now = clock.now().toISOString();
    const post: Post = {
      id: createId(),
      channelId: data.channelId,
      mediaId: data.mediaId,
      caption: data.caption,
      status: data.status,
      scheduledAt: data.scheduledAt,
      publishedAt: null,
      externalPostId: null,
      platformOptions: data.platformOptions,
      createdAt: now,
      updatedAt: now,
    };

    await posts.insert(post);
    await record(post.id, 'created', {
      toStatus: post.status,
      ...(historyMessage ? { message: historyMessage } : {}),
    });
    if (post.status === 'scheduled') {
      await record(post.id, 'scheduled', {
        message: `Agendado para ${describeSchedule(post.scheduledAt)}`,
      });
    }
    return post;
  }

  return {
    listDetailed: (filters?: PostFilters): Promise<PostWithRelations[]> =>
      posts.listDetailed(filters),

    async getDetailed(id: Id): Promise<PostWithRelations> {
      const post = await posts.getDetailed(id);
      if (!post) throw new AppError('NOT_FOUND', 'Post não encontrado.');
      return post;
    },

    getHistory: (id: Id) => postHistory.listByPost(id),

    /** `historyMessage` registra a origem do post (ex.: criado pela IA). */
    create: (input: PostInput, historyMessage?: string) => createPost(input, historyMessage),

    /**
     * Copia um post para outros canais como **rascunho** (mesmo vídeo, legenda e horário planejado).
     * Cada cópia ainda precisa ser revisada e confirmada pelo usuário antes de agendar (DEC-019).
     * Falhas por canal (ex.: legenda acima do limite da outra plataforma) não impedem as demais.
     */
    async duplicateToChannels(postId: Id, channelIds: readonly Id[]): Promise<DuplicateResult> {
      const source = await posts.getDetailed(postId);
      if (!source) throw new AppError('NOT_FOUND', 'Post não encontrado.');

      const result: DuplicateResult = { created: [], failed: [] };
      for (const channelId of channelIds) {
        if (channelId === source.channelId) continue;
        try {
          const copy = await createPost(
            {
              channelId,
              mediaId: source.mediaId,
              caption: source.caption,
              status: 'draft',
              scheduledAt: source.scheduledAt,
            },
            `Duplicado do post de @${source.channel.username} (${PLATFORM_INFO[source.channel.platform].label})`,
          );
          result.created.push(copy);
        } catch (error) {
          result.failed.push({ channelId, message: toAppError(error).message });
        }
      }
      return result;
    },

    async update(id: Id, input: PostInput): Promise<Post> {
      const current = await requirePost(id);
      if (!isEditable(current.status)) {
        throw new AppError(
          'NOT_EDITABLE',
          `Posts com status "${POST_STATUS_LABELS[current.status]}" não podem ser editados.`,
        );
      }
      if (!canTransition(current.status, input.status)) {
        throw new AppError(
          'INVALID_TRANSITION',
          `Não é possível mudar de "${POST_STATUS_LABELS[current.status]}" para "${POST_STATUS_LABELS[input.status]}".`,
        );
      }

      const data = await validate(input, id);
      const updated: Post = { ...current, ...data, updatedAt: clock.now().toISOString() };
      await posts.update(id, {
        channelId: updated.channelId,
        mediaId: updated.mediaId,
        caption: updated.caption,
        status: updated.status,
        scheduledAt: updated.scheduledAt,
        platformOptions: updated.platformOptions,
        updatedAt: updated.updatedAt,
      });

      await record(id, 'updated');
      if (current.status !== updated.status) {
        await record(id, updated.status === 'scheduled' ? 'scheduled' : 'status_changed', {
          fromStatus: current.status,
          toStatus: updated.status,
          ...(updated.status === 'scheduled'
            ? { message: `Agendado para ${describeSchedule(updated.scheduledAt)}` }
            : {}),
        });
      } else if (current.scheduledAt !== updated.scheduledAt) {
        await record(id, 'rescheduled', {
          message: `De ${describeSchedule(current.scheduledAt)} para ${describeSchedule(updated.scheduledAt)}`,
        });
      }
      return updated;
    },

    /** Muda apenas a data/hora (ex.: arrastar no calendário). O status não muda. */
    async reschedule(id: Id, scheduledAt: Date): Promise<Post> {
      const current = await requirePost(id);
      if (!isEditable(current.status)) {
        throw new AppError('NOT_EDITABLE', 'Este post não pode mais ser reagendado.');
      }
      if (current.status === 'scheduled' && scheduledAt.getTime() <= clock.now().getTime()) {
        throw new AppError('SCHEDULE_IN_PAST', 'Não é possível agendar para um horário passado.');
      }

      const updated: Post = {
        ...current,
        scheduledAt: scheduledAt.toISOString(),
        updatedAt: clock.now().toISOString(),
      };
      await posts.update(id, { scheduledAt: updated.scheduledAt, updatedAt: updated.updatedAt });
      await record(id, 'rescheduled', {
        message: `De ${describeSchedule(current.scheduledAt)} para ${describeSchedule(updated.scheduledAt)}`,
      });
      return updated;
    },

    async cancel(id: Id): Promise<void> {
      const current = await requirePost(id);
      if (!canCancel(current.status)) {
        throw new AppError('INVALID_TRANSITION', 'Este post não pode ser cancelado.');
      }
      await posts.update(id, { status: 'cancelled', updatedAt: clock.now().toISOString() });
      await record(id, 'cancelled', { fromStatus: current.status, toStatus: 'cancelled' });
    },

    async remove(id: Id): Promise<void> {
      const current = await requirePost(id);
      if (!canDelete(current.status)) {
        throw new AppError(
          'NOT_EDITABLE',
          'Apenas rascunhos, posts cancelados ou com falha podem ser excluídos.',
        );
      }
      await posts.delete(id);
    },
  };
}

export type PostService = ReturnType<typeof createPostService>;
