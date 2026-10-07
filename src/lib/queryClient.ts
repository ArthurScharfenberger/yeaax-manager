import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { isExpectedError } from './errors';
import { logger } from './logger';

/** Regras de negócio violadas (validação, conflito) são `warn`; falhas reais são `error`. */
function logFailure(message: string, error: unknown, context: Record<string, unknown>): void {
  if (isExpectedError(error)) logger.warn(message, { ...context, error });
  else logger.error(message, { ...context, error });
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        logFailure('Falha ao carregar dados', error, { queryKey: query.queryKey });
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        logFailure('Operação não concluída', error, {
          mutationKey: mutation.options.mutationKey,
        });
      },
    }),
    defaultOptions: {
      queries: {
        // Dados locais: baratos de buscar, mas sem refetch agressivo.
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: 0 },
    },
  });
}
