import { describe, expect, it } from 'vitest';

import { TIKTOK_REVOKE_URL, TIKTOK_TOKEN_URL } from '../tiktok/oauthClient.js';
import { createTestApp, postJson, TEST_SECRET, tokenResponse } from '../testing.js';

const CODE = 'auth-code-123';

describe('POST /auth/tiktok/token', () => {
  it('troca o code com o client secret e devolve os tokens em camelCase', async () => {
    const app = createTestApp({ fetch: () => tokenResponse() });
    const response = await app.handle(postJson('/auth/tiktok/token', { code: CODE }));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({
      openId: 'open-123',
      scopes: ['user.info.basic', 'video.publish'],
      accessToken: 'act.secret-access',
      expiresIn: 86400,
      refreshToken: 'rft.secret-refresh',
      refreshExpiresIn: 31536000,
      tokenType: 'Bearer',
    });

    const call = app.calls[0]!;
    expect(call.url).toBe(TIKTOK_TOKEN_URL);
    expect(Object.fromEntries(call.form)).toEqual({
      client_key: 'awtestclientkey',
      client_secret: TEST_SECRET,
      code: CODE,
      grant_type: 'authorization_code',
      redirect_uri: 'https://api.yeaax.xyz/auth/tiktok/callback',
    });
  });

  it('envia code_verifier quando o desktop usa PKCE', async () => {
    const app = createTestApp({ fetch: () => tokenResponse() });
    const verifier = 'v'.repeat(43);
    await app.handle(postJson('/auth/tiktok/token', { code: CODE, codeVerifier: verifier }));
    expect(app.calls[0]!.form.get('code_verifier')).toBe(verifier);
  });

  it('nunca registra code, tokens ou secret nos logs', async () => {
    const app = createTestApp({ fetch: () => tokenResponse() });
    await app.handle(postJson('/auth/tiktok/token', { code: CODE }));
    const logs = app.logs.join('\n');
    for (const value of [CODE, TEST_SECRET, 'act.secret-access', 'rft.secret-refresh']) {
      expect(logs).not.toContain(value);
    }
  });

  it.each([
    ['sem code', {}],
    ['code com espaço', { code: 'a b' }],
    ['campo extra', { code: CODE, redirect_uri: 'https://evil.example' }],
    ['code_verifier inválido', { code: CODE, codeVerifier: 'curto' }],
    ['code não string', { code: 42 }],
  ])('400 para corpo inválido (%s) sem chamar o TikTok', async (_label, body) => {
    const app = createTestApp();
    const response = await app.handle(postJson('/auth/tiktok/token', body));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: 'INVALID_INPUT', message: 'Dados da requisição inválidos.' },
    });
    expect(app.calls).toHaveLength(0);
  });

  it('JSON malformado, content-type errado e corpo grande demais', async () => {
    const app = createTestApp();
    expect((await app.handle(postJson('/auth/tiktok/token', '{oops'))).status).toBe(400);
    const form = new Request('https://api.yeaax.xyz/auth/tiktok/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: 'code=x',
    });
    expect((await app.handle(form)).status).toBe(415);
    const big = await app.handle(postJson('/auth/tiktok/token', { code: 'x'.repeat(9000) }));
    expect(big.status).toBe(413);
  });

  it('recusa chamadas de navegador (Origin) e não envia cabeçalhos CORS', async () => {
    const app = createTestApp({ fetch: () => tokenResponse() });
    const response = await app.handle(
      postJson('/auth/tiktok/token', { code: CODE }, { origin: 'https://evil.example' }),
    );
    expect(response.status).toBe(403);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect(app.calls).toHaveLength(0);

    const preflight = await app.handle(
      new Request('https://api.yeaax.xyz/auth/tiktok/token', { method: 'OPTIONS' }),
    );
    expect(preflight.status).toBe(405);
    expect(preflight.headers.get('access-control-allow-origin')).toBeNull();
  });

  it.each([
    [
      400,
      { error: 'invalid_grant', error_description: `bad ${CODE}`, log_id: 'L1' },
      400,
      'INVALID_GRANT',
    ],
    [400, { error: 'invalid_client', error_description: TEST_SECRET }, 502, 'UPSTREAM_REJECTED'],
    [429, { error: 'rate_limit_exceeded' }, 429, 'UPSTREAM_RATE_LIMITED'],
    [500, null, 503, 'UPSTREAM_UNAVAILABLE'],
    [200, { error: 'temporarily_unavailable' }, 503, 'UPSTREAM_UNAVAILABLE'],
    [200, { unexpected: true }, 502, 'UPSTREAM_INVALID_RESPONSE'],
  ])(
    'TikTok %i %j vira %i %s sem repassar o corpo',
    async (upstreamStatus, upstreamBody, status, code) => {
      const app = createTestApp({
        fetch: () =>
          new Response(upstreamBody === null ? 'boom' : JSON.stringify(upstreamBody), {
            status: upstreamStatus,
          }),
      });
      const response = await app.handle(postJson('/auth/tiktok/token', { code: CODE }));
      expect(response.status).toBe(status);
      const text = await response.text();
      expect(JSON.parse(text)).toMatchObject({ error: { code } });
      expect(text).not.toContain(CODE);
      expect(text).not.toContain(TEST_SECRET);
      expect(app.logs.join('\n')).not.toContain(TEST_SECRET);
    },
  );

  it('falha de rede vira 503 UPSTREAM_UNAVAILABLE', async () => {
    const app = createTestApp({
      fetch: () => {
        throw new TypeError('fetch failed');
      },
    });
    const response = await app.handle(postJson('/auth/tiktok/token', { code: CODE }));
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: { code: 'UPSTREAM_UNAVAILABLE' } });
  });

  it('503 NOT_CONFIGURED sem as variáveis, registrando só os nomes', async () => {
    const app = createTestApp({ env: { TIKTOK_CLIENT_KEY: 'awtestclientkey' } });
    const response = await app.handle(postJson('/auth/tiktok/token', { code: CODE }));
    expect(response.status).toBe(503);
    expect(app.logs.join('\n')).toContain('TIKTOK_CLIENT_SECRET');
  });

  it('limita 10 trocas por minuto por IP', async () => {
    const app = createTestApp({ fetch: () => tokenResponse() });
    const send = (ip: string) =>
      app.handle(postJson('/auth/tiktok/token', { code: CODE }, { 'x-forwarded-for': ip }));
    for (let i = 0; i < 10; i += 1) expect((await send('1.1.1.1')).status).toBe(200);
    const limited = await send('1.1.1.1');
    expect(limited.status).toBe(429);
    expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
    expect((await send('2.2.2.2')).status).toBe(200);
    app.advance(60_000);
    expect((await send('1.1.1.1')).status).toBe(200);
  });
});

describe('POST /auth/tiktok/refresh', () => {
  it('renova com o client secret e devolve o novo refresh token', async () => {
    const app = createTestApp({ fetch: () => tokenResponse({ refresh_token: 'rft.novo' }) });
    const response = await app.handle(
      postJson('/auth/tiktok/refresh', { refreshToken: 'rft.antigo' }),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ refreshToken: 'rft.novo' });
    expect(Object.fromEntries(app.calls[0]!.form)).toEqual({
      client_key: 'awtestclientkey',
      client_secret: TEST_SECRET,
      grant_type: 'refresh_token',
      refresh_token: 'rft.antigo',
    });
    expect(app.logs.join('\n')).not.toContain('rft.');
  });

  it('refresh revogado vira INVALID_GRANT', async () => {
    const app = createTestApp({
      fetch: () => Response.json({ error: 'invalid_grant' }, { status: 400 }),
    });
    const response = await app.handle(postJson('/auth/tiktok/refresh', { refreshToken: 'rft.x' }));
    expect(await response.json()).toMatchObject({ error: { code: 'INVALID_GRANT' } });
  });
});

describe('POST /auth/tiktok/revoke', () => {
  it('revoga com o client secret e responde 204', async () => {
    const app = createTestApp({ fetch: () => new Response(null, { status: 200 }) });
    const response = await app.handle(postJson('/auth/tiktok/revoke', { accessToken: 'act.x' }));
    expect(response.status).toBe(204);
    expect(app.calls[0]!.url).toBe(TIKTOK_REVOKE_URL);
    expect(Object.fromEntries(app.calls[0]!.form)).toEqual({
      client_key: 'awtestclientkey',
      client_secret: TEST_SECRET,
      token: 'act.x',
    });
  });
});
