import { describe, expect, it } from 'vitest';

import { loadConfig } from './config.js';
import { redact } from './logger.js';
import { createTestApp, TEST_ENV, TEST_SECRET } from './testing.js';

const get = (path: string) => new Request(`https://api.yeaax.xyz${path}`);

describe('rotas públicas', () => {
  it('/health responde sem exigir configuração', async () => {
    const response = await createTestApp({ env: {} }).handle(get('/health'));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ok', configured: false });
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('/config expõe só dados públicos', async () => {
    const response = await createTestApp().handle(get('/config'));
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).not.toContain(TEST_SECRET);
    expect(JSON.parse(text)).toEqual({
      tiktok: {
        clientKey: 'awtestclientkey',
        authorizeUrl: 'https://www.tiktok.com/v2/auth/authorize/',
        redirectUri: 'https://api.yeaax.xyz/auth/tiktok/callback',
        scopes: ['user.info.basic', 'user.info.profile', 'video.publish', 'video.upload'],
      },
    });
    expect(response.headers.get('cache-control')).toBe('public, max-age=300');
  });

  it('rota desconhecida e método errado', async () => {
    const app = createTestApp();
    expect((await app.handle(get('/nada'))).status).toBe(404);
    const wrong = await app.handle(new Request('https://api.yeaax.xyz/health', { method: 'POST' }));
    expect(wrong.status).toBe(405);
    expect(wrong.headers.get('allow')).toBe('GET');
  });

  it('aceita barra final', async () => {
    expect((await createTestApp().handle(get('/health/'))).status).toBe(200);
  });

  it('não registra a query string nos logs de requisição', async () => {
    const app = createTestApp();
    await app.handle(get('/nada?code=segredo'));
    expect(app.logs.join('\n')).not.toContain('segredo');
  });
});

describe('loadConfig', () => {
  it('aceita a configuração válida e aplica os escopos padrão', () => {
    const result = loadConfig(TEST_ENV);
    expect(result.ok && result.config.tiktok.scopes).toContain('user.info.profile');
  });

  it.each([
    ['redirect http', { TIKTOK_REDIRECT_URI: 'http://api.yeaax.xyz/auth/tiktok/callback' }],
    ['redirect com query', { TIKTOK_REDIRECT_URI: 'https://api.yeaax.xyz/cb?x=1' }],
    ['redirect com fragmento', { TIKTOK_REDIRECT_URI: 'https://api.yeaax.xyz/cb#x' }],
    ['escopo desconhecido', { TIKTOK_SCOPES: 'user.info.basic,admin' }],
    ['sem user.info.basic', { TIKTOK_SCOPES: 'video.publish' }],
    ['secret com espaço', { TIKTOK_CLIENT_SECRET: 'abc def ghi' }],
  ])('rejeita %s devolvendo só o nome da variável', (_label, override) => {
    const result = loadConfig({ ...TEST_ENV, ...override });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.invalidKeys).toEqual(Object.keys(override));
      expect(JSON.stringify(result)).not.toContain(TEST_SECRET);
    }
  });
});

describe('redact', () => {
  it('redige campos sensíveis e valores Bearer', () => {
    expect(
      redact({
        operation: 'refresh',
        accessToken: 'a',
        nested: { client_secret: 'b', code: 'c', state: 'd', code_verifier: 'e' },
        header: 'Bearer abc.def',
      }),
    ).toEqual({
      operation: 'refresh',
      accessToken: '[redacted]',
      nested: {
        client_secret: '[redacted]',
        code: '[redacted]',
        state: '[redacted]',
        code_verifier: '[redacted]',
      },
      header: 'Bearer [redacted]',
    });
  });
});
