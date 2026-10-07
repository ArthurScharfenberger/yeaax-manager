import { useMutation, useQuery } from '@tanstack/react-query';

import { useServices } from '@/app/ServicesContext';
import { useInvalidate } from '@/hooks/useInvalidate';
import { queryKeys } from '@/lib/queryKeys';
import type { Id } from '@/types';

import type { NewChannelInput } from './channelService';

const AFFECTED = ['channels', 'posts', 'dashboard', 'search'] as const;

export function useChannels() {
  const { channels } = useServices();
  return useQuery({ queryKey: queryKeys.channels.all, queryFn: () => channels.list() });
}

export function useConnectNewChannel() {
  const { channels } = useServices();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (input: NewChannelInput) => channels.connectNew(input),
    onSuccess: () => invalidate(...AFFECTED),
  });
}

/** Conectar, desconectar, sincronizar ou remover um canal existente. */
export function useChannelAction() {
  const { channels } = useServices();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({
      id,
      action,
    }: {
      id: Id;
      action: 'connect' | 'disconnect' | 'sync' | 'remove';
    }) => channels[action](id),
    onSuccess: () => invalidate(...AFFECTED),
  });
}
