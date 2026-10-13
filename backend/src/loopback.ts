/**
 * Redirect do Login Kit **Desktop** (DEC-027).
 *
 * No portal do TikTok fica cadastrado `http://127.0.0.1:*\/tiktok/callback` (porta curinga). O desktop escolhe
 * uma porta livre a cada login e manda na troca do code a URI realmente usada na autorização — o TikTok exige
 * que as duas sejam iguais. O backend só aceita exatamente este formato: host `127.0.0.1`, caminho fixo,
 * porta decimal sem zero à esquerda entre 1024 e 65535, sem query nem fragmento.
 */
export const LOOPBACK_HOST = '127.0.0.1';
export const LOOPBACK_CALLBACK_PATH = '/tiktok/callback';
/** Valor a cadastrar no portal (Login Kit → Desktop → Redirect URI). */
export const REGISTERED_REDIRECT_URI = `http://${LOOPBACK_HOST}:*${LOOPBACK_CALLBACK_PATH}`;
export const MIN_LOOPBACK_PORT = 1024;
export const MAX_LOOPBACK_PORT = 65535;

const LOOPBACK_REDIRECT_PATTERN = /^http:\/\/127\.0\.0\.1:([1-9][0-9]{3,4})\/tiktok\/callback$/;

/** Devolve a porta se `value` for uma redirect URI loopback válida; senão `null`. */
export function parseLoopbackRedirectUri(value: string): number | null {
  const portText = LOOPBACK_REDIRECT_PATTERN.exec(value)?.[1];
  if (!portText) return null;
  const port = Number(portText);
  return port >= MIN_LOOPBACK_PORT && port <= MAX_LOOPBACK_PORT ? port : null;
}
