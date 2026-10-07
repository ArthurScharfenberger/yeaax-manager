import type { PostStatus } from '@/types';

/** Cor da borda lateral de um post no calendário, por status. */
export const POST_ACCENT_CLASSES: Record<PostStatus, string> = {
  draft: 'border-l-ink-4',
  review: 'border-l-warning',
  scheduled: 'border-l-accent',
  publishing: 'border-l-accent',
  published: 'border-l-success',
  failed: 'border-l-danger',
  cancelled: 'border-l-line-strong',
};
