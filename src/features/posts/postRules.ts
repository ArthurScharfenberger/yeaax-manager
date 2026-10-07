import { PLATFORM_INFO } from '@/lib/platforms';
import type { Platform, Post, PostStatus } from '@/types';

/**
 * Regras puras do ciclo de vida de um post.
 *
 *   draft ⇄ review → scheduled → publishing → published
 *                         ↓            ↓
 *                     cancelled      failed → (draft | scheduled)
 */
export const POST_STATUS_TRANSITIONS: Readonly<Record<PostStatus, readonly PostStatus[]>> = {
  draft: ['review', 'scheduled', 'cancelled'],
  review: ['draft', 'scheduled', 'cancelled'],
  scheduled: ['draft', 'review', 'publishing', 'cancelled'],
  publishing: ['published', 'failed'],
  published: [],
  failed: ['draft', 'scheduled', 'cancelled'],
  cancelled: ['draft'],
};

/** Status que o usuário escolhe no compositor (os demais são definidos pelo sistema). */
export const COMPOSER_STATUSES = ['draft', 'review', 'scheduled'] as const;
export type ComposerStatus = (typeof COMPOSER_STATUSES)[number];

const EDITABLE_STATUSES: readonly PostStatus[] = ['draft', 'review', 'scheduled', 'failed'];
const DELETABLE_STATUSES: readonly PostStatus[] = ['draft', 'cancelled', 'failed'];

/** Status em que um vídeo "ocupa" o canal — base da regra anti-duplicidade. */
export const DUPLICATE_GUARD_STATUSES: readonly PostStatus[] = [
  'scheduled',
  'publishing',
  'published',
];

/** Status exibidos na fila de publicação do dashboard. */
export const QUEUE_STATUSES: readonly PostStatus[] = [
  'review',
  'scheduled',
  'publishing',
  'failed',
];

export function canTransition(from: PostStatus, to: PostStatus): boolean {
  return from === to || POST_STATUS_TRANSITIONS[from].includes(to);
}

export function isEditable(status: PostStatus): boolean {
  return EDITABLE_STATUSES.includes(status);
}

export function canDelete(status: PostStatus): boolean {
  return DELETABLE_STATUSES.includes(status);
}

export function canCancel(status: PostStatus): boolean {
  return status !== 'cancelled' && canTransition(status, 'cancelled');
}

/** Agendado com horário que já passou e ainda não foi publicado. */
export function isOverdue(post: Pick<Post, 'status' | 'scheduledAt'>, now: Date): boolean {
  return (
    post.status === 'scheduled' &&
    post.scheduledAt !== null &&
    new Date(post.scheduledAt).getTime() < now.getTime()
  );
}

export function countHashtags(caption: string): number {
  return caption.match(/#[\p{L}\p{N}_]+/gu)?.length ?? 0;
}

/** Menções `@usuario` (ignora e-mails como `a@b.com`). */
export function countMentions(caption: string): number {
  return caption.match(/(?<![\w.])@[\w.]+/g)?.length ?? 0;
}

export interface CaptionCheck {
  length: number;
  maxLength: number;
  hashtags: number;
  maxHashtags: number | null;
  mentions: number;
  maxMentions: number | null;
  tooLong: boolean;
  tooManyHashtags: boolean;
  tooManyMentions: boolean;
}

/** Verifica a legenda contra os limites da plataforma. */
export function checkCaption(caption: string, platform: Platform): CaptionCheck {
  const { captionMaxLength, maxHashtags, maxMentions } = PLATFORM_INFO[platform].limits;
  // Unidades UTF-16: é como o TikTok conta e é conservador para o Instagram (emojis contam 2).
  const length = caption.length;
  const hashtags = countHashtags(caption);
  const mentions = countMentions(caption);
  return {
    length,
    maxLength: captionMaxLength,
    hashtags,
    maxHashtags,
    mentions,
    maxMentions,
    tooLong: length > captionMaxLength,
    tooManyHashtags: maxHashtags !== null && hashtags > maxHashtags,
    tooManyMentions: maxMentions !== null && mentions > maxMentions,
  };
}
