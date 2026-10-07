/**
 * Logger simples da aplicação.
 *
 * - Redige automaticamente campos sensíveis (tokens, segredos, senhas, chaves de API).
 * - Mantém as últimas entradas em memória para exibição em Configurações → Sobre.
 * - Em produção, apenas `warn` e `error` vão para o console.
 *
 * Use sempre `logger.*` em vez de `console.*` (regra de lint `no-console`).
 * Futuro: persistir em arquivo via tauri-plugin-log (ver docs/TODO.md).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: number;
  level: LogLevel;
  message: string;
  context: Record<string, unknown> | undefined;
  timestamp: string;
}

type LogListener = (entries: readonly LogEntry[]) => void;

/** Destino extra para cada entrada já redigida (ex.: arquivo de log no app desktop). */
export type LogSink = (entry: LogEntry) => void;

const MAX_ENTRIES = 200;
const MAX_DEPTH = 4;
const REDACTED = '[redacted]';
const SENSITIVE_KEY = /token|secret|password|passwd|authorization|api[-_]?key|cookie|credential/i;
const BEARER_VALUE = /bearer\s+[\w.~+/-]+=*/gi;

function serializeError(error: Error): Record<string, unknown> {
  const serialized: Record<string, unknown> = { name: error.name, message: error.message };
  if ('code' in error) serialized.code = error.code;
  if (error.cause !== undefined) serialized.cause = redact(error.cause, 1);
  if (import.meta.env.DEV && error.stack) serialized.stack = error.stack;
  return serialized;
}

/** Remove valores sensíveis de qualquer estrutura antes de registrar. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[depth-limit]';
  if (typeof value === 'string') return value.replace(BEARER_VALUE, `Bearer ${REDACTED}`);
  if (value instanceof Error) return serializeError(value);
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (typeof value === 'object' && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = SENSITIVE_KEY.test(key) ? REDACTED : redact(entry, depth + 1);
    }
    return result;
  }
  return value;
}

class Logger {
  private entries: LogEntry[] = [];
  private listeners = new Set<LogListener>();
  private sinks = new Set<LogSink>();
  private nextId = 1;

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }

  getEntries(): readonly LogEntry[] {
    return this.entries;
  }

  addSink(sink: LogSink): () => void {
    this.sinks.add(sink);
    return () => this.sinks.delete(sink);
  }

  subscribe(listener: LogListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    const entry: LogEntry = {
      id: this.nextId++,
      level,
      message,
      context: context ? (redact(context) as Record<string, unknown>) : undefined,
      timestamp: new Date().toISOString(),
    };

    this.entries = [...this.entries.slice(-(MAX_ENTRIES - 1)), entry];
    this.listeners.forEach((listener) => {
      listener(this.entries);
    });
    this.writeToConsole(entry);
    this.sinks.forEach((sink) => {
      sink(entry);
    });
  }

  private writeToConsole(entry: LogEntry): void {
    if (!import.meta.env.DEV && (entry.level === 'debug' || entry.level === 'info')) return;
    if (import.meta.env.MODE === 'test') return;

    const args: unknown[] = [`[${entry.level}] ${entry.message}`];
    if (entry.context) args.push(entry.context);

    switch (entry.level) {
      case 'debug':
        console.debug(...args);
        break;
      case 'info':
        console.info(...args);
        break;
      case 'warn':
        console.warn(...args);
        break;
      case 'error':
        console.error(...args);
        break;
    }
  }
}

export const logger = new Logger();
