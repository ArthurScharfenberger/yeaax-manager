import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useServices } from '@/app/ServicesContext';
import { queryKeys } from '@/lib/queryKeys';
import type { SettingDefinition } from '@/lib/settings';

export function useSetting<T>(definition: SettingDefinition<T>) {
  const { settings } = useServices();
  return useQuery({
    queryKey: queryKeys.settings.key(definition.key),
    queryFn: () => settings.get(definition),
  });
}

/** Valor da configuração, usando o padrão enquanto carrega. */
export function useSettingValue<T>(definition: SettingDefinition<T>): T {
  return useSetting(definition).data ?? definition.defaultValue;
}

export function useUpdateSetting<T>(definition: SettingDefinition<T>) {
  const { settings } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (value: T) => settings.set(definition, value),
    onSuccess: (value) => {
      queryClient.setQueryData(queryKeys.settings.key(definition.key), value);
    },
  });
}
