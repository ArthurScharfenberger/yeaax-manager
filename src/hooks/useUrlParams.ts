import { useCallback } from 'react';
import { useSearchParams } from 'react-router';

/**
 * Parâmetros de busca da URL (hash) como estado de filtros/seleção.
 * `update` aplica várias mudanças de uma vez — chamadas separadas de `setSearchParams`
 * no mesmo tick se sobrescrevem. Valores `null` ou vazios removem o parâmetro.
 */
export function useUrlParams() {
  const [params, setParams] = useSearchParams();

  const update = useCallback(
    (changes: Record<string, string | null>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);
          for (const [key, value] of Object.entries(changes)) {
            if (value) next.set(key, value);
            else next.delete(key);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const set = useCallback(
    (key: string, value: string | null) => {
      update({ [key]: value });
    },
    [update],
  );

  return { params, update, set };
}
