import { type AppDeps, createApp } from './app.js';
import type { Env } from './config.js';
import { createLogger } from './logger.js';
import { createRateLimiter } from './rateLimit.js';

/** Utilitários de teste (não usados em produção). */
export const TEST_SECRET = 'test-client-secret-value';

export const TEST_ENV: Env = {
  TIKTOK_CLIENT_KEY: 'awtestclientkey',
  TIKTOK_CLIENT_SECRET: TEST_SECRET,
};

/** Verifier PKCE de exemplo (64 caracteres "unreserved") e a redirect URI loopback usada no login. */
export const TEST_VERIFIER = 'aB3-_' + 'x'.repeat(59);
export const TEST_REDIRECT_URI = 'http://127.0.0.1:53682/tiktok/callback';

export interface FetchCall {
  url: string;
  form: URLSearchParams;
}

export function createTestApp(
  options: { env?: Env; fetch?: (call: FetchCall) => Response | Promise<Response> } = {},
) {
  const logs: string[] = [];
  const calls: FetchCall[] = [];
  let clock = 1_000_000;
  const fetchImpl: typeof fetch = async (input, init) => {
    const call = {
      url: typeof input === 'string' ? input : input instanceof URL ? input.href : input.url,
      form: new URLSearchParams(init?.body as URLSearchParams),
    };
    calls.push(call);
    if (!options.fetch) throw new Error('fetch não esperado');
    return options.fetch(call);
  };
  const deps: AppDeps = {
    env: options.env ?? TEST_ENV,
    fetch: fetchImpl,
    logger: createLogger((_level, line) => logs.push(line)),
    rateLimiter: createRateLimiter(() => clock),
    now: () => clock,
  };
  return {
    handle: createApp(deps),
    logs,
    calls,
    advance(ms: number) {
      clock += ms;
    },
  };
}

export function postJson(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request(`https://api.yeaax.xyz${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

export function tokenResponse(overrides: Record<string, unknown> = {}): Response {
  return Response.json({
    open_id: 'open-123',
    scope: 'user.info.basic,video.publish',
    access_token: 'act.secret-access',
    expires_in: 86400,
    refresh_token: 'rft.secret-refresh',
    refresh_expires_in: 31536000,
    token_type: 'Bearer',
    ...overrides,
  });
}
