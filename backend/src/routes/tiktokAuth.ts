import { z } from 'zod';

import type { AppConfig } from '../config.js';
import { ApiError } from '../errors.js';
import { htmlResponse, jsonResponse, readJsonBody, redirectResponse } from '../http.js';
import type { Logger } from '../logger.js';
import { buildLoopbackUrl, parseState } from '../oauthState.js';
import { TIKTOK_AUTHORIZE_URL, type TikTokOAuthClient } from '../tiktok/oauthClient.js';

/** Caracteres imprimíveis sem espaço (codes e tokens do TikTok são opacos). */
const OPAQUE_VALUE = /^[\x21-\x7E]+$/;
const codeSchema = z.string().min(1).max(1024).regex(OPAQUE_VALUE);
const tokenSchema = z.string().min(1).max(4096).regex(OPAQUE_VALUE);
/** RFC 7636: 43–128 caracteres "unreserved". Opcional: o fluxo Web não documenta PKCE (DEC-024). */
const codeVerifierSchema = z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/);
const scopesParamSchema = z.string().regex(/^[a-z0-9._,]{1,512}$/);
const errorParamSchema = z.string().regex(/^[a-z0-9_.-]{1,64}$/i);

const tokenBodySchema = z.strictObject({
  code: codeSchema,
  codeVerifier: codeVerifierSchema.optional(),
});
const refreshBodySchema = z.strictObject({ refreshToken: tokenSchema });
const revokeBodySchema = z.strictObject({ accessToken: tokenSchema });

async function parseBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const result = schema.safeParse(await readJsonBody(request));
  // A mensagem é fixa: nunca ecoa o valor recebido.
  if (!result.success) throw new ApiError(400, 'INVALID_INPUT', 'Dados da requisição inválidos.');
  return result.data;
}

/**
 * `GET /auth/tiktok/callback` — recebe o retorno do TikTok e repassa ao listener loopback do desktop.
 * Não troca o code, não guarda nada e não registra code nem state (DEC-024).
 */
export function tiktokCallback(request: Request, logger: Logger): Response {
  const params = new URL(request.url).searchParams;
  const state = parseState(params.get('state'));
  if (!state) {
    logger.warn('tiktok.callback.invalid_state');
    return htmlResponse(
      400,
      'Link de autorização inválido',
      'Este link não veio de uma conexão iniciada pelo Yeaax Manager. Volte ao aplicativo e clique em "Conectar TikTok" novamente.',
    );
  }

  const rawState = params.get('state') ?? '';
  const upstreamError = params.get('error');
  if (upstreamError !== null) {
    const error = errorParamSchema.safeParse(upstreamError).success
      ? upstreamError
      : 'unknown_error';
    logger.info('tiktok.callback.relayed', { outcome: 'error', upstreamError: error });
    return redirectResponse(buildLoopbackUrl(state.port, { error, state: rawState }));
  }

  const code = codeSchema.safeParse(params.get('code'));
  if (!code.success) {
    logger.warn('tiktok.callback.invalid_code');
    return redirectResponse(
      buildLoopbackUrl(state.port, { error: 'invalid_callback', state: rawState }),
    );
  }

  const relay: Record<string, string> = { code: code.data, state: rawState };
  const scopes = scopesParamSchema.safeParse(params.get('scopes'));
  if (scopes.success) relay.scopes = scopes.data;
  logger.info('tiktok.callback.relayed', { outcome: 'code' });
  return redirectResponse(buildLoopbackUrl(state.port, relay));
}

/** `POST /auth/tiktok/token` — troca o code por tokens com o client secret (só no servidor). */
export async function tiktokToken(request: Request, client: TikTokOAuthClient): Promise<Response> {
  const body = await parseBody(request, tokenBodySchema);
  return jsonResponse(200, await client.exchangeCode(body.code, body.codeVerifier));
}

/** `POST /auth/tiktok/refresh` — renova o access token. O refresh token novo substitui o antigo. */
export async function tiktokRefresh(
  request: Request,
  client: TikTokOAuthClient,
): Promise<Response> {
  const body = await parseBody(request, refreshBodySchema);
  return jsonResponse(200, await client.refresh(body.refreshToken));
}

/** `POST /auth/tiktok/revoke` — revoga o access token ao desconectar a conta. */
export async function tiktokRevoke(request: Request, client: TikTokOAuthClient): Promise<Response> {
  const body = await parseBody(request, revokeBodySchema);
  await client.revoke(body.accessToken);
  return new Response(null, { status: 204 });
}

/** `GET /config` — dados públicos para o desktop montar a URL de autorização. */
export function publicConfig(config: AppConfig): Response {
  return jsonResponse(
    200,
    {
      tiktok: {
        clientKey: config.tiktok.clientKey,
        authorizeUrl: TIKTOK_AUTHORIZE_URL,
        redirectUri: config.tiktok.redirectUri,
        scopes: config.tiktok.scopes,
      },
    },
    { 'cache-control': 'public, max-age=300' },
  );
}
