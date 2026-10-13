import type { Post, PostWithRelations, TikTokPostOptions } from '@/types';
import { toDateInputValue, toTimeInputValue } from '@/utils/date';
import { formatScheduleLabel } from '@/utils/format';

import type { ComposerOptions } from '../postDialogsContext';
import { COMPOSER_STATUSES, type ComposerStatus } from '../postRules';
import { emptyTikTokOptions } from '../tiktokOptionsRules';

/** Estado do formulário do compositor (fora do componente para o fast refresh do React). */
export interface FormState {
  channelId: string;
  mediaId: string;
  caption: string;
  date: string;
  time: string;
  status: ComposerStatus;
  /** Escolhas do TikTok (só usadas quando o canal é do TikTok). */
  tiktok: TikTokPostOptions;
}

export const SUBMIT_LABELS: Record<ComposerStatus, string> = {
  draft: 'Salvar rascunho',
  review: 'Enviar para revisão',
  scheduled: 'Agendar',
};

function isComposerStatus(status: string): status is ComposerStatus {
  return (COMPOSER_STATUSES as readonly string[]).includes(status);
}

export function buildInitialState(
  options: ComposerOptions,
  post: PostWithRelations | undefined,
): FormState {
  const date = post?.scheduledAt ? new Date(post.scheduledAt) : (options.scheduledAt ?? null);
  return {
    channelId: post?.channelId ?? options.channelId ?? '',
    mediaId: post?.mediaId ?? options.mediaId ?? '',
    caption: post?.caption ?? options.caption ?? '',
    date: date ? toDateInputValue(date) : '',
    time: date ? toTimeInputValue(date) : '',
    status: post
      ? isComposerStatus(post.status)
        ? post.status
        : 'draft'
      : date
        ? 'scheduled'
        : 'draft',
    tiktok:
      post?.platformOptions?.platform === 'tiktok' ? post.platformOptions : emptyTikTokOptions(),
  };
}

export function successMessage(post: Post): string {
  if (post.status === 'scheduled' && post.scheduledAt) {
    return `Post agendado · ${formatScheduleLabel(new Date(post.scheduledAt), new Date())}`;
  }
  return post.status === 'review' ? 'Post enviado para revisão' : 'Rascunho salvo';
}
