import { useSettingValue } from '@/features/settings/hooks';
import { WEEK_STARTS_ON_SETTING } from '@/features/settings/settingsService';
import { startOfWeek } from '@/utils/date';
import { formatWeekRange } from '@/utils/format';

import { useDashboardMetrics } from '../hooks';

interface MetricProps {
  label: string;
  value: number | undefined;
  hint: string;
}

function Metric({ label, value, hint }: MetricProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1 px-5 py-4">
      <dt className="text-xs text-ink-3">{label}</dt>
      <dd className="text-2xl font-semibold text-ink tabular">{value ?? '–'}</dd>
      <dd className="truncate text-xs text-ink-3">{hint}</dd>
    </div>
  );
}

/** Faixa única com as métricas rápidas (sem cards flutuantes). */
export function MetricsBar({ now }: { now: Date }) {
  const metrics = useDashboardMetrics(now);
  const weekStartsOn = useSettingValue(WEEK_STARTS_ON_SETTING);
  const data = metrics.data;

  return (
    <dl
      aria-label="Métricas rápidas"
      aria-busy={metrics.isPending}
      className="grid grid-cols-2 divide-line rounded-md border border-line lg:grid-cols-4 lg:divide-x"
    >
      <Metric
        label="Canais ativos"
        value={data?.activeChannels}
        hint={data ? `de ${data.totalChannels} canais cadastrados` : 'carregando'}
      />
      <Metric
        label="Posts hoje"
        value={data?.postsToday}
        hint="agendados, publicados ou com falha"
      />
      <Metric label="Rascunhos" value={data?.drafts} hint="aguardando edição" />
      <Metric
        label="Publicados na semana"
        value={data?.publishedThisWeek}
        hint={formatWeekRange(startOfWeek(now, weekStartsOn))}
      />
    </dl>
  );
}
