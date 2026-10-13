/**
 * Logger estruturado (uma linha JSON por evento — a Vercel coleta o stdout).
 *
 * Regra: nunca passar tokens, secrets, authorization codes, `state`, URLs com query ou corpos de
 * requisição. Como defesa extra, campos com nomes sensíveis são redigidos antes de escrever.
 */
export type LogLevel = 'info' | 'warn' | 'error';
export type LogFields = Readonly<Record<string, unknown>>;

export interface Logger {
  info(event: string, fields?: LogFields): void;
  warn(event: string, fields?: LogFields): void;
  error(event: string, fields?: LogFields): void;
}

const SENSITIVE_KEY = /token|secret|authorization|password|cookie|verifier/i;
const SENSITIVE_EXACT_KEYS = new Set(['code', 'state']);
const REDACTED = '[redacted]';

function isSensitiveKey(key: string): boolean {
  return SENSITIVE_KEY.test(key) || SENSITIVE_EXACT_KEYS.has(key.toLowerCase());
}

export function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        isSensitiveKey(key) ? REDACTED : redact(inner),
      ]),
    );
  }
  if (typeof value === 'string') return value.replace(/Bearer\s+\S+/gi, `Bearer ${REDACTED}`);
  return value;
}

export function createLogger(
  write: (level: LogLevel, line: string) => void,
  now: () => Date = () => new Date(),
): Logger {
  const log = (level: LogLevel, event: string, fields: LogFields = {}) => {
    const entry = { level, event, time: now().toISOString(), ...(redact(fields) as LogFields) };
    write(level, JSON.stringify(entry));
  };
  return {
    info: (event, fields) => {
      log('info', event, fields);
    },
    warn: (event, fields) => {
      log('warn', event, fields);
    },
    error: (event, fields) => {
      log('error', event, fields);
    },
  };
}

/** Destino padrão: console (único lugar do backend que usa `console`). */
export const consoleLogger = createLogger((level, line) => {
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
});
