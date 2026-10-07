import { RotateCcw, Save } from 'lucide-react';
import { useId, useState } from 'react';

import { PlatformMark } from '@/components/PlatformMark';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input, Select } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { SettingRow } from '@/components/ui/SettingRow';
import { LoadingBlock } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/toastContext';
import { useSetting, useUpdateSetting } from '@/features/settings/hooks';
import { PLATFORM_INFO } from '@/lib/platforms';
import { type Platform, PLATFORMS } from '@/types';

import {
  AUTO_SCHEDULE_SETTING,
  type AutoScheduleConfig,
  autoScheduleConfigSchema,
  DEFAULT_AUTO_SCHEDULE_CONFIG,
  planDailySlots,
} from './autoSchedule';

const INTERVAL_OPTIONS = [60, 120, 180, 240, 360, 480];

export function AutomationPage() {
  const setting = useSetting(AUTO_SCHEDULE_SETTING);

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Automação"
        description="Regras para distribuir posts automaticamente entre os canais."
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
          <Notice tone="warning" title="Execução automática ainda não implementada">
            A configuração é salva localmente e será usada pelo motor de automação (Fase 2). Por
            enquanto nenhum post é agendado automaticamente.
          </Notice>
          {setting.isPending ? (
            <LoadingBlock />
          ) : (
            <AutoScheduleForm initial={setting.data ?? DEFAULT_AUTO_SCHEDULE_CONFIG} />
          )}
        </div>
      </div>
    </div>
  );
}

function AutoScheduleForm({ initial }: { initial: AutoScheduleConfig }) {
  const ids = { posts: useId(), interval: useId(), start: useId(), end: useId() };
  const [config, setConfig] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const save = useUpdateSetting(AUTO_SCHEDULE_SETTING);
  const toast = useToast();

  const validation = autoScheduleConfigSchema.safeParse(config);
  const validationError = validation.success ? null : (validation.error.issues[0]?.message ?? null);
  const plan = planDailySlots(config);
  const dirty = JSON.stringify(config) !== JSON.stringify(saved);

  function patch(changes: Partial<AutoScheduleConfig>) {
    setConfig((current) => ({ ...current, ...changes }));
  }

  function togglePlatform(platform: Platform, enabled: boolean) {
    patch({
      platforms: enabled
        ? PLATFORMS.filter((item) => item === platform || config.platforms.includes(item))
        : config.platforms.filter((item) => item !== platform),
    });
  }

  function handleSave() {
    save.mutate(config, {
      onSuccess: (value) => {
        setSaved(value);
        toast.success('Configuração do Auto Schedule salva');
      },
      onError: (error) => toast.error(error),
    });
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <Panel title="Auto Schedule" actions={<Badge>Inativo · em breve</Badge>} bodyClassName="px-4">
        <SettingRow
          label="Posts por dia"
          description="Por canal, entre 1 e 12."
          htmlFor={ids.posts}
        >
          <Input
            id={ids.posts}
            type="number"
            min={1}
            max={12}
            value={config.postsPerDay}
            onChange={(event) => patch({ postsPerDay: Number(event.target.value) })}
            className="w-20 text-right tabular"
          />
        </SettingRow>
        <SettingRow label="Plataformas" description="Onde o Auto Schedule poderá agendar.">
          {PLATFORMS.map((platform) => (
            <Checkbox
              key={platform}
              label={PLATFORM_INFO[platform].label}
              checked={config.platforms.includes(platform)}
              onChange={(event) => togglePlatform(platform, event.target.checked)}
              className="ml-3"
            />
          ))}
        </SettingRow>
        <SettingRow
          label="Intervalo mínimo"
          description="Entre dois posts do mesmo canal."
          htmlFor={ids.interval}
        >
          <Select
            id={ids.interval}
            value={config.minIntervalMinutes}
            onChange={(event) => patch({ minIntervalMinutes: Number(event.target.value) })}
            className="w-32"
          >
            {INTERVAL_OPTIONS.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes / 60} {minutes === 60 ? 'hora' : 'horas'}
              </option>
            ))}
          </Select>
        </SettingRow>
        <SettingRow label="Período" description="Janela diária permitida para publicações.">
          <label htmlFor={ids.start} className="sr-only">
            Início do período
          </label>
          <Input
            id={ids.start}
            type="time"
            value={config.windowStart}
            onChange={(event) => patch({ windowStart: event.target.value })}
            className="w-28"
          />
          <span className="text-ink-3" aria-hidden>
            —
          </span>
          <label htmlFor={ids.end} className="sr-only">
            Fim do período
          </label>
          <Input
            id={ids.end}
            type="time"
            value={config.windowEnd}
            onChange={(event) => patch({ windowEnd: event.target.value })}
            className="w-28"
          />
        </SettingRow>
        <SettingRow
          label="Priorizar melhores horários"
          description="Usará os horários de maior engajamento quando o Analytics estiver conectado."
        >
          <Checkbox
            label={<span className="sr-only">Priorizar melhores horários</span>}
            checked={config.preferBestTimes}
            onChange={(event) => patch({ preferBestTimes: event.target.checked })}
          />
        </SettingRow>
        <SettingRow
          label="Evitar conteúdos semelhantes no mesmo dia"
          description="Baseado nas tags da biblioteca (ex.: não publicar dois vídeos #carros seguidos)."
        >
          <Checkbox
            label={<span className="sr-only">Evitar conteúdos semelhantes no mesmo dia</span>}
            checked={config.avoidSimilarSameDay}
            onChange={(event) => patch({ avoidSimilarSameDay: event.target.checked })}
          />
        </SettingRow>

        <div className="flex items-center justify-between gap-3 border-t border-line py-3">
          <p className="text-xs text-danger" role={validationError ? 'alert' : undefined}>
            {validationError}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              icon={RotateCcw}
              onClick={() => setConfig(DEFAULT_AUTO_SCHEDULE_CONFIG)}
            >
              Restaurar padrão
            </Button>
            <Button
              size="sm"
              variant="primary"
              icon={Save}
              disabled={!dirty || validationError !== null}
              loading={save.isPending}
              onClick={handleSave}
            >
              Salvar
            </Button>
          </div>
        </div>
      </Panel>

      <Panel title="Prévia do dia" meta="horários sugeridos">
        <div className="flex flex-col gap-3 p-4">
          {config.platforms.length === 0 && (
            <p className="text-xs text-ink-3">Selecione ao menos uma plataforma.</p>
          )}
          {config.platforms.map((platform) => (
            <div key={platform} className="flex flex-col gap-2">
              <PlatformMark platform={platform} withLabel />
              <div className="flex flex-wrap gap-1.5">
                {plan.slots.map((slot) => (
                  <span
                    key={slot}
                    className="rounded-sm border border-line bg-sunken px-2 py-0.5 text-xs text-ink tabular"
                  >
                    {slot}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {!plan.feasible && plan.maxPostsInWindow > 0 && (
            <Notice tone="warning">
              Com esse intervalo cabem no máximo {plan.maxPostsInWindow} post(s) no período.
            </Notice>
          )}
          <p className="text-2xs text-ink-3">
            Distribuição uniforme com margens iguais, alinhada a 15 minutos.
          </p>
        </div>
      </Panel>
    </div>
  );
}
