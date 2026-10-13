import { describe, expect, it } from 'vitest';

import { parseLoopbackRedirectUri, REGISTERED_REDIRECT_URI } from './loopback.js';

describe('parseLoopbackRedirectUri', () => {
  it('aceita http://127.0.0.1:<porta>/tiktok/callback com porta 1024–65535', () => {
    expect(parseLoopbackRedirectUri('http://127.0.0.1:53682/tiktok/callback')).toBe(53682);
    expect(parseLoopbackRedirectUri('http://127.0.0.1:1024/tiktok/callback')).toBe(1024);
    expect(parseLoopbackRedirectUri('http://127.0.0.1:65535/tiktok/callback')).toBe(65535);
  });

  it.each([
    'http://127.0.0.1:*/tiktok/callback',
    'http://127.0.0.1:1023/tiktok/callback',
    'http://127.0.0.1:65536/tiktok/callback',
    'http://127.0.0.1:08080/tiktok/callback',
    'http://127.0.0.1/tiktok/callback',
    'http://localhost:53682/tiktok/callback',
    'http://[::1]:53682/tiktok/callback',
    'https://127.0.0.1:53682/tiktok/callback',
    'http://127.0.0.1.evil.example:53682/tiktok/callback',
    'http://evil.example@127.0.0.1:53682/tiktok/callback',
    'http://127.0.0.1:53682@evil.example/tiktok/callback',
    'http://127.0.0.1:53682/tiktok/callback/',
    'http://127.0.0.1:53682/tiktok/callback?x=1',
    'http://127.0.0.1:53682/tiktok/callback#x',
    'http://127.0.0.1:53682/tiktok/../callback',
    'HTTP://127.0.0.1:53682/tiktok/callback',
    ' http://127.0.0.1:53682/tiktok/callback',
  ])('rejeita %s', (value) => {
    expect(parseLoopbackRedirectUri(value)).toBeNull();
  });

  it('documenta o valor cadastrado no portal (porta curinga)', () => {
    expect(REGISTERED_REDIRECT_URI).toBe('http://127.0.0.1:*/tiktok/callback');
  });
});
