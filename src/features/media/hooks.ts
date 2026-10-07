import { useMutation, useQuery } from '@tanstack/react-query';

import { useServices } from '@/app/ServicesContext';
import { useToast } from '@/components/ui/toastContext';
import type { MediaFilters } from '@/db/repositories';
import { useInvalidate } from '@/hooks/useInvalidate';
import { isDemoMediaPath } from '@/lib/demo';
import { queryKeys } from '@/lib/queryKeys';
import type { Id, MediaStatus } from '@/types';

const AFFECTED = ['media', 'posts', 'search'] as const;

export function useMediaList(filters: MediaFilters = {}) {
  const { media } = useServices();
  return useQuery({ queryKey: queryKeys.media.list(filters), queryFn: () => media.list(filters) });
}

export function useMedia(id: Id | null) {
  const { media } = useServices();
  return useQuery({
    queryKey: queryKeys.media.detail(id ?? ''),
    queryFn: () => media.getById(id ?? ''),
    enabled: id !== null,
  });
}

export function useTags() {
  const { media } = useServices();
  return useQuery({ queryKey: queryKeys.media.tags, queryFn: () => media.listTags() });
}

/**
 * Verifica se o arquivo original ainda existe (e o autoriza para preview na sessão).
 * Mídias de demonstração não têm arquivo real.
 */
export function useMediaFile(path: string | null) {
  const { desktop } = useServices();
  const enabled = path !== null && desktop.mode === 'desktop' && !isDemoMediaPath(path);
  return useQuery({
    queryKey: queryKeys.media.file(path ?? ''),
    queryFn: () => desktop.inspectMediaFile(path ?? ''),
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}

/** Abre o seletor nativo, importa e mostra o resumo em um toast. */
export function useImportMedia() {
  const { media } = useServices();
  const invalidate = useInvalidate();
  const toast = useToast();

  return useMutation({
    mutationFn: () => media.importFromPicker(),
    onSuccess: async ({ imported, skipped }) => {
      await invalidate(...AFFECTED);
      if (imported.length === 0 && skipped.length === 0) return;

      const skippedText = skipped
        .slice(0, 3)
        .map((item) => `${item.path.split(/[\\/]/).pop() ?? item.path}: ${item.reason}`)
        .join(' · ');

      if (imported.length > 0) {
        toast.success(
          imported.length === 1 ? '1 vídeo importado' : `${imported.length} vídeos importados`,
          skipped.length > 0 ? `${skipped.length} ignorado(s) — ${skippedText}` : undefined,
        );
      } else {
        toast.info('Nenhum vídeo importado', skippedText);
      }
    },
    onError: (error) => toast.error(error, 'Falha ao importar'),
  });
}

export function useMediaMutations() {
  const { media } = useServices();
  const invalidate = useInvalidate();
  const onSuccess = () => invalidate(...AFFECTED);

  return {
    updateStatus: useMutation({
      mutationFn: ({ id, status }: { id: Id; status: MediaStatus }) =>
        media.updateStatus(id, status),
      onSuccess,
    }),
    addTag: useMutation({
      mutationFn: ({ id, name }: { id: Id; name: string }) => media.addTag(id, name),
      onSuccess,
    }),
    removeTag: useMutation({
      mutationFn: ({ id, tagId }: { id: Id; tagId: Id }) => media.removeTag(id, tagId),
      onSuccess,
    }),
    remove: useMutation({ mutationFn: (id: Id) => media.remove(id), onSuccess }),
  };
}
