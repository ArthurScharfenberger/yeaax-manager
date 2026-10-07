import { Film } from 'lucide-react';

import { useServices } from '@/app/ServicesContext';
import { cn } from '@/utils/cn';
import { formatDuration } from '@/utils/format';

/** Tons neutros para variar os placeholders sem introduzir cores. */
const PLACEHOLDER_TONES = ['bg-[#ececef]', 'bg-[#e4e4e8]', 'bg-[#f0f0f2]', 'bg-[#e8e8ec]'];

function toneFor(seed: string): string {
  let hash = 0;
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return PLACEHOLDER_TONES[hash % PLACEHOLDER_TONES.length] ?? 'bg-sunken';
}

interface MediaThumbnailProps {
  media: { id: string; filename: string; thumbnailPath: string | null; duration: number | null };
  showDuration?: boolean;
  /** Classes de tamanho/proporção (ex.: `w-9 aspect-[3/4]`). */
  className?: string;
}

/**
 * Miniatura da mídia. Nunca carrega o vídeo: usa `thumbnailPath` (gerado futuramente
 * pelo FFmpeg) ou um placeholder neutro.
 */
export function MediaThumbnail({ media, showDuration = true, className }: MediaThumbnailProps) {
  const { desktop } = useServices();
  const src = media.thumbnailPath ? desktop.toAssetUrl(media.thumbnailPath) : null;

  return (
    <div
      className={cn(
        'relative flex shrink-0 items-center justify-center overflow-hidden rounded-sm',
        src ? 'bg-sunken' : toneFor(media.id),
        className,
      )}
    >
      {src ? (
        <img src={src} alt="" loading="lazy" className="size-full object-cover" />
      ) : (
        <Film size={16} className="text-ink-4" aria-hidden />
      )}
      {showDuration && media.duration !== null && (
        <span className="absolute right-1 bottom-1 rounded-sm bg-black/70 px-1 text-2xs leading-4 font-medium text-white tabular">
          {formatDuration(media.duration)}
        </span>
      )}
    </div>
  );
}
