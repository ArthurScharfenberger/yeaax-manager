import { ZodError } from 'zod';

/** Códigos de erro conhecidos pela aplicação (inclui os devolvidos pelos comandos Rust). */
export const ERROR_CODES = [
  'UNKNOWN',
  'VALIDATION',
  'NOT_FOUND',
  'CONFLICT',
  'DUPLICATE_POST',
  'INVALID_TRANSITION',
  'NOT_EDITABLE',
  'SCHEDULE_IN_PAST',
  'CHANNEL_HAS_POSTS',
  'MEDIA_IN_USE',
  'UNSUPPORTED_FILE',
  'FILE_NOT_FOUND',
  'EMPTY_FILE',
  'INVALID_PATH',
  'SCOPE_ERROR',
  'INVALID_INPUT',
  'IO_ERROR',
  'SECRET_STORE',
  'AI_NOT_CONFIGURED',
  'AI_AUTH',
  'AI_RATE_LIMIT',
  'AI_UNAVAILABLE',
  'AI_ERROR',
  // TikTok (src-tauri/src/tiktok e commands/tiktok.rs)
  'TIKTOK_NOT_CONFIGURED',
  'TIKTOK_UNAVAILABLE',
  'TIKTOK_RATE_LIMIT',
  'TIKTOK_AUTH_EXPIRED',
  'TIKTOK_NOT_CONNECTED',
  'TIKTOK_DENIED',
  'TIKTOK_LOGIN_TIMEOUT',
  'TIKTOK_LOGIN_CANCELLED',
  'TIKTOK_PROFILE',
  'TIKTOK_ERROR',
  'DATABASE',
  'DATA_INTEGRITY',
  'PROVIDER',
  'NOT_AVAILABLE',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

const DEFAULT_MESSAGE = 'Ocorreu um erro inesperado. Detalhes foram registrados nos logs.';

/**
 * Erro de domínio/infraestrutura com código estável e mensagem pronta para o usuário.
 * Detalhes técnicos ficam em `cause` (registrados no logger, nunca exibidos crus).
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details: Record<string, unknown> | undefined;

  constructor(
    code: ErrorCode,
    message: string,
    options?: { cause?: unknown; details?: Record<string, unknown> },
  ) {
    super(message, { cause: options?.cause });
    this.name = 'AppError';
    this.code = code;
    this.details = options?.details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/** Falhas de infraestrutura/bug. Os demais códigos são regras de negócio esperadas. */
const UNEXPECTED_ERROR_CODES: ReadonlySet<ErrorCode> = new Set([
  'UNKNOWN',
  'DATABASE',
  'DATA_INTEGRITY',
  'PROVIDER',
  'SCOPE_ERROR',
  'INVALID_INPUT',
  'IO_ERROR',
  'SECRET_STORE',
  'AI_ERROR',
  'TIKTOK_ERROR',
]);

/** `true` para erros de validação/regra (ex.: agendar no passado), que não indicam bug. */
export function isExpectedError(error: unknown): boolean {
  return isAppError(error) && !UNEXPECTED_ERROR_CODES.has(error.code);
}

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && (ERROR_CODES as readonly string[]).includes(value);
}

/** Formato de erro serializado pelos comandos Rust (src-tauri/src/error.rs). */
function isCommandError(value: unknown): value is { code: string; message: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    typeof value.code === 'string' &&
    typeof value.message === 'string'
  );
}

/** Converte qualquer valor lançado em `AppError`, preservando a causa original. */
export function toAppError(error: unknown, fallbackMessage = DEFAULT_MESSAGE): AppError {
  if (error instanceof AppError) return error;

  if (error instanceof ZodError) {
    const firstIssue = error.issues[0];
    return new AppError('VALIDATION', firstIssue?.message ?? 'Dados inválidos.', { cause: error });
  }

  if (isCommandError(error)) {
    const code = isErrorCode(error.code) ? error.code : 'UNKNOWN';
    return new AppError(code, error.message, { cause: error });
  }

  return new AppError('UNKNOWN', fallbackMessage, { cause: error });
}

/** Mensagem segura para exibir ao usuário. */
export function getErrorMessage(error: unknown): string {
  return toAppError(error).message;
}
