import { useQuery } from '@tanstack/react-query';

import { useServices } from '@/app/ServicesContext';
import { useSettingValue } from '@/features/settings/hooks';
import { WEEK_STARTS_ON_SETTING } from '@/features/settings/settingsService';
import { queryKeys } from '@/lib/queryKeys';
import { toDateInputValue } from '@/utils/date';

export function useDashboardMetrics(now: Date) {
  const { dashboard } = useServices();
  const weekStartsOn = useSettingValue(WEEK_STARTS_ON_SETTING);
  return useQuery({
    // O dia faz parte da chave: as métricas "de hoje" se renovam na virada do dia.
    queryKey: queryKeys.dashboard.metrics(toDateInputValue(now), weekStartsOn),
    queryFn: () => dashboard.getMetrics(now, weekStartsOn),
  });
}
