import { z } from 'zod';

import type { TikTokConfig } from '../config.js';
import { ApiError } from '../errors.js';
import type { Logger } from '../logger.js';

/** Endpoints oficiais (docs/API_NOTES.md → TikTok → Verificação de 2026-10-13). */
export const TIKTOK_AUTHORIZE_URL = 'https://www.tiktok.com/v2/auth/authorize/';
export const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';
export const TIKTOK_REVOKE_URL = 'https://open.tiktokapis.com/v2/oauth/revoke/';

const UPSTREAM_TIMEOUT_MS = 10_000;

const tokenResponseSchema = z.object({
  open_id: z.string().min(1).max(256),
  scope: z.string().max(1024),
  access_token: z.string().min(1).max(4096),
  expires_in: z.number().int().positive(),
  refresh_token: z.string().min(1).max(4096),
  refresh_expires_in: z.number().int().positive(),
  token_type: z.string().max(32),
});

const errorResponseSchema = z.object({
  error: z.string().min(1).max(128),
  log_id: z.string().max(128).optional(),
});

/** Tokens devolvidos ao desktop (camelCase). Nunca são registrados nem guardados aqui. */
export interface TokenSet {
  openId: string;
  scopes: string[];
  accessToken: string;
  expiresIn: number;
  refreshToken: string;
  refreshExpiresIn: number;
  tokenType: string;
}

/** Dados do Login Kit Desktop: code recebido no loopback + PKCE + redirect URI usada na autorização. */
export interface CodeExchange {
  code: string;
  codeVerifier: string;
  redirectUri: string;
}

export type OAuthOperation = 'exchange' | 'refresh' | 'revoke';

export interface TikTokOAuthClient {
  exchangeCode(request: CodeExchange): Promise<TokenSet>;
  refresh(refreshToken: string): Promise<TokenSet>;
  revoke(accessToken: string): Promise<void>;
}

interface Deps {
  config: TikTokConfig;
  fetch: typeof fetch;
  logger: Logger;
}

const INVALID_GRANT_ERRORS = new Set(['invalid_grant', 'invalid_request', 'access_denied']);
const MISCONFIGURED_ERRORS = new Set([
  'invalid_client',
  'unauthorized_client',
  'unsupported_grant_type',
  'invalid_scope',
]);
const UNAVAILABLE_ERRORS = new Set(['server_error', 'temporarily_unavailable']);

/**
 * Converte um erro do TikTok em `ApiError` com mensagem fixa — o corpo do TikTok nunca é repassado.
 * O código do erro e o `log_id` (úteis para suporte) só vão para o log do servidor.
 */
export function normalizeUpstreamError(
  operation: OAuthOperation,
  httpStatus: number,
  upstreamError: string | null,
): ApiError {
  if (httpStatus === 429 || upstreamError === 'rate_limit_exceeded') {
    return new ApiError(
      429,
      'UPSTREAM_RATE_LIMITED',
      'O TikTok limitou as requisições. Tente novamente em alguns minutos.',
      { 'retry-after': '60' },
    );
  }
  if (upstreamError && INVALID_GRANT_ERRORS.has(upstreamError)) {
    return new ApiError(
      400,
      'INVALID_GRANT',
      operation === 'exchange'
        ? 'A autorização expirou ou já foi usada. Conecte a conta novamente.'
        : 'A sessão do TikTok expirou ou foi revogada. Conecte a conta novamente.',
    );
  }
  if (httpStatus >= 500 || (upstreamError && UNAVAILABLE_ERRORS.has(upstreamError))) {
    return new ApiError(503, 'UPSTREAM_UNAVAILABLE', 'O TikTok está indisponível no momento.');
  }
  return new ApiError(502, 'UPSTREAM_REJECTED', 'O TikTok recusou a solicitação.');
}

export function createTikTokOAuthClient({ config, fetch, logger }: Deps): TikTokOAuthClient {
  async function post(
    operation: OAuthOperation,
    url: string,
    form: Record<string, string>,
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/x-www-form-urlencoded',
          'cache-control': 'no-cache',
        },
        body: new URLSearchParams(form),
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
    } catch (error) {
      logger.warn('tiktok.oauth.network_error', {
        operation,
        reason: error instanceof Error ? error.name : 'unknown',
      });
      throw new ApiError(503, 'UPSTREAM_UNAVAILABLE', 'Não foi possível falar com o TikTok.');
    }

    const text = await response.text();
    let body: unknown = null;
    if (text.trim() !== '') {
      try {
        body = JSON.parse(text) as unknown;
      } catch {
        body = null;
      }
    }

    const upstream = errorResponseSchema.safeParse(body);
    if (!response.ok || upstream.success) {
      const upstreamError = upstream.success ? upstream.data.error : null;
      const error = normalizeUpstreamError(operation, response.status, upstreamError);
      const level = MISCONFIGURED_ERRORS.has(upstreamError ?? '') ? 'error' : 'warn';
      logger[level]('tiktok.oauth.rejected', {
        operation,
        httpStatus: response.status,
        upstreamError,
        logId: upstream.success ? upstream.data.log_id : undefined,
        result: error.code,
      });
      throw error;
    }
    return body;
  }

  function toTokenSet(operation: OAuthOperation, body: unknown): TokenSet {
    const parsed = tokenResponseSchema.safeParse(body);
    if (!parsed.success) {
      logger.error('tiktok.oauth.invalid_response', { operation });
      throw new ApiError(
        502,
        'UPSTREAM_INVALID_RESPONSE',
        'Resposta inesperada do TikTok. Tente novamente.',
      );
    }
    const data = parsed.data;
    return {
      openId: data.open_id,
      scopes: data.scope
        .split(',')
        .map((scope) => scope.trim())
        .filter(Boolean),
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      refreshToken: data.refresh_token,
      refreshExpiresIn: data.refresh_expires_in,
      tokenType: data.token_type,
    };
  }

  const credentials = { client_key: config.clientKey, client_secret: config.clientSecret };

  return {
    async exchangeCode({ code, codeVerifier, redirectUri }) {
      const form = {
        ...credentials,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      };
      const tokens = toTokenSet('exchange', await post('exchange', TIKTOK_TOKEN_URL, form));
      logger.info('tiktok.oauth.exchanged', { scopes: tokens.scopes });
      return tokens;
    },

    async refresh(refreshToken) {
      const body = await post('refresh', TIKTOK_TOKEN_URL, {
        ...credentials,
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });
      const tokens = toTokenSet('refresh', body);
      logger.info('tiktok.oauth.refreshed');
      return tokens;
    },

    async revoke(accessToken) {
      await post('revoke', TIKTOK_REVOKE_URL, { ...credentials, token: accessToken });
      logger.info('tiktok.oauth.revoked');
    },
  };
}
