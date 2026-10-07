import { Ban, CopyPlus, Pencil, Trash2 } from 'lucide-react';
import { type ReactNode, useState } from 'react';

import { MediaThumbnail } from '@/components/MediaThumbnail';
import { PlatformMark } from '@/components/PlatformMark';
import { PostStatusBadge } from '@/components/StatusBadges';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Modal } from '@/components/ui/Modal';
import { Notice } from '@/components/ui/Notice';
import { LoadingBlock } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/toastContext';
import { useNow } from '@/hooks/useNow';
import { getErrorMessage } from '@/lib/errors';
import { POST_HISTORY_EVENT_LABELS } from '@/lib/labels';
import type { Id, PostWithRelations } from '@/types';
import { formatDateTime, formatHandle, formatScheduleLabel } from '@/utils/format';

import { useCancelPost, useDeletePost, usePost, usePostHistory } from '../hooks';
import { canCancel, canDelete, isEditable, isOverdue } from '../postRules';

interface PostDetailsDialogProps {
  postId: Id;
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
}

export function PostDetailsDialog({
  postId,
  onClose,
  onEdit,
  onDuplicate,
}: PostDetailsDialogProps) {
  const post = usePost(postId);

  return (
    <Modal
      title="Detalhes do post"
      size="lg"
      onClose={onClose}
      footer={
        post.data && (
          <DetailsFooter
            post={post.data}
            onClose={onClose}
            onEdit={onEdit}
            onDuplicate={onDuplicate}
          />
        )
      }
    >
      {post.isPending && <LoadingBlock />}
      {post.isError && <Notice tone="danger">{getErrorMessage(post.error)}</Notice>}
      {post.data && <DetailsBody post={post.data} />}
    </Modal>
  );
}

function DetailRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-3 py-1.5">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="min-w-0 text-sm text-ink">{children}</dd>
    </div>
  );
}

function DetailsBody({ post }: { post: PostWithRelations }) {
  const now = useNow();
  const history = usePostHistory(post.id);

  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-5">
      {post.media ? (
        <MediaThumbnail media={post.media} className="aspect-[9/16] w-full rounded" />
      ) : (
        <div className="flex aspect-[9/16] w-full items-center justify-center rounded border border-dashed border-line-strong text-center text-xs text-ink-3">
          Sem vídeo
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-4">
        <dl className="divide-y divide-line">
          <DetailRow label="Canal">
            {post.channel.displayName}{' '}
            <span className="text-ink-3">{formatHandle(post.channel.username)}</span>
          </DetailRow>
          <DetailRow label="Plataforma">
            <PlatformMark platform={post.channel.platform} withLabel />
          </DetailRow>
          <DetailRow label="Status">
            <PostStatusBadge status={post.status} overdue={isOverdue(post, now)} />
          </DetailRow>
          <DetailRow label="Horário">
            {post.scheduledAt
              ? formatScheduleLabel(new Date(post.scheduledAt), now)
              : 'Sem data definida'}
          </DetailRow>
          {post.publishedAt && (
            <DetailRow label="Publicado em">{formatDateTime(new Date(post.publishedAt))}</DetailRow>
          )}
          <DetailRow label="Vídeo">{post.media?.filename ?? '—'}</DetailRow>
        </dl>

        <section aria-label="Legenda">
          <h3 className="mb-1.5 text-xs font-medium text-ink-2">Legenda</h3>
          <p className="max-h-40 overflow-y-auto rounded border border-line bg-sunken px-3 py-2 text-sm whitespace-pre-wrap text-ink">
            {post.caption || <span className="text-ink-3">Sem legenda.</span>}
          </p>
        </section>

        <section aria-label="Histórico">
          <h3 className="mb-1.5 text-xs font-medium text-ink-2">Histórico</h3>
          {history.isPending && <LoadingBlock className="py-4" />}
          <ol className="flex flex-col">
            {history.data?.map((entry) => (
              <li key={entry.id} className="flex gap-3 border-l border-line py-1.5 pl-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">{POST_HISTORY_EVENT_LABELS[entry.event]}</p>
                  {entry.message && <p className="text-xs text-ink-3">{entry.message}</p>}
                </div>
                <time dateTime={entry.createdAt} className="shrink-0 text-xs text-ink-3 tabular">
                  {formatDateTime(new Date(entry.createdAt))}
                </time>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}

function DetailsFooter({
  post,
  onClose,
  onEdit,
  onDuplicate,
}: {
  post: PostWithRelations;
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
}) {
  const [confirm, setConfirm] = useState<'cancel' | 'delete' | null>(null);
  const cancelPost = useCancelPost();
  const deletePost = useDeletePost();
  const toast = useToast();

  return (
    <>
      {canDelete(post.status) && (
        <Button
          variant="danger"
          icon={Trash2}
          onClick={() => setConfirm('delete')}
          className="mr-auto"
        >
          Excluir
        </Button>
      )}
      {canCancel(post.status) && (
        <Button icon={Ban} onClick={() => setConfirm('cancel')}>
          Cancelar post
        </Button>
      )}
      <Button icon={CopyPlus} onClick={onDuplicate}>
        Duplicar
      </Button>
      <Button onClick={onClose}>Fechar</Button>
      {isEditable(post.status) && (
        <Button variant="primary" icon={Pencil} onClick={onEdit}>
          Editar
        </Button>
      )}

      {confirm === 'cancel' && (
        <ConfirmDialog
          title="Cancelar post?"
          description="O post deixa a fila de publicação. Ele poderá voltar a ser rascunho depois."
          confirmLabel="Cancelar post"
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await cancelPost.mutateAsync(post.id);
            toast.success('Post cancelado');
          }}
        />
      )}
      {confirm === 'delete' && (
        <ConfirmDialog
          title="Excluir post?"
          description="O post e seu histórico serão removidos permanentemente. O vídeo da biblioteca não é afetado."
          confirmLabel="Excluir"
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await deletePost.mutateAsync(post.id);
            toast.success('Post excluído');
            onClose();
          }}
        />
      )}
    </>
  );
}
