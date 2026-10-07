import { MediaThumbnail } from '@/components/MediaThumbnail';
import { MediaStatusBadge } from '@/components/StatusBadges';
import type { Media } from '@/types';
import { cn } from '@/utils/cn';

interface MediaTileProps {
  media: Media;
  selected?: boolean;
  onSelect: () => void;
}

/** Item compacto do grid da biblioteca: miniatura, duração, tag principal e status. */
export function MediaTile({ media, selected = false, onSelect }: MediaTileProps) {
  const [firstTag, ...otherTags] = media.tags;
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'group flex min-w-0 flex-col gap-2 rounded-md border p-1.5 text-left transition-colors',
        selected ? 'border-accent ring-2 ring-accent/20' : 'border-line hover:border-line-strong',
      )}
    >
      <MediaThumbnail media={media} className="aspect-[4/5] w-full" />
      <div className="flex min-w-0 flex-col gap-1.5 px-0.5 pb-0.5">
        <p className="truncate text-xs font-medium text-ink" title={media.filename}>
          {media.filename}
        </p>
        <div className="flex min-w-0 items-center justify-between gap-1.5">
          <span className="truncate text-2xs text-ink-3">
            {firstTag ? `#${firstTag.name}` : 'sem tag'}
            {otherTags.length > 0 && ` +${otherTags.length}`}
          </span>
          <MediaStatusBadge status={media.status} />
        </div>
      </div>
    </button>
  );
}
