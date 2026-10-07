import { Ban, CalendarClock, CopyPlus, Eye, Pencil } from 'lucide-react';
import { useState } from 'react';

import { MediaThumbnail } from '@/components/MediaThumbnail';
import { PlatformMark } from '@/components/PlatformMark';
import { PostStatusBadge } from '@/components/StatusBadges';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { LoadingBlock } from '@/components/ui/Spinner';
import { Table, Td, Th, THead, Tr } from '@/components/ui/Table';
import { useToast } from '@/components/ui/toastContext';
import { getErrorMessage } from '@/lib/errors';
import type { Id, PostWithRelations } from '@/types';
import { cn } from '@/utils/cn';
import { addDays, startOfDay } from '@/utils/date';
import { formatHandle, formatScheduleLabel, truncate } from '@/utils/format';

import { useCancelPost, usePosts } from '../hooks';
import { usePostDialogs } from '../postDialogsContext';
import { canCancel, isEditable, isOverdue, QUEUE_STATUSES } from '../postRules';

const QUEUE_DAYS = 8;
const QUEUE_LIMIT = 8;

/** Próximos posts (hoje + 7 dias) em revisão, agendados, publicando ou com falha. */
export function PublicationQueue({ now }: { now: Date }) {
  const today = startOfDay(now);
  const posts = usePosts({
    statuses: QUEUE_STATUSES,
    scheduledFrom: today.toISOString(),
    scheduledTo: addDays(today, QUEUE_DAYS).toISOString(),
    order: 'scheduled_asc',
    limit: QUEUE_LIMIT,
  });
  const { openComposer, openDetails, openDuplicate } = usePostDialogs();
  const [cancelId, setCancelId] = useState<Id | null>(null);
  const cancelPost = useCancelPost();
  const toast = useToast();

  if (posts.isPending) return <LoadingBlock />;
  if (posts.isError) {
    return (
      <Notice tone="danger" className="m-4">
        {getErrorMessage(posts.error)}
      </Notice>
    );
  }
  if (posts.data.length === 0) {
    return (
      <EmptyState
        compact
        icon={CalendarClock}
        title="Nenhum post na fila"
        description="Posts agendados para os próximos dias aparecem aqui."
        action={
          <Button size="sm" variant="primary" onClick={() => openComposer()}>
            Novo post
          </Button>
        }
      />
    );
  }

  return (
    <>
      <Table>
        <THead>
          <tr>
            <Th className="w-14">
              <span className="sr-only">Miniatura</span>
            </Th>
            <Th>Canal</Th>
            <Th>Plataforma</Th>
            <Th>Horário</Th>
            <Th>Status</Th>
            <Th>Legenda</Th>
            <Th className="w-10">
              <span className="sr-only">Ações</span>
            </Th>
          </tr>
        </THead>
        <tbody>
          {posts.data.map((post) => (
            <QueueRow
              key={post.id}
              post={post}
              now={now}
              onOpen={() => openDetails(post.id)}
              onEdit={() => openComposer({ postId: post.id })}
              onDuplicate={() => openDuplicate(post.id)}
              onCancel={() => setCancelId(post.id)}
            />
          ))}
        </tbody>
      </Table>

      {cancelId && (
        <ConfirmDialog
          title="Cancelar post?"
          description="O post sai da fila de publicação. Você pode reativá-lo como rascunho depois."
          confirmLabel="Cancelar post"
          onClose={() => setCancelId(null)}
          onConfirm={async () => {
            await cancelPost.mutateAsync(cancelId);
            toast.success('Post cancelado');
          }}
        />
      )}
    </>
  );
}

interface QueueRowProps {
  post: PostWithRelations;
  now: Date;
  onOpen: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onCancel: () => void;
}

function QueueRow({ post, now, onOpen, onEdit, onDuplicate, onCancel }: QueueRowProps) {
  const overdue = isOverdue(post, now);
  return (
    <Tr onClick={onOpen} className="cursor-default">
      <Td className="py-1.5">
        <MediaThumbnail
          media={post.media ?? { id: post.id, filename: '', thumbnailPath: null, duration: null }}
          showDuration={false}
          className="aspect-[3/4] w-8"
        />
      </Td>
      <Td>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          className="flex flex-col text-left"
        >
          <span className="font-medium text-ink hover:underline">{post.channel.displayName}</span>
          <span className="text-xs text-ink-3">{formatHandle(post.channel.username)}</span>
        </button>
      </Td>
      <Td>
        <PlatformMark platform={post.channel.platform} withLabel />
      </Td>
      <Td className={cn('whitespace-nowrap tabular', overdue ? 'text-warning' : 'text-ink')}>
        {post.scheduledAt ? formatScheduleLabel(new Date(post.scheduledAt), now) : '—'}
      </Td>
      <Td>
        <PostStatusBadge status={post.status} overdue={overdue} />
      </Td>
      <Td className="max-w-0 w-full">
        <p className="truncate text-ink-2" title={post.caption}>
          {truncate(post.caption, 120) || <span className="text-ink-4">Sem legenda</span>}
        </p>
      </Td>
      <Td className="pr-2">
        <ActionMenu
          label={`Ações do post de ${post.channel.displayName}`}
          items={[
            { label: 'Ver detalhes', icon: Eye, onSelect: onOpen },
            { label: 'Editar', icon: Pencil, onSelect: onEdit, disabled: !isEditable(post.status) },
            { label: 'Duplicar para outro canal', icon: CopyPlus, onSelect: onDuplicate },
            'separator',
            {
              label: 'Cancelar post',
              icon: Ban,
              tone: 'danger',
              onSelect: onCancel,
              disabled: !canCancel(post.status),
            },
          ]}
        />
      </Td>
    </Tr>
  );
}
