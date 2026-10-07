import { Clapperboard } from 'lucide-react';
import { useNavigate } from 'react-router';

import { ROUTES } from '@/app/routes';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingBlock } from '@/components/ui/Spinner';

import { useMediaList } from '../hooks';
import { MediaTile } from './MediaTile';

const PREVIEW_LIMIT = 8;

/** Grid compacto com os vídeos mais recentes (Dashboard). */
export function LibraryPreview() {
  const media = useMediaList({ limit: PREVIEW_LIMIT });
  const navigate = useNavigate();

  if (media.isPending) return <LoadingBlock />;
  if (!media.data || media.data.length === 0) {
    return (
      <EmptyState
        compact
        icon={Clapperboard}
        title="Biblioteca vazia"
        description="Importe vídeos .mp4, .mov ou .webm para começar."
      />
    );
  }

  return (
    <div className="grid grid-cols-4 gap-3 p-4 xl:grid-cols-8">
      {media.data.map((item) => (
        <MediaTile
          key={item.id}
          media={item}
          onSelect={() => void navigate(`${ROUTES.library}?media=${item.id}`)}
        />
      ))}
    </div>
  );
}
