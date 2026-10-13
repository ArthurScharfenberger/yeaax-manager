import { describe, expect, it } from 'vitest';

import { buildLoopbackUrl, parseState } from './oauthState.js';
import { VALID_NONCE } from './testing.js';

describe('parseState', () => {
  it('aceita nonce de 43 caracteres base64url e porta válida', () => {
    expect(parseState(`${VALID_NONCE}.53682`)).toEqual({ nonce: VALID_NONCE, port: 53682 });
    expect(parseState(`${VALID_NONCE}.1024`)?.port).toBe(1024);
    expect(parseState(`${VALID_NONCE}.65535`)?.port).toBe(65535);
  });

  it.each([
    ['ausente', null],
    ['vazio', ''],
    ['porta abaixo de 1024', `${VALID_NONCE}.1023`],
    ['porta acima de 65535', `${VALID_NONCE}.65536`],
    ['porta com zero à esquerda', `${VALID_NONCE}.08080`],
    ['porta 80', `${VALID_NONCE}.80`],
    ['nonce curto', `${VALID_NONCE.slice(1)}.5000`],
    ['nonce longo', `${VALID_NONCE}A.5000`],
    ['nonce com caractere inválido', `${VALID_NONCE.slice(1)}+.5000`],
    ['host injetado', `${VALID_NONCE}.5000@evil.example`],
    ['caminho injetado', `${VALID_NONCE}.5000/evil`],
    ['host no lugar da porta', `${VALID_NONCE}.evil.example`],
    ['quebra de linha', `${VALID_NONCE}.5000\n`],
    ['sem separador', `${VALID_NONCE}5000`],
  ])('rejeita state %s', (_label, state) => {
    expect(parseState(state)).toBeNull();
  });
});

describe('buildLoopbackUrl', () => {
  it('monta sempre http://127.0.0.1:<porta>/tiktok/callback e codifica os parâmetros', () => {
    const url = new URL(buildLoopbackUrl(53682, { code: 'a&b=c#d', state: 'x' }));
    expect(url.origin).toBe('http://127.0.0.1:53682');
    expect(url.pathname).toBe('/tiktok/callback');
    expect(url.hash).toBe('');
    expect(url.searchParams.get('code')).toBe('a&b=c#d');
  });

  it('recusa porta fora do intervalo', () => {
    expect(() => buildLoopbackUrl(80, {})).toThrow(RangeError);
  });
});
