import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useServices } from '@/app/ServicesContext';
import { useInvalidate } from '@/hooks/useInvalidate';
import { queryKeys } from '@/lib/queryKeys';
import { SECRET_NAMES } from '@/services/desktop/DesktopBridge';
import type { Id } from '@/types';

import type { PlanConfirmation } from './postPlanner';

/** Qual IA está ativa (OpenAI com chave configurada, ou o simulador local). */
export function useAiStatus() {
  const { ai } = useServices();
  return useQuery({ queryKey: queryKeys.ai.status, queryFn: () => ai.describe() });
}

/** Grava/remove a chave da OpenAI no cofre do Windows. A chave nunca volta para a interface. */
export function useOpenAiKey() {
  const { desktop } = useServices();
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.ai.status });

  return {
    save: useMutation({
      mutationFn: (value: string) => desktop.setSecret(SECRET_NAMES.openaiApiKey, value),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: () => desktop.deleteSecret(SECRET_NAMES.openaiApiKey),
      onSuccess: refresh,
    }),
  };
}

export function useTestAiConnection() {
  const { ai } = useServices();
  return useMutation({ mutationFn: () => ai.testConnection() });
}

export function usePlanPost() {
  const { postPlanner } = useServices();
  return useMutation({
    mutationFn: ({ mediaId, instruction }: { mediaId: Id; instruction: string }) =>
      postPlanner.plan(mediaId, instruction),
  });
}

export function useConfirmPlan() {
  const { postPlanner } = useServices();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (confirmation: PlanConfirmation) => postPlanner.confirm(confirmation),
    onSuccess: () => invalidate('posts', 'dashboard', 'search'),
  });
}
