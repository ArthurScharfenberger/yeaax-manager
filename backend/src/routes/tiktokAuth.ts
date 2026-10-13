import { z } from 'zod';

import type { AppConfig } from '../config.js';
import { ApiError } from '../errors.js';
import { jsonResponse, readJsonBody } from '../http.js';
import {
  LOOPBACK_CALLBACK_PATH,
  LOOPBACK_HOST,
  parseLoopbackRedirectUri,
  REGISTERED_REDIRECT_URI,
} from '../loopback.js';
import { TIKTOK_AUTHORIZE_URL, type TikTokOAuthClient } from '../tiktok/oauthClient.js';

/** Caracteres imprimíveis sem espaço (codes e tokens do TikTok são opacos). */
const OPAQUE_VALUE = /^[\x21-\x7E]+$/;
const codeSchema = z.string().min(1).max(1024).regex(OPAQUE_VALUE);
const tokenSchema = z.string().min(1).max(4096).regex(OPAQUE_VALUE);
/** RFC 7636: 43–128 caracteres "unreserved". Obrigatório no Login Kit Desktop (DEC-027). */
const codeVerifierSchema = z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/);
const redirectUriSchema = z
  .string()
  .max(512)
  .refine((value) => parseLoopbackRedirectUri(value) !== null);

const tokenBodySchema = z.strictObject({
  code: codeSchema,
  codeVerifier: codeVerifierSchema,
  redirectUri: redirectUriSchema,
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
 * `POST /auth/tiktok/token` — troca o code por tokens com o client secret (só no servidor).
 * O desktop envia o `code` recebido no listener loopback, o `code_verifier` do PKCE e a redirect URI usada.
 */
export async function tiktokToken(request: Request, client: TikTokOAuthClient): Promise<Response> {
  const body = await parseBody(request, tokenBodySchema);
  return jsonResponse(
    200,
    await client.exchangeCode({
      code: body.code,
      codeVerifier: body.codeVerifier,
      redirectUri: body.redirectUri,
    }),
  );
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

/** `GET /config` — dados públicos para o desktop montar a URL de autorização (Login Kit Desktop). */
export function publicConfig(config: AppConfig): Response {
  return jsonResponse(
    200,
    {
      tiktok: {
        clientKey: config.tiktok.clientKey,
        authorizeUrl: TIKTOK_AUTHORIZE_URL,
        scopes: config.tiktok.scopes,
        redirect: {
          registered: REGISTERED_REDIRECT_URI,
          host: LOOPBACK_HOST,
          path: LOOPBACK_CALLBACK_PATH,
        },
        // Peculiaridade do TikTok: o desafio é o SHA-256 do verifier em HEX (não base64url).
        pkce: { method: 'S256', challengeEncoding: 'hex' },
      },
    },
    { 'cache-control': 'public, max-age=300' },
  );
}
