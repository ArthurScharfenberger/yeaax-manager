import { Clapperboard, LayoutGrid, List, Search, Upload } from 'lucide-react';

import { MediaThumbnail } from '@/components/MediaThumbnail';
import { MediaStatusBadge } from '@/components/StatusBadges';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Select } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { LoadingBlock } from '@/components/ui/Spinner';
import { Table, Td, Th, THead, Tr } from '@/components/ui/Table';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useUrlParams } from '@/hooks/useUrlParams';
import { getErrorMessage } from '@/lib/errors';
import { MEDIA_STATUS_LABELS } from '@/lib/labels';
import { type Media, MEDIA_STATUSES, type MediaStatus, mediaStatusSchema } from '@/types';
import { cn } from '@/utils/cn';
import { formatDate, formatDuration, formatFileSize, formatResolution } from '@/utils/format';

import { MediaDetailsPanel } from './components/MediaDetailsPanel';
import { MediaTile } from './components/MediaTile';
import { useImportMedia, useMedia, useMediaList, useTags } from './hooks';

type ViewMode = 'grid' | 'list';

const VIEW_OPTIONS = [
  { value: 'grid' as const, label: 'Grade', icon: LayoutGrid, iconOnly: true },
  { value: 'list' as const, label: 'Lista', icon: List, iconOnly: true },
];

/** Filtros e seleção ficam na URL: sobrevivem à navegação e permitem links internos. */
function useLibraryParams() {
  const { params, set, update } = useUrlParams();
  const status = mediaStatusSchema.safeParse(params.get('status'));

  return {
    query: params.get('q') ?? '',
    status: status.success ? status.data : undefined,
    tagId: params.get('tag') ?? undefined,
    view: params.get('view') === 'list' ? ('list' satisfies ViewMode) : ('grid' satisfies ViewMode),
    selectedId: params.get('media'),
    set,
    update,
  };
}

export function LibraryPage() {
  const { query, status, tagId, view, selectedId, set, update } = useLibraryParams();
  const search = useDebouncedValue(query, 200);
  const media = useMediaList({
    ...(search ? { search } : {}),
    ...(status ? { status } : {}),
    ...(tagId ? { tagId } : {}),
  });
  const total = useMediaList();
  const tags = useTags();
  const selected = useMedia(selectedId);
  const importMedia = useImportMedia();
  const hasFilters = Boolean(query || status || tagId);

  const select = (item: Media) => set('media', item.id === selectedId ? null : item.id);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Biblioteca"
        description={
          total.data
            ? `${total.data.length} vídeo(s) · arquivos permanecem no local original`
            : undefined
        }
        actions={
          <Button
            variant="primary"
            icon={Upload}
            loading={importMedia.isPending}
            onClick={() => importMedia.mutate()}
          >
            Importar vídeo
          </Button>
        }
      />

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-6 py-2.5">
            <div className="relative w-64">
              <Search
                size={14}
                className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-4"
                aria-hidden
              />
              <Input
                type="search"
                aria-label="Buscar por nome do arquivo"
                placeholder="Buscar por nome…"
                value={query}
                onChange={(event) => set('q', event.target.value)}
                className="w-full pl-8"
              />
            </div>
            <Select
              aria-label="Filtrar por status"
              value={status ?? ''}
              onChange={(event) => set('status', event.target.value)}
              className="w-40"
            >
              <option value="">Todos os status</option>
              {MEDIA_STATUSES.map((value: MediaStatus) => (
                <option key={value} value={value}>
                  {MEDIA_STATUS_LABELS[value]}
                </option>
              ))}
            </Select>
            <Select
              aria-label="Filtrar por tag"
              value={tagId ?? ''}
              onChange={(event) => set('tag', event.target.value)}
              className="w-44"
            >
              <option value="">Todas as tags</option>
              {tags.data?.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  #{tag.name} ({tag.usageCount})
                </option>
              ))}
            </Select>
            {hasFilters && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => update({ q: null, status: null, tag: null })}
              >
                Limpar filtros
              </Button>
            )}
            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs text-ink-3 tabular">
                {media.data?.length ?? 0} resultado(s)
              </span>
              <SegmentedControl
                label="Modo de visualização"
                value={view}
                options={VIEW_OPTIONS}
                onChange={(value) => set('view', value === 'grid' ? null : value)}
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto">
            {media.isPending && <LoadingBlock />}
            {media.isError && (
              <Notice tone="danger" className="m-6">
                {getErrorMessage(media.error)}
              </Notice>
            )}
            {media.isSuccess && media.data.length === 0 && (
              <EmptyState
                icon={Clapperboard}
                title={hasFilters ? 'Nenhum vídeo com estes filtros' : 'Sua biblioteca está vazia'}
                description={
                  hasFilters
                    ? 'Ajuste a busca ou limpe os filtros.'
                    : 'Importe arquivos .mp4, .mov ou .webm. Eles não são copiados: o app guarda apenas o caminho.'
                }
                action={
                  !hasFilters && (
                    <Button variant="primary" icon={Upload} onClick={() => importMedia.mutate()}>
                      Importar vídeo
                    </Button>
                  )
                }
              />
            )}
            {media.isSuccess && media.data.length > 0 && view === 'grid' && (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-3 p-6">
                {media.data.map((item) => (
                  <MediaTile
                    key={item.id}
                    media={item}
                    selected={item.id === selectedId}
                    onSelect={() => select(item)}
                  />
                ))}
              </div>
            )}
            {media.isSuccess && media.data.length > 0 && view === 'list' && (
              <MediaListView items={media.data} selectedId={selectedId} onSelect={select} />
            )}
          </div>
        </div>

        {selected.data && (
          <MediaDetailsPanel media={selected.data} onClose={() => set('media', null)} />
        )}
      </div>
    </div>
  );
}

interface MediaListViewProps {
  items: Media[];
  selectedId: string | null;
  onSelect: (item: Media) => void;
}

function MediaListView({ items, selectedId, onSelect }: MediaListViewProps) {
  return (
    <Table>
      <THead>
        <tr>
          <Th className="w-14">
            <span className="sr-only">Miniatura</span>
          </Th>
          <Th>Nome</Th>
          <Th>Duração</Th>
          <Th>Resolução</Th>
          <Th>Tamanho</Th>
          <Th>Tags</Th>
          <Th>Status</Th>
          <Th>Importado em</Th>
        </tr>
      </THead>
      <tbody>
        {items.map((item) => (
          <Tr
            key={item.id}
            onClick={() => onSelect(item)}
            aria-selected={item.id === selectedId}
            className={cn(item.id === selectedId && 'bg-accent-subtle hover:bg-accent-subtle')}
          >
            <Td className="py-1.5 pl-6">
              <MediaThumbnail media={item} showDuration={false} className="aspect-[3/4] w-8" />
            </Td>
            <Td className="max-w-72">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onSelect(item);
                }}
                className="block max-w-full truncate text-left font-medium text-ink hover:underline"
                title={item.filename}
              >
                {item.filename}
              </button>
            </Td>
            <Td className="tabular">{formatDuration(item.duration)}</Td>
            <Td className="tabular text-ink-2">{formatResolution(item.width, item.height)}</Td>
            <Td className="tabular text-ink-2">{formatFileSize(item.size)}</Td>
            <Td className="text-xs text-ink-3">
              {item.tags.map((tag) => `#${tag.name}`).join(' ') || '—'}
            </Td>
            <Td>
              <MediaStatusBadge status={item.status} />
            </Td>
            <Td className="tabular text-ink-2">{formatDate(new Date(item.createdAt))}</Td>
          </Tr>
        ))}
      </tbody>
    </Table>
  );
}
