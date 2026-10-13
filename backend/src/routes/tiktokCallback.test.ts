import { describe, expect, it } from 'vitest';

import { createTestApp, VALID_NONCE, VALID_STATE } from '../testing.js';

const CODE = 'auth-code_123*!xyz';

function callback(query: Record<string, string>) {
  const url = new URL('https://api.yeaax.xyz/auth/tiktok/callback');
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value);
  return new Request(url);
}

describe('GET /auth/tiktok/callback', () => {
  it('repassa code, state e scopes somente para o loopback do desktop', async () => {
    const app = createTestApp();
    const response = await app.handle(
      callback({ code: CODE, state: VALID_STATE, scopes: 'user.info.basic,video.publish' }),
    );

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get('location')!);
    expect(location.origin).toBe('http://127.0.0.1:53682');
    expect(location.pathname).toBe('/tiktok/callback');
    expect(location.searchParams.get('code')).toBe(CODE);
    expect(location.searchParams.get('state')).toBe(VALID_STATE);
    expect(location.searchParams.get('scopes')).toBe('user.info.basic,video.publish');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  });

  it('não registra code nem state nos logs', async () => {
    const app = createTestApp();
    await app.handle(callback({ code: CODE, state: VALID_STATE }));
    const logs = app.logs.join('\n');
    expect(logs).not.toContain(CODE);
    expect(logs).not.toContain(VALID_NONCE);
  });

  it.each([
    ['ausente', {}],
    ['com host injetado', { state: `${VALID_NONCE}.5000@evil.example` }],
    ['com porta privilegiada', { state: `${VALID_NONCE}.443` }],
    ['com URL completa', { state: 'https://evil.example/' }],
  ])('state %s: mostra página de erro e não redireciona', async (_label, query) => {
    const app = createTestApp();
    const response = await app.handle(callback({ code: CODE, ...query }));
    expect(response.status).toBe(400);
    expect(response.headers.get('location')).toBeNull();
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).not.toContain(CODE);
  });

  it('repassa o erro do TikTok sem a descrição e normaliza códigos estranhos', async () => {
    const app = createTestApp();
    const denied = await app.handle(
      callback({
        error: 'access_denied',
        error_description: '<script>x</script>',
        state: VALID_STATE,
      }),
    );
    const deniedUrl = new URL(denied.headers.get('location')!);
    expect(deniedUrl.searchParams.get('error')).toBe('access_denied');
    expect(deniedUrl.searchParams.has('error_description')).toBe(false);
    expect(deniedUrl.searchParams.has('code')).toBe(false);

    const weird = await app.handle(callback({ error: '<b>bad</b>', state: VALID_STATE }));
    expect(new URL(weird.headers.get('location')!).searchParams.get('error')).toBe('unknown_error');
  });

  it('code ausente ou malformado vira erro invalid_callback para o desktop', async () => {
    const app = createTestApp();
    for (const query of [{ state: VALID_STATE }, { state: VALID_STATE, code: 'tem espaço' }]) {
      const response = await app.handle(callback(query));
      const location = new URL(response.headers.get('location')!);
      expect(location.host).toBe('127.0.0.1:53682');
      expect(location.searchParams.get('error')).toBe('invalid_callback');
      expect(location.searchParams.has('code')).toBe(false);
    }
  });

  it('descarta scopes com caracteres inesperados', async () => {
    const app = createTestApp();
    const response = await app.handle(
      callback({ code: CODE, state: VALID_STATE, scopes: 'a b<script>' }),
    );
    expect(new URL(response.headers.get('location')!).searchParams.has('scopes')).toBe(false);
  });

  it('funciona sem as variáveis do TikTok (não usa o secret)', async () => {
    const app = createTestApp({ env: {} });
    const response = await app.handle(callback({ code: CODE, state: VALID_STATE }));
    expect(response.status).toBe(302);
  });
});
