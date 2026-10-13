import { z } from 'zod';

import type { Channel } from './channel';
import type { Id, IsoDateString } from './common';
import type { Media } from './media';

export const POST_STATUSES = [
  'draft',
  'review',
  'scheduled',
  'publishing',
  'published',
  'failed',
  'cancelled',
] as const;
export const postStatusSchema = z.enum(POST_STATUSES);
export type PostStatus = z.infer<typeof postStatusSchema>;

/** Níveis de privacidade do TikTok (as opções reais de cada conta vêm do `creator_info`). */
export const TIKTOK_PRIVACY_LEVELS = [
  'PUBLIC_TO_EVERYONE',
  'MUTUAL_FOLLOW_FRIENDS',
  'FOLLOWER_OF_CREATOR',
  'SELF_ONLY',
] as const;
export const tiktokPrivacyLevelSchema = z.enum(TIKTOK_PRIVACY_LEVELS);
export type TikTokPrivacyLevel = z.infer<typeof tiktokPrivacyLevelSchema>;

/**
 * Escolhas exigidas pelas diretrizes do TikTok para cada post (DEC-019/029). Nada vem marcado: privacidade sem
 * padrão, interações e divulgação comercial desligadas. `consentedAt` registra quando o usuário confirmou o envio
 * (clicou em "Agendar" com a declaração visível).
 */
export const tiktokPostOptionsSchema = z.object({
  platform: z.literal('tiktok'),
  privacyLevel: tiktokPrivacyLevelSchema.nullable(),
  allowComment: z.boolean(),
  allowDuet: z.boolean(),
  allowStitch: z.boolean(),
  commercialContent: z.boolean(),
  yourBrand: z.boolean(),
  brandedContent: z.boolean(),
  consentedAt: z.iso.datetime().nullable(),
});
export type TikTokPostOptions = z.infer<typeof tiktokPostOptionsSchema>;

/** Opções específicas da plataforma do post (por enquanto só TikTok). */
export const platformOptionsSchema = z.discriminatedUnion('platform', [tiktokPostOptionsSchema]);
export type PlatformOptions = z.infer<typeof platformOptionsSchema>;

/** Publicação planejada ou realizada em um canal. */
export interface Post {
  id: Id;
  channelId: Id;
  mediaId: Id | null;
  caption: string;
  status: PostStatus;
  /** Horário planejado. Obrigatório para `scheduled`; opcional para rascunhos. */
  scheduledAt: IsoDateString | null;
  publishedAt: IsoDateString | null;
  /** Id do post na plataforma, preenchido após a publicação. */
  externalPostId: string | null;
  /** Escolhas da plataforma (privacidade, interações, divulgação comercial). `null` = ainda não definidas. */
  platformOptions: PlatformOptions | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}

/** Post com os dados de canal e mídia necessários para listas, filas e calendário. */
export interface PostWithRelations extends Post {
  channel: Pick<Channel, 'id' | 'platform' | 'username' | 'displayName' | 'status'>;
  media: Pick<Media, 'id' | 'filename' | 'filePath' | 'thumbnailPath' | 'duration'> | null;
}

export const POST_HISTORY_EVENTS = [
  'created',
  'updated',
  'status_changed',
  'scheduled',
  'rescheduled',
  'publish_attempt',
  'published',
  'failed',
  'cancelled',
] as const;
export const postHistoryEventSchema = z.enum(POST_HISTORY_EVENTS);
export type PostHistoryEvent = z.infer<typeof postHistoryEventSchema>;

/** Registro de auditoria de mudanças relevantes em um post. */
export interface PostHistoryEntry {
  id: Id;
  postId: Id;
  event: PostHistoryEvent;
  fromStatus: PostStatus | null;
  toStatus: PostStatus | null;
  message: string | null;
  createdAt: IsoDateString;
}
