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
