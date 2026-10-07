import { Ban, CopyPlus, Eye, Pencil, Trash2 } from 'lucide-react';

import { MediaThumbnail } from '@/components/MediaThumbnail';
import { PlatformMark } from '@/components/PlatformMark';
import { PostStatusBadge } from '@/components/StatusBadges';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { Table, Td, Th, THead, Tr } from '@/components/ui/Table';
import type { PostWithRelations } from '@/types';
import { cn } from '@/utils/cn';
import { formatHandle, formatRelativeTime, formatScheduleLabel, truncate } from '@/utils/format';

import { canCancel, canDelete, isEditable, isOverdue } from '../postRules';

export interface PostRowActions {
  onOpen: (post: PostWithRelations) => void;
  onEdit: (post: PostWithRelations) => void;
  onDuplicate: (post: PostWithRelations) => void;
  onCancel: (post: PostWithRelations) => void;
  onDelete: (post: PostWithRelations) => void;
}

interface PostsTableProps extends PostRowActions {
  posts: PostWithRelations[];
  now: Date;
}

/** Lista completa de posts (página Posts). Linhas clicáveis; ações no menu "⋯". */
export function PostsTable({ posts, now, ...actions }: PostsTableProps) {
  return (
    <Table>
      <THead>
        <tr>
          <Th className="w-14 pl-6">
            <span className="sr-only">Miniatura</span>
          </Th>
          <Th>Canal</Th>
          <Th>Plataforma</Th>
          <Th>Horário</Th>
          <Th>Status</Th>
          <Th>Legenda</Th>
          <Th>Alterado</Th>
          <Th className="w-10">
            <span className="sr-only">Ações</span>
          </Th>
        </tr>
      </THead>
      <tbody>
        {posts.map((post) => (
          <PostRow key={post.id} post={post} now={now} {...actions} />
        ))}
      </tbody>
    </Table>
  );
}

function PostRow({
  post,
  now,
  onOpen,
  onEdit,
  onDuplicate,
  onCancel,
  onDelete,
}: PostRowActions & {
  post: PostWithRelations;
  now: Date;
}) {
  const overdue = isOverdue(post, now);
  return (
    <Tr onClick={() => onOpen(post)}>
      <Td className="py-1.5 pl-6">
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
            onOpen(post);
          }}
          className="flex flex-col text-left"
        >
          <span className="font-medium whitespace-nowrap text-ink hover:underline">
            {post.channel.displayName}
          </span>
          <span className="text-xs text-ink-3">{formatHandle(post.channel.username)}</span>
        </button>
      </Td>
      <Td>
        <PlatformMark platform={post.channel.platform} withLabel />
      </Td>
      <Td className={cn('whitespace-nowrap tabular', overdue ? 'text-warning' : 'text-ink')}>
        {post.scheduledAt ? (
          formatScheduleLabel(new Date(post.scheduledAt), now)
        ) : (
          <span className="text-ink-3">Sem data</span>
        )}
      </Td>
      <Td>
        <PostStatusBadge status={post.status} overdue={overdue} />
      </Td>
      <Td className="w-full max-w-0">
        <p className="truncate text-ink-2" title={post.caption}>
          {truncate(post.caption, 140) || <span className="text-ink-4">Sem legenda</span>}
        </p>
      </Td>
      <Td className="text-xs whitespace-nowrap text-ink-3">
        <time dateTime={post.updatedAt}>{formatRelativeTime(new Date(post.updatedAt), now)}</time>
      </Td>
      <Td className="pr-4">
        <ActionMenu
          label={`Ações do post de ${post.channel.displayName}`}
          items={[
            { label: 'Ver detalhes', icon: Eye, onSelect: () => onOpen(post) },
            {
              label: 'Editar',
              icon: Pencil,
              onSelect: () => onEdit(post),
              disabled: !isEditable(post.status),
            },
            {
              label: 'Duplicar para outro canal',
              icon: CopyPlus,
              onSelect: () => onDuplicate(post),
            },
            'separator',
            {
              label: 'Cancelar post',
              icon: Ban,
              tone: 'danger',
              onSelect: () => onCancel(post),
              disabled: !canCancel(post.status),
            },
            {
              label: 'Excluir',
              icon: Trash2,
              tone: 'danger',
              onSelect: () => onDelete(post),
              disabled: !canDelete(post.status),
            },
          ]}
        />
      </Td>
    </Tr>
  );
}
