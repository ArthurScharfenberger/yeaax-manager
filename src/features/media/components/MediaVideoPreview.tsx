import { useServices } from '@/app/ServicesContext';
import { MediaThumbnail } from '@/components/MediaThumbnail';
import type { Media } from '@/types';
import { cn } from '@/utils/cn';

import { useMediaFile } from '../hooks';

interface MediaVideoPreviewProps {
  media: Pick<Media, 'id' | 'filename' | 'filePath' | 'thumbnailPath' | 'duration'>;
  className?: string;
}

/**
 * Prévia do vídeo (player com `preload="metadata"`: o arquivo inteiro só é lido se o usuário der play). Sem
 * acesso ao arquivo (preview do navegador, arquivo movido), mostra a miniatura.
 */
export function MediaVideoPreview({ media, className }: MediaVideoPreviewProps) {
  const { desktop } = useServices();
  const file = useMediaFile(media.filePath);
  const src = file.isSuccess ? desktop.toAssetUrl(file.data.path) : null;
  const classes = cn('aspect-[9/16] w-full rounded', className);

  if (src) {
    return (
      <video
        src={src}
        controls
        preload="metadata"
        aria-label={`Prévia de ${media.filename}`}
        className={cn(classes, 'bg-ink object-contain')}
      >
        <track kind="captions" />
      </video>
    );
  }
  return <MediaThumbnail media={media} className={classes} />;
}
