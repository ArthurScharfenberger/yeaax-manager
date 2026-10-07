import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import type { QueryDomain } from '@/lib/queryKeys';

/** Invalida grupos de queries pelo domínio (primeira posição da chave). */
export function useInvalidate() {
  const queryClient = useQueryClient();
  return useCallback(
    (...domains: QueryDomain[]) =>
      Promise.all(domains.map((domain) => queryClient.invalidateQueries({ queryKey: [domain] }))),
    [queryClient],
  );
}
