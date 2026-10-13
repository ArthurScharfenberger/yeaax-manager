import type { Repositories } from '@/db/repositories';
import { canStartPublishing } from '@/features/posts/postRules';
import {
  requiresPostOptions,
  TIKTOK_OPTION_ISSUE_MESSAGES,
  tiktokOptionIssues,
} from '@/features/posts/tiktokOptionsRules';
import type { Clock } from '@/lib/clock';
import { AppError, toAppError } from '@/lib/errors';
import { createId } from '@/lib/ids';
import { logger } from '@/lib/logger';
import { PLATFORM_INFO } from '@/lib/platforms';
import type { PublishProgress, SocialAccountRef, SocialProviderRegistry } from '@/services/social';
import type {
  Channel,
  Id,
  Media,
  PlatformOptions,
  Post,
  PostHistoryEvent,
  PostStatus,
} from '@/types';

/**
 * Agendados há mais tempo que isto (app fechado no horário) não são publicados sozinhos: ficam "atrasados" para o
 * usuário decidir (publicar agora ou reagendar) — publicar horas depois pode não ser o que ele queria.
 */
export const PUBLISH_GRACE_MINUTES = 15;

export const PROCESSING_NOTICE =
  'Vídeo enviado. Pode levar alguns minutos para o TikTok processar e ele aparecer no seu perfil.';

interface Deps {
  repositories: Pick<Repositories, 'posts' | 'postHistory' | 'channels' | 'media'>;
  social: SocialProviderRegistry;
  clock: Clock;
}

export interface PublishOptions {
  /**
   * `now`: o usuário acabou de confirmar no compositor (com a declaração visível) — o consentimento é registrado
   * agora. `stored`: publicação no horário, usando o consentimento registrado ao agendar.
   */
  consent: 'now' | 'stored';
  onProgress?: (progress: PublishProgress) => void;
}

export interface SchedulerResult {
  started: number;
  failed: number;
  completed: number;
}

function accountRef(channel: Channel): SocialAccountRef {
  return { channelId: channel.id, platform: channel.platform, username: channel.username };
}

/**
 * Publicação real (DEC-030): "Publicar agora", agendados no horário (app aberto) e acompanhamento do processamento.
 * O envio só acontece com consentimento registrado e escolhas válidas, revalidadas contra o `creator_info` atual.
 */
export function createPublishService({ repositories, social, clock }: Deps) {
  const { posts, postHistory, channels, media } = repositories;
  /** Posts com envio em andamento neste processo (evita duplo envio entre clique e agendador). */
  const inFlight = new Set<Id>();

  async function record(
    postId: Id,
    event: PostHistoryEvent,
    extra: { fromStatus?: PostStatus; toStatus?: PostStatus; message?: string } = {},
  ) {
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

  async function load(postId: Id): Promise<{ post: Post; channel: Channel; video: Media }> {
    const post = await posts.getById(postId);
    if (!post) throw new AppError('NOT_FOUND', 'Post não encontrado.');
    const channel = await channels.getById(post.channelId);
    if (!channel) throw new AppError('NOT_FOUND', 'Canal não encontrado.');
    const video = post.mediaId ? await media.getById(post.mediaId) : null;
    if (!video) throw new AppError('VALIDATION', 'Escolha um vídeo antes de publicar.');
    return { post, channel, video };
  }

  /** Confere tudo antes de enviar e devolve as escolhas com o consentimento a gravar. */
  async function prepare(
    post: Post,
    channel: Channel,
    video: Media,
    consent: PublishOptions['consent'],
  ): Promise<PlatformOptions | null> {
    const provider = social[channel.platform];
    const label = PLATFORM_INFO[channel.platform].label;
    if (!canStartPublishing(post.status)) {
      throw new AppError('INVALID_TRANSITION', 'Este post não pode ser publicado agora.');
    }
    if (!provider.capabilities.publishVideo) {
      throw new AppError(
        'NOT_AVAILABLE',
        `A publicação real no ${label} ainda não está disponível.`,
      );
    }
    if (channel.status !== 'connected') {
      throw new AppError('VALIDATION', `Conecte o canal do ${label} antes de publicar.`);
    }
    if (!requiresPostOptions(channel.platform)) return post.platformOptions;

    const options = post.platformOptions?.platform === 'tiktok' ? post.platformOptions : null;
    if (!options) {
      throw new AppError(
        'VALIDATION',
        'Defina a privacidade e as opções do TikTok antes de publicar.',
      );
    }
    if (consent === 'stored' && !options.consentedAt) {
      throw new AppError(
        'VALIDATION',
        'Não há consentimento registrado para este post. Abra e agende de novo.',
      );
    }
    // As diretrizes exigem consultar o creator_info antes de postar.
    const creator = provider.getCreatorInfo
      ? await provider.getCreatorInfo(accountRef(channel))
      : null;
    const issue = tiktokOptionIssues(options, creator, video.duration)[0];
    if (issue) throw new AppError('VALIDATION', TIKTOK_OPTION_ISSUE_MESSAGES[issue]);
    return consent === 'now' ? { ...options, consentedAt: clock.now().toISOString() } : options;
  }

  async function markFailed(post: Post, message: string) {
    await posts.update(post.id, { status: 'failed', updatedAt: clock.now().toISOString() });
    await record(post.id, 'failed', { fromStatus: post.status, toStatus: 'failed', message });
  }

  async function publishNow(postId: Id, options: PublishOptions): Promise<Post> {
    if (inFlight.has(postId)) {
      throw new AppError('CONFLICT', 'Este post já está sendo enviado.');
    }
    inFlight.add(postId);
    try {
      const { post, channel, video } = await load(postId);
      const platformOptions = await prepare(post, channel, video, options.consent);

      await posts.update(post.id, {
        status: 'publishing',
        platformOptions,
        updatedAt: clock.now().toISOString(),
      });
      await record(post.id, 'publish_attempt', {
        fromStatus: post.status,
        toStatus: 'publishing',
        message: `Envio ao ${PLATFORM_INFO[channel.platform].label} iniciado`,
      });

      try {
        const result = await social[channel.platform].publish({
          account: accountRef(channel),
          postId: post.id,
          caption: post.caption,
          media: {
            filePath: video.filePath,
            mimeType: video.mimeType,
            durationSeconds: video.duration,
          },
          options: platformOptions,
          ...(options.onProgress ? { onProgress: options.onProgress } : {}),
        });
        await posts.update(post.id, {
          externalPostId: result.externalPostId,
          updatedAt: clock.now().toISOString(),
        });
        await record(post.id, 'publish_attempt', { message: PROCESSING_NOTICE });
      } catch (error) {
        const message = toAppError(error).message;
        await markFailed({ ...post, status: 'publishing' }, message);
        throw error;
      }
      const updated = await posts.getById(post.id);
      if (!updated) throw new AppError('NOT_FOUND', 'Post não encontrado.');
      return updated;
    } finally {
      inFlight.delete(postId);
    }
  }

  /** Consulta o resultado de um post em `publishing`. Devolve o status atual. */
  async function refreshStatus(postId: Id): Promise<PostStatus> {
    const post = await posts.getById(postId);
    if (post?.status !== 'publishing' || !post.externalPostId || inFlight.has(postId)) {
      return post?.status ?? 'failed';
    }
    const channel = await channels.getById(post.channelId);
    if (!channel) return post.status;
    const result = await social[channel.platform].getPublicationStatus(
      accountRef(channel),
      post.externalPostId,
    );
    const now = clock.now().toISOString();
    if (result.state === 'published') {
      await posts.update(post.id, {
        status: 'published',
        publishedAt: result.publishedAt ?? now,
        externalPostId: result.publicPostId ?? result.externalPostId,
        updatedAt: now,
      });
      await record(post.id, 'published', {
        fromStatus: 'publishing',
        toStatus: 'published',
        message: `Publicado no ${PLATFORM_INFO[channel.platform].label}`,
      });
      return 'published';
    }
    if (result.state === 'failed') {
      await markFailed(post, result.errorMessage ?? 'A plataforma não publicou o vídeo.');
      return 'failed';
    }
    return 'publishing';
  }

  return {
    publishNow,
    refreshStatus,

    /**
     * Uma rodada do agendador local (app aberto): publica os agendados que venceram há no máximo
     * `PUBLISH_GRACE_MINUTES` e atualiza os que estão em processamento. Falhas viram status "Falhou" com motivo.
     */
    async runScheduler(): Promise<SchedulerResult> {
      const result: SchedulerResult = { started: 0, failed: 0, completed: 0 };
      const now = clock.now();
      const due = await posts.listDetailed({
        statuses: ['scheduled'],
        scheduledFrom: new Date(now.getTime() - PUBLISH_GRACE_MINUTES * 60_000).toISOString(),
        scheduledTo: new Date(now.getTime() + 1).toISOString(),
        order: 'scheduled_asc',
      });
      for (const item of due) {
        if (!social[item.channel.platform].capabilities.publishVideo) continue;
        try {
          await publishNow(item.id, { consent: 'stored' });
          result.started += 1;
        } catch (error) {
          result.failed += 1;
          const current = await posts.getById(item.id);
          // Falhou antes de começar o envio (validação, conta, rede): marca para o usuário ver o motivo.
          if (current?.status === 'scheduled') await markFailed(current, toAppError(error).message);
          logger.warn('Publicação agendada falhou', { post: item.id, error });
        }
      }

      const pending = await posts.listDetailed({ statuses: ['publishing'] });
      for (const item of pending) {
        try {
          const status = await refreshStatus(item.id);
          if (status === 'published' || status === 'failed') result.completed += 1;
        } catch (error) {
          // Sem internet ou limite da API: tenta de novo na próxima rodada.
          logger.warn('Não foi possível consultar o status da publicação', {
            post: item.id,
            error,
          });
        }
      }
      return result;
    },
  };
}

export type PublishService = ReturnType<typeof createPublishService>;
