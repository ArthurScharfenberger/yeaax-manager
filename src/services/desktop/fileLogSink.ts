import { debug, error, info, warn } from '@tauri-apps/plugin-log';

import type { LogEntry, LogLevel, LogSink } from '@/lib/logger';

const WRITERS: Record<LogLevel, (message: string) => Promise<void>> = { debug, info, warn, error };

function format(entry: LogEntry): string {
  if (!entry.context) return entry.message;
  try {
    return `${entry.message} ${JSON.stringify(entry.context)}`;
  } catch {
    return `${entry.message} [contexto não serializável]`;
  }
}

/**
 * Envia as entradas do logger (já redigidas) para o arquivo de log do app via
 * tauri-plugin-log. Rotação e nível mínimo são configurados no Rust (src-tauri/src/lib.rs).
 */
export function createFileLogSink(): LogSink {
  return (entry) => {
    // Falha ao gravar o log nunca deve quebrar o app nem gerar novo log (evita laço).
    WRITERS[entry.level](format(entry)).catch(() => undefined);
  };
}
