import { type AppConfig, type Env, loadConfig } from './config.js';
import { ApiError } from './errors.js';
import { clientIp, errorResponse, jsonResponse, withSecurityHeaders } from './http.js';
import type { Logger } from './logger.js';
import type { RateLimiter, RateLimitRule } from './rateLimit.js';
import {
  publicConfig,
  tiktokCallback,
  tiktokRefresh,
  tiktokRevoke,
  tiktokToken,
} from './routes/tiktokAuth.js';
import { createTikTokOAuthClient } from './tiktok/oauthClient.js';
import { SERVICE_NAME, SERVICE_VERSION } from './version.js';

export interface AppDeps {
  env: Env;
  fetch: typeof fetch;
  logger: Logger;
  rateLimiter: RateLimiter;
  now: () => number;
}

interface RouteContext {
  request: Request;
  deps: AppDeps;
}

interface Route {
  method: 'GET' | 'POST';
  /** Rotas chamadas só pelo processo Rust do desktop: navegadores (com `Origin`) são recusados. */
  serverToServer: boolean;
  rateLimit: RateLimitRule | null;
  handle(context: RouteContext): Response | Promise<Response>;
}

const MINUTE = 60_000;

/** Configuração validada; sem ela a rota responde 503 (os nomes inválidos vão só para o log). */
function requireConfig({ deps }: RouteContext): AppConfig {
  const loaded = loadConfig(deps.env);
  if (!loaded.ok) {
    deps.logger.error('config.invalid', { invalidKeys: loaded.invalidKeys });
    throw new ApiError(503, 'NOT_CONFIGURED', 'Serviço ainda não configurado.');
  }
  return loaded.config;
}

function tiktokClient(context: RouteContext) {
  const { deps } = context;
  return createTikTokOAuthClient({
    config: requireConfig(context).tiktok,
    fetch: deps.fetch,
    logger: deps.logger,
  });
}

const ROUTES: Readonly<Record<string, Route>> = {
  '/health': {
    method: 'GET',
    serverToServer: false,
    rateLimit: null,
    handle: ({ deps }) =>
      jsonResponse(200, {
        status: 'ok',
        service: SERVICE_NAME,
        version: SERVICE_VERSION,
        configured: loadConfig(deps.env).ok,
      }),
  },
  '/config': {
    method: 'GET',
    serverToServer: false,
    rateLimit: { limit: 60, windowMs: MINUTE },
    handle: (context) => publicConfig(requireConfig(context)),
  },
  '/auth/tiktok/callback': {
    method: 'GET',
    serverToServer: false,
    rateLimit: { limit: 30, windowMs: MINUTE },
    handle: ({ request, deps }) => tiktokCallback(request, deps.logger),
  },
  '/auth/tiktok/token': {
    method: 'POST',
    serverToServer: true,
    rateLimit: { limit: 10, windowMs: MINUTE },
    handle: (context) => tiktokToken(context.request, tiktokClient(context)),
  },
  '/auth/tiktok/refresh': {
    method: 'POST',
    serverToServer: true,
    rateLimit: { limit: 30, windowMs: MINUTE },
    handle: (context) => tiktokRefresh(context.request, tiktokClient(context)),
  },
  '/auth/tiktok/revoke': {
    method: 'POST',
    serverToServer: true,
    rateLimit: { limit: 10, windowMs: MINUTE },
    handle: (context) => tiktokRevoke(context.request, tiktokClient(context)),
  },
};

function normalizePath(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

async function dispatch(request: Request, deps: AppDeps, path: string): Promise<Response> {
  const route = ROUTES[path];
  if (!route) throw new ApiError(404, 'NOT_FOUND', 'Rota não encontrada.');

  // Sem cabeçalhos CORS em nenhuma resposta: preflights (OPTIONS) caem aqui e o navegador bloqueia.
  if (request.method !== route.method) {
    throw new ApiError(405, 'METHOD_NOT_ALLOWED', 'Método não permitido.', {
      allow: route.method,
    });
  }
  if (route.serverToServer && request.headers.has('origin')) {
    throw new ApiError(403, 'FORBIDDEN_ORIGIN', 'Esta rota não aceita chamadas de navegadores.');
  }

  if (route.rateLimit) {
    const decision = deps.rateLimiter.check(`${path}|${clientIp(request)}`, route.rateLimit);
    if (!decision.allowed) {
      throw new ApiError(429, 'RATE_LIMITED', 'Muitas requisições. Tente novamente em instantes.', {
        'retry-after': String(decision.retryAfterSeconds),
      });
    }
  }

  return route.handle({ request, deps });
}

/** Cria o handler HTTP (Web standard `Request` → `Response`). Sem estado entre requisições. */
export function createApp(deps: AppDeps): (request: Request) => Promise<Response> {
  return async (request) => {
    const startedAt = deps.now();
    const path = normalizePath(new URL(request.url).pathname);
    let response: Response;
    try {
      response = await dispatch(request, deps, path);
    } catch (error) {
      if (error instanceof ApiError) {
        response = errorResponse(error);
      } else {
        deps.logger.error('request.unhandled', {
          path,
          reason: error instanceof Error ? error.name : 'unknown',
        });
        response = errorResponse(new ApiError(500, 'INTERNAL', 'Erro interno.'));
      }
    }
    // Só método, caminho (sem query — o callback carrega o code), status e duração.
    deps.logger.info('request', {
      method: request.method,
      path: ROUTES[path] ? path : 'unknown',
      status: response.status,
      durationMs: deps.now() - startedAt,
    });
    return withSecurityHeaders(response);
  };
}
