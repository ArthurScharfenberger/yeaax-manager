import { useQuery } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

import { useServices } from '@/app/ServicesContext';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { SettingRow } from '@/components/ui/SettingRow';
import { type LogLevel, logger } from '@/lib/logger';
import { queryKeys } from '@/lib/queryKeys';
import { APP_NAME, APP_VERSION } from '@/lib/runtime';
import { formatTime } from '@/utils/format';

const LEVEL_TONES: Record<LogLevel, BadgeTone> = {
  debug: 'neutral',
  info: 'info',
  warn: 'warning',
  error: 'danger',
};

const STACK =
  'Tauri 2 · React 19 · TypeScript · Vite · Tailwind CSS 4 · SQLite · TanStack Query · Zod';
const VISIBLE_LOGS = 60;

function useLogEntries() {
  return useSyncExternalStore(
    (listener) => logger.subscribe(listener),
    () => logger.getEntries(),
  );
}

export function AboutSection() {
  const { mode, desktop } = useServices();
  const entries = useLogEntries();
  const logDirectory = useQuery({
    queryKey: queryKeys.system.logDirectory,
    queryFn: () => desktop.getLogDirectory(),
  });
  const recent = entries.slice(-VISIBLE_LOGS).reverse();

  return (
    <>
      <SettingRow
        label={APP_NAME}
        description="Central local-first de conteúdo para TikTok e Instagram."
      >
        <span className="font-mono text-xs text-ink-2">v{APP_VERSION}</span>
      </SettingRow>
      <SettingRow label="Modo de execução">
        <span className="text-sm text-ink-2">
          {mode === 'desktop' ? 'Desktop (Tauri)' : 'Preview no navegador'}
        </span>
      </SettingRow>
      <SettingRow label="Stack">
        <span className="max-w-96 text-right text-xs text-ink-2">{STACK}</span>
      </SettingRow>
      <SettingRow
        label="Documentação"
        description="README.md, AGENTS.md e a pasta docs/ no repositório do projeto."
      >
        <span className="font-mono text-xs text-ink-2">docs/</span>
      </SettingRow>
      <SettingRow
        label="Arquivos de log"
        description="Até 5 MB por arquivo; os 5 mais recentes são mantidos. Dados sensíveis são ocultados."
      >
        <span className="max-w-80 text-right font-mono text-2xs break-all text-ink-2">
          {mode === 'preview' ? 'Indisponível no modo preview' : (logDirectory.data ?? '…')}
        </span>
      </SettingRow>

      <section className="pt-4">
        <h3 className="mb-2 text-sm font-medium text-ink">Logs recentes</h3>
        <p className="mb-2 text-xs text-ink-3">
          Últimos registros desta sessão. No app desktop, também são gravados nos arquivos de log.
        </p>
        <ol className="max-h-80 overflow-y-auto rounded-md border border-line bg-sunken font-mono text-2xs">
          {recent.length === 0 && <li className="px-3 py-2 text-ink-3">Nenhum registro.</li>}
          {recent.map((entry) => (
            <li
              key={entry.id}
              className="flex items-start gap-2 border-b border-line px-3 py-1.5 last:border-b-0"
            >
              <time dateTime={entry.timestamp} className="shrink-0 text-ink-3 tabular">
                {formatTime(new Date(entry.timestamp))}
              </time>
              <Badge tone={LEVEL_TONES[entry.level]} className="font-sans">
                {entry.level}
              </Badge>
              <span className="min-w-0 break-words text-ink-2">
                {entry.message}
                {entry.context && (
                  <span className="text-ink-3"> {JSON.stringify(entry.context)}</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
