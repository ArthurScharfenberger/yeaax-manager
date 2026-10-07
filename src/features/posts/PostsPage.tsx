import { FileText, Plus, Search } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Select } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingBlock } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/toastContext';
import type { PostFilters } from '@/db/repositories';
import { useChannels } from '@/features/channels/hooks';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useNow } from '@/hooks/useNow';
import { useUrlParams } from '@/hooks/useUrlParams';
import { getErrorMessage } from '@/lib/errors';
import { POST_STATUS_LABELS } from '@/lib/labels';
import { PLATFORM_INFO } from '@/lib/platforms';
import { POST_STATUSES, postStatusSchema, type PostWithRelations } from '@/types';
import { formatHandle } from '@/utils/format';

import { PostsTable } from './components/PostsTable';
import { useCancelPost, useDeletePost, usePosts } from './hooks';
import { usePostDialogs } from './postDialogsContext';

const DATE_FILTERS = {
  all: 'Todas as datas',
  upcoming: 'Próximos',
  past: 'Passados',
  unscheduled: 'Sem data',
} as const;
type DateFilter = keyof typeof DATE_FILTERS;

const SORTS = {
  scheduled: 'Ordenar por data do post',
  updated: 'Alterados recentemente',
} as const;
type Sort = keyof typeof SORTS;

function isKeyOf<T extends object>(
  map: T,
  value: string | null,
): value is Extract<keyof T, string> {
  return value !== null && Object.hasOwn(map, value);
}

/** Filtros na URL: sobrevivem à navegação e permitem links internos (ex.: `/posts?date=unscheduled`). */
function usePostsParams() {
  const { params, set, update } = useUrlParams();
  const status = postStatusSchema.safeParse(params.get('status'));
  const date = params.get('date');
  const sort = params.get('sort');
  return {
    query: params.get('q') ?? '',
    status: status.success ? status.data : undefined,
    channelId: params.get('channel') ?? undefined,
    date: isKeyOf(DATE_FILTERS, date) ? date : ('all' satisfies DateFilter),
    sort: isKeyOf(SORTS, sort) ? sort : ('scheduled' satisfies Sort),
    set,
    update,
  };
}

function toFilters(
  options: Omit<ReturnType<typeof usePostsParams>, 'set' | 'update' | 'query'> & {
    search: string;
    now: Date;
  },
): PostFilters {
  // "Agora" arredondado ao minuto: a chave da query só muda uma vez por minuto.
  const minute = new Date(options.now);
  minute.setSeconds(0, 0);
  return {
    ...(options.search ? { search: options.search } : {}),
    ...(options.status ? { statuses: [options.status] } : {}),
    ...(options.channelId ? { channelId: options.channelId } : {}),
    ...(options.date === 'upcoming' ? { scheduledFrom: minute.toISOString() } : {}),
    ...(options.date === 'past' ? { scheduledTo: minute.toISOString() } : {}),
    ...(options.date === 'unscheduled' ? { hasSchedule: false } : {}),
    order: options.sort === 'updated' ? 'updated_desc' : 'scheduled_asc',
  };
}

export function PostsPage() {
  const now = useNow();
  const { query, status, channelId, date, sort, set, update } = usePostsParams();
  const search = useDebouncedValue(query.trim(), 200);
  const posts = usePosts(toFilters({ search, status, channelId, date, sort, now }));
  const channels = useChannels();
  const { openComposer, openDetails, openDuplicate } = usePostDialogs();
  const [confirm, setConfirm] = useState<{
    kind: 'cancel' | 'delete';
    post: PostWithRelations;
  } | null>(null);
  const cancelPost = useCancelPost();
  const deletePost = useDeletePost();
  const toast = useToast();
  const hasFilters = Boolean(query || status || channelId || date !== 'all');

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Posts"
        description="Todos os posts, inclusive rascunhos sem data."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => openComposer()}>
            Novo post
          </Button>
        }
      />

      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-6 py-2.5">
        <div className="relative w-64">
          <Search
            size={14}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-4"
            aria-hidden
          />
          <Input
            type="search"
            aria-label="Buscar na legenda ou no canal"
            placeholder="Buscar legenda ou canal…"
            value={query}
            onChange={(event) => set('q', event.target.value)}
            className="w-full pl-8"
          />
        </div>
        <Select
          aria-label="Filtrar por status"
          value={status ?? ''}
          onChange={(event) => set('status', event.target.value)}
          className="w-36"
        >
          <option value="">Todos os status</option>
          {POST_STATUSES.map((value) => (
            <option key={value} value={value}>
              {POST_STATUS_LABELS[value]}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filtrar por canal"
          value={channelId ?? ''}
          onChange={(event) => set('channel', event.target.value)}
          className="w-52"
        >
          <option value="">Todos os canais</option>
          {channels.data?.map((channel) => (
            <option key={channel.id} value={channel.id}>
              {channel.displayName} · {formatHandle(channel.username)} (
              {PLATFORM_INFO[channel.platform].label})
            </option>
          ))}
        </Select>
        <Select
          aria-label="Filtrar por data"
          value={date}
          onChange={(event) =>
            set('date', event.target.value === 'all' ? null : event.target.value)
          }
          className="w-36"
        >
          {Object.entries(DATE_FILTERS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Ordenação"
          value={sort}
          onChange={(event) =>
            set('sort', event.target.value === 'scheduled' ? null : event.target.value)
          }
          className="w-52"
        >
          {Object.entries(SORTS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        {hasFilters && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => update({ q: null, status: null, channel: null, date: null })}
          >
            Limpar filtros
          </Button>
        )}
        <span className="ml-auto text-xs text-ink-3 tabular">
          {posts.data?.length ?? 0} post(s)
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {posts.isPending && <LoadingBlock />}
        {posts.isError && (
          <Notice tone="danger" className="m-6">
            {getErrorMessage(posts.error)}
          </Notice>
        )}
        {posts.isSuccess && posts.data.length === 0 && (
          <EmptyState
            icon={FileText}
            title={hasFilters ? 'Nenhum post com estes filtros' : 'Nenhum post ainda'}
            description={
              hasFilters
                ? 'Ajuste a busca ou limpe os filtros.'
                : 'Crie um post a partir de um vídeo da biblioteca.'
            }
            action={
              !hasFilters && (
                <Button variant="primary" icon={Plus} onClick={() => openComposer()}>
                  Novo post
                </Button>
              )
            }
          />
        )}
        {posts.isSuccess && posts.data.length > 0 && (
          <PostsTable
            posts={posts.data}
            now={now}
            onOpen={(post) => openDetails(post.id)}
            onEdit={(post) => openComposer({ postId: post.id })}
            onDuplicate={(post) => openDuplicate(post.id)}
            onCancel={(post) => setConfirm({ kind: 'cancel', post })}
            onDelete={(post) => setConfirm({ kind: 'delete', post })}
          />
        )}
      </div>

      {confirm?.kind === 'cancel' && (
        <ConfirmDialog
          title="Cancelar post?"
          description="O post sai da fila de publicação. Você pode reativá-lo como rascunho depois."
          confirmLabel="Cancelar post"
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await cancelPost.mutateAsync(confirm.post.id);
            toast.success('Post cancelado');
          }}
        />
      )}
      {confirm?.kind === 'delete' && (
        <ConfirmDialog
          title="Excluir post?"
          description="O post e seu histórico serão removidos permanentemente. O vídeo da biblioteca não é afetado."
          confirmLabel="Excluir"
          onClose={() => setConfirm(null)}
          onConfirm={async () => {
            await deletePost.mutateAsync(confirm.post.id);
            toast.success('Post excluído');
          }}
        />
      )}
    </div>
  );
}
