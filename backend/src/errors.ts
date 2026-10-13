/** Códigos estáveis devolvidos ao cliente em `{ error: { code, message } }`. */
export type ApiErrorCode =
  | 'NOT_FOUND'
  | 'METHOD_NOT_ALLOWED'
  | 'FORBIDDEN_ORIGIN'
  | 'UNSUPPORTED_MEDIA_TYPE'
  | 'PAYLOAD_TOO_LARGE'
  | 'INVALID_JSON'
  | 'INVALID_INPUT'
  | 'RATE_LIMITED'
  | 'NOT_CONFIGURED'
  | 'INVALID_GRANT'
  | 'UPSTREAM_REJECTED'
  | 'UPSTREAM_RATE_LIMITED'
  | 'UPSTREAM_UNAVAILABLE'
  | 'UPSTREAM_INVALID_RESPONSE'
  | 'INTERNAL';

/**
 * Erro com status HTTP e mensagem já pronta para o cliente.
 * A mensagem nunca contém dados recebidos (codes, tokens) nem respostas brutas do TikTok.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ApiErrorCode,
    message: string,
    readonly headers: Readonly<Record<string, string>> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
