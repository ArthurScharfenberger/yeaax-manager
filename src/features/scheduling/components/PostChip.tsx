import type { DragEvent } from 'react';

import { PlatformMark } from '@/components/PlatformMark';
import { POST_ACCENT_CLASSES } from '@/components/statusStyles';
import { POST_STATUS_LABELS } from '@/lib/labels';
import type { PostWithRelations } from '@/types';
import { cn } from '@/utils/cn';
import { formatHandle, formatTime } from '@/utils/format';

export const POST_DRAG_TYPE = 'application/x-social-manager-post';

interface PostChipProps {
  post: PostWithRelations;
  onOpen: () => void;
  /** Habilita arrastar para outra célula do calendário. */
  draggable?: boolean;
}

/** Representação compacta de um post no calendário e na agenda semanal. */
export function PostChip({ post, onOpen, draggable = false }: PostChipProps) {
  const time = post.scheduledAt ? formatTime(new Date(post.scheduledAt)) : '—';

  function handleDragStart(event: DragEvent<HTMLButtonElement>) {
    event.dataTransfer.setData(POST_DRAG_TYPE, post.id);
    event.dataTransfer.effectAllowed = 'move';
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      draggable={draggable}
      onDragStart={draggable ? handleDragStart : undefined}
      title={`${time} · ${post.channel.displayName} · ${POST_STATUS_LABELS[post.status]}`}
      aria-label={`${time}, ${post.channel.displayName} ${formatHandle(post.channel.username)}, ${POST_STATUS_LABELS[post.status]}`}
      className={cn(
        'flex w-full min-w-0 items-center gap-1.5 rounded-sm border border-l-2 border-line bg-canvas px-1.5 py-1 text-left text-2xs transition-colors hover:border-line-strong hover:bg-sunken',
        POST_ACCENT_CLASSES[post.status],
        post.status === 'draft' && 'border-dashed',
        post.status === 'published' && 'text-ink-3',
        draggable && 'cursor-grab active:cursor-grabbing',
      )}
    >
      <span className="shrink-0 font-semibold text-ink tabular">{time}</span>
      <PlatformMark platform={post.channel.platform} />
      <span className="min-w-0 truncate text-ink-2">{post.channel.displayName}</span>
    </button>
  );
}
