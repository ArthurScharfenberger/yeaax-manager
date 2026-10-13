import { CircleCheck, Plus, Sparkles, Trash2, X } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { useServices } from '@/app/ServicesContext';
import { PlatformMark } from '@/components/PlatformMark';
import { MediaStatusBadge, PostStatusBadge } from '@/components/StatusBadges';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { IconButton } from '@/components/ui/IconButton';
import { Notice } from '@/components/ui/Notice';
import { useToast } from '@/components/ui/toastContext';
import { usePosts } from '@/features/posts/hooks';
import { usePostDialogs } from '@/features/posts/postDialogsContext';
import { isDemoMediaPath } from '@/lib/demo';
import type { Media } from '@/types';
import { formatDateTime, formatDuration, formatFileSize, formatResolution } from '@/utils/format';

import { useMediaFile, useMediaMutations } from '../hooks';
import { MediaVideoPreview } from './MediaVideoPreview';
import { TagEditor } from './TagEditor';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-2 py-1.5">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="min-w-0 text-xs text-ink">{children}</dd>
    </div>
  );
}

interface MediaDetailsPanelProps {
  media: Media;
  onClose: () => void;
}

export function MediaDetailsPanel({ media, onClose }: MediaDetailsPanelProps) {
  const { mode } = useServices();
  const { openComposer, openDetails, openAiPost } = usePostDialogs();
  const { updateStatus, remove } = useMediaMutations();
  const posts = usePosts({ mediaId: media.id, order: 'updated_desc' });
  const file = useMediaFile(media.filePath);
  const toast = useToast();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const isDemo = isDemoMediaPath(media.filePath);

  return (
    <aside
      aria-label={`Detalhes de ${media.filename}`}
      className="flex w-80 shrink-0 flex-col border-l border-line bg-canvas"
    >
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-line px-4">
        <h2 className="truncate text-sm font-semibold" title={media.filename}>
          {media.filename}
        </h2>
        <IconButton icon={X} label="Fechar detalhes" size="sm" onClick={onClose} />
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
        <MediaVideoPreview media={media} className="max-h-80" />

        {isDemo && <Notice>Vídeo de demonstração — não existe arquivo real.</Notice>}
        {file.isError && (
          <Notice tone="warning" title="Arquivo indisponível">
            O arquivo original foi movido, renomeado ou removido.
          </Notice>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="primary"
            icon={Sparkles}
            className="flex-1"
            onClick={() => openAiPost(media.id)}
          >
            Postar com IA
          </Button>
          <Button size="sm" icon={Plus} onClick={() => openComposer({ mediaId: media.id })}>
            Manual
          </Button>
          {media.status !== 'ready' && (
            <Button
              size="sm"
              icon={CircleCheck}
              loading={updateStatus.isPending}
              onClick={() =>
                updateStatus.mutate(
                  { id: media.id, status: 'ready' },
                  { onError: (error) => toast.error(error) },
                )
              }
            >
              Marcar pronto
            </Button>
          )}
        </div>

        <dl className="divide-y divide-line">
          <Row label="Status">
            <MediaStatusBadge status={media.status} />
          </Row>
          <Row label="Duração">
            <span className="tabular">{formatDuration(media.duration)}</span>
          </Row>
          <Row label="Resolução">
            <span className="tabular">{formatResolution(media.width, media.height)}</span>
          </Row>
          <Row label="Tamanho">
            <span className="tabular">{formatFileSize(media.size)}</span>
          </Row>
          <Row label="Formato">{media.mimeType}</Row>
          <Row label="Importado">{formatDateTime(new Date(media.createdAt))}</Row>
          <Row label="Arquivo">
            <span className="font-mono text-2xs break-all text-ink-2" title={media.filePath}>
              {media.filePath}
            </span>
          </Row>
        </dl>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-medium text-ink-2">Tags</h3>
          <TagEditor media={media} />
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-xs font-medium text-ink-2">Posts com este vídeo</h3>
          {posts.data?.length === 0 && <p className="text-xs text-ink-3">Nenhum post ainda.</p>}
          <ul className="flex flex-col gap-1">
            {posts.data?.map((post) => (
              <li key={post.id}>
                <button
                  type="button"
                  onClick={() => openDetails(post.id)}
                  className="flex w-full items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-hover"
                >
                  <PlatformMark platform={post.channel.platform} />
                  <span className="min-w-0 flex-1 truncate text-xs text-ink">
                    {post.channel.displayName}
                  </span>
                  <PostStatusBadge status={post.status} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <footer className="shrink-0 border-t border-line px-4 py-3">
        <Button
          size="sm"
          variant="danger"
          icon={Trash2}
          onClick={() => setConfirmRemove(true)}
          className="w-full"
        >
          Remover da biblioteca
        </Button>
        {mode === 'desktop' && !isDemo && (
          <p className="mt-1.5 text-center text-2xs text-ink-3">
            O arquivo original não é apagado.
          </p>
        )}
      </footer>

      {confirmRemove && (
        <ConfirmDialog
          title="Remover da biblioteca?"
          description="O registro e as tags deste vídeo serão removidos do app. O arquivo original no disco não é apagado."
          confirmLabel="Remover"
          onClose={() => setConfirmRemove(false)}
          onConfirm={async () => {
            await remove.mutateAsync(media.id);
            toast.success('Vídeo removido da biblioteca');
            onClose();
          }}
        />
      )}
    </aside>
  );
}
