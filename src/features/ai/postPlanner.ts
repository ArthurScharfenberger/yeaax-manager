import type { Repositories } from '@/db/repositories';
import { requiresPostOptions } from '@/features/posts/tiktokOptionsRules';
import { AUTO_SCHEDULE_SETTING } from '@/features/automation/autoSchedule';
import { DUPLICATE_GUARD_STATUSES } from '@/features/posts/postRules';
import type { DuplicateResult, PostService } from '@/features/posts/postService';
import type { SettingsService } from '@/features/settings/settingsService';
import type { Clock } from '@/lib/clock';
import { AppError, toAppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { PLATFORM_INFO } from '@/lib/platforms';
import { type AIService, postPlanDraftSchema, type PostPlanRequest } from '@/services/ai';
import type { DesktopBridge } from '@/services/desktop/DesktopBridge';
import type { Channel, Id } from '@/types';
import { toLocalDateTimeValue } from '@/utils/date';

import { composeCaption, resolveSchedule, upcomingSlots } from './postPlanRules';

export const MAX_INSTRUCTION_LENGTH = 1000;

export interface PlannedPost {
  channel: Channel;
  /** Legenda final (texto + hashtags), editável pelo usuário antes de confirmar. */
  caption: string;
}

export interface PostPlan {
  mediaId: Id;
  instruction: string;
  summary: string;
  posts: PlannedPost[];
  scheduledAt: Date | null;
  scheduleNote: string | null;
  /** `true` quando gerado pelo interpretador local (sem IA real). */
  simulated: boolean;
}

/** O que o usuário confirma (pode ter editado legendas, removido canais e mudado o horário). */
export interface PlanConfirmation {
  mediaId: Id;
  instruction: string;
  posts: { channelId: Id; caption: string }[];
  scheduledAt: Date | null;
}

interface PostPlannerDeps {
  ai: AIService;
  repositories: Pick<Repositories, 'channels' | 'media' | 'posts'>;
  settings: SettingsService;
  posts: PostService;
  desktop: DesktopBridge;
  /** Lê a miniatura como data URL para a IA "ver" o vídeo. Injetável para testes. */
  loadImage: (src: string) => Promise<string | null>;
  clock: Clock;
}

/**
 * "Postar com IA": o usuário descreve o que quer, a IA monta um plano (canais, legendas,
 * hashtags, horário) e o usuário confirma. Nada é criado sem a confirmação (DEC-019).
 */
export function createPostPlanner(deps: PostPlannerDeps) {
  const { ai, repositories, settings, posts, desktop, loadImage, clock } = deps;

  async function loadThumbnail(thumbnailPath: string | null): Promise<string | null> {
    const src = thumbnailPath ? desktop.toAssetUrl(thumbnailPath) : null;
    if (!src) return null;
    return loadImage(src).catch((error: unknown) => {
      logger.warn('Miniatura indisponível para a IA', { error });
      return null;
    });
  }

  return {
    async plan(mediaId: Id, rawInstruction: string): Promise<PostPlan> {
      const instruction = rawInstruction.trim();
      if (!instruction) {
        throw new AppError('VALIDATION', 'Descreva o que você quer fazer com o vídeo.');
      }
      if (instruction.length > MAX_INSTRUCTION_LENGTH) {
        throw new AppError('VALIDATION', `Use até ${MAX_INSTRUCTION_LENGTH} caracteres no pedido.`);
      }

      const media = await repositories.media.getById(mediaId);
      if (!media) throw new AppError('NOT_FOUND', 'Vídeo não encontrado na biblioteca.');
      const channels = await repositories.channels.list();
      if (channels.length === 0) {
        throw new AppError('VALIDATION', 'Cadastre ao menos um canal antes de postar.');
      }

      // Canais onde o vídeo já está agendado/publicado: a IA é avisada e eles saem do plano.
      const used = new Set<Id>();
      for (const channel of channels) {
        const existing = await repositories.posts.findByChannelAndMedia({
          channelId: channel.id,
          mediaId,
          statuses: DUPLICATE_GUARD_STATUSES,
        });
        if (existing.length > 0) used.add(channel.id);
      }

      const now = clock.now();
      const slots = upcomingSlots(await settings.get(AUTO_SCHEDULE_SETTING), now);
      const request: PostPlanRequest = {
        instruction,
        media: {
          filename: media.filename,
          durationSeconds: media.duration,
          width: media.width,
          height: media.height,
          tags: media.tags.map((tag) => tag.name),
          thumbnailDataUrl: await loadThumbnail(media.thumbnailPath),
        },
        channels: channels.map((channel) => ({
          id: channel.id,
          platform: channel.platform,
          username: channel.username,
          displayName: channel.displayName,
          connected: channel.status === 'connected',
          alreadyHasThisVideo: used.has(channel.id),
          captionMaxLength: PLATFORM_INFO[channel.platform].limits.captionMaxLength,
          maxHashtags: PLATFORM_INFO[channel.platform].limits.maxHashtags,
        })),
        suggestedTimes: slots.slice(0, 6).map(toLocalDateTimeValue),
        now: toLocalDateTimeValue(now),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };

      const [status, rawDraft] = await Promise.all([ai.describe(), ai.planPost(request)]);
      // A resposta da IA é dado externo: valida de novo, independentemente do provider.
      const draft = postPlanDraftSchema.parse(rawDraft);

      const byId = new Map(channels.map((channel) => [channel.id, channel]));
      const seen = new Set<Id>();
      const skipped: string[] = [];
      const planned: PlannedPost[] = [];
      for (const item of draft.posts) {
        const channel = byId.get(item.channelId);
        if (!channel || seen.has(channel.id)) continue;
        if (used.has(channel.id)) {
          skipped.push(`${channel.displayName} (${PLATFORM_INFO[channel.platform].label})`);
          continue;
        }
        seen.add(channel.id);
        planned.push({ channel, caption: composeCaption(item.caption, item.hashtags) });
      }
      const skippedNote =
        skipped.length > 0
          ? `Este vídeo já está agendado ou publicado em ${skipped.join(', ')} — removido do plano.`
          : null;
      if (planned.length === 0) {
        throw new AppError(
          skippedNote ? 'DUPLICATE_POST' : 'AI_ERROR',
          skippedNote ?? 'A IA não escolheu nenhum canal válido. Reformule o pedido.',
        );
      }

      const schedule = resolveSchedule(draft.schedule, slots, now);
      return {
        mediaId,
        instruction,
        summary: draft.summary,
        posts: planned,
        scheduledAt: schedule.scheduledAt,
        scheduleNote: [skippedNote, schedule.note].filter(Boolean).join(' ') || null,
        simulated: status.simulated,
      };
    },

    /**
     * Cria os posts confirmados: agendados se houver horário (TikTok: em revisão, aguardando as escolhas do
     * compositor), senão rascunhos.
     * Cada canal é independente — falhas (ex.: legenda acima do limite) não bloqueiam os demais.
     */
    async confirm(confirmation: PlanConfirmation): Promise<DuplicateResult> {
      const result: DuplicateResult = { created: [], failed: [] };
      const historyMessage = `Criado com IA a partir do pedido: "${confirmation.instruction}"`;
      for (const item of confirmation.posts) {
        try {
          // TikTok exige escolhas e consentimento por post (DEC-029): com horário, vai para revisão e o usuário
          // completa privacidade/opções no compositor antes de agendar.
          const channel = await repositories.channels.getById(item.channelId);
          const needsOptions = channel ? requiresPostOptions(channel.platform) : false;
          result.created.push(
            await posts.create(
              {
                channelId: item.channelId,
                mediaId: confirmation.mediaId,
                caption: item.caption,
                status: confirmation.scheduledAt
                  ? needsOptions
                    ? 'review'
                    : 'scheduled'
                  : 'draft',
                scheduledAt: confirmation.scheduledAt?.toISOString() ?? null,
              },
              historyMessage,
            ),
          );
        } catch (error) {
          result.failed.push({ channelId: item.channelId, message: toAppError(error).message });
        }
      }
      return result;
    },
  };
}

export type PostPlanner = ReturnType<typeof createPostPlanner>;
