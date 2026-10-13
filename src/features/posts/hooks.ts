import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useServices } from '@/app/ServicesContext';
import type { PostFilters } from '@/db/repositories';
import { useInvalidate } from '@/hooks/useInvalidate';
import { queryKeys } from '@/lib/queryKeys';
import type { Channel, Id } from '@/types';

import type { PostInput } from './postService';

const AFFECTED = ['posts', 'dashboard', 'search'] as const;

export function usePosts(filters: PostFilters) {
  const { posts } = useServices();
  return useQuery({
    queryKey: queryKeys.posts.list(filters),
    queryFn: () => posts.listDetailed(filters),
  });
}

export function usePost(id: Id | null) {
  const { posts } = useServices();
  return useQuery({
    queryKey: queryKeys.posts.detail(id ?? ''),
    queryFn: () => posts.getDetailed(id ?? ''),
    enabled: id !== null,
  });
}

export function usePostHistory(id: Id) {
  const { posts } = useServices();
  return useQuery({
    queryKey: queryKeys.posts.history(id),
    queryFn: () => posts.getHistory(id),
  });
}

/**
 * O que a conta do TikTok pode publicar agora (`creator_info`). As diretrizes exigem buscar de novo sempre que a
 * tela de publicação abre — por isso sem cache (`staleTime: 0`, `gcTime: 0`) e sem novas tentativas automáticas.
 */
export function useCreatorInfo(channel: Channel | undefined) {
  const { social } = useServices();
  const provider = channel ? social[channel.platform] : null;
  const supported = provider !== null && 'getCreatorInfo' in provider;
  return useQuery({
    queryKey: queryKeys.channels.creatorInfo(channel?.id ?? ''),
    queryFn: () => {
      if (!channel || !provider?.getCreatorInfo) throw new Error('creator_info indisponível');
      return provider.getCreatorInfo({
        channelId: channel.id,
        platform: channel.platform,
        username: channel.username,
      });
    },
    enabled: supported && channel?.status === 'connected',
    staleTime: 0,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

export function useSavePost() {
  const { posts } = useServices();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, input }: { id: Id | null; input: PostInput }) =>
      id ? posts.update(id, input) : posts.create(input),
    onSuccess: () => invalidate(...AFFECTED),
  });
}

export function useReschedulePost() {
  const { posts } = useServices();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, scheduledAt }: { id: Id; scheduledAt: Date }) =>
      posts.reschedule(id, scheduledAt),
    onSuccess: () => invalidate(...AFFECTED),
  });
}

export function useDuplicatePost() {
  const { posts } = useServices();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, channelIds }: { id: Id; channelIds: Id[] }) =>
      posts.duplicateToChannels(id, channelIds),
    onSuccess: () => invalidate(...AFFECTED),
  });
}

export function useCancelPost() {
  const { posts } = useServices();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: Id) => posts.cancel(id),
    onSuccess: () => invalidate(...AFFECTED),
  });
}

export function useDeletePost() {
  const { posts } = useServices();
  const queryClient = useQueryClient();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: Id) => posts.remove(id),
    onSuccess: async (_data, id) => {
      // Não recarrega detalhe/histórico do post excluído (ainda montados até o diálogo fechar).
      await queryClient.invalidateQueries({
        queryKey: queryKeys.posts.all,
        predicate: (query) => !query.queryKey.includes(id),
      });
      await invalidate('dashboard', 'search');
    },
  });
}
