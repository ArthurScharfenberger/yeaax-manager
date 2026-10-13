/**
 * Formato do `state` do OAuth do TikTok e montagem do repasse ao desktop (DEC-024).
 *
 * O desktop gera `state = <nonce>.<porta>`:
 *  - `nonce`: 32 bytes do CSPRNG do sistema em base64url sem padding (exatamente 43 caracteres);
 *  - `porta`: porta do listener loopback do desktop, decimal sem zeros à esquerda, 1024–65535.
 *
 * O backend só confere o FORMATO (não conhece o nonce — é stateless). Quem valida o valor, em tempo
 * constante e uma única vez, é o desktop. O destino do repasse é sempre
 * `http://127.0.0.1:<porta>/tiktok/callback`: host e caminho fixos, só a porta vem do `state` —
 * não existe open redirect.
 */
export const STATE_NONCE_LENGTH = 43;
export const LOOPBACK_HOST = '127.0.0.1';
export const LOOPBACK_CALLBACK_PATH = '/tiktok/callback';
export const MIN_LOOPBACK_PORT = 1024;
export const MAX_LOOPBACK_PORT = 65535;

const STATE_PATTERN = /^([A-Za-z0-9_-]{43})\.([1-9][0-9]{3,4})$/;

export interface ParsedState {
  nonce: string;
  port: number;
}

function isAllowedPort(port: number): boolean {
  return Number.isInteger(port) && port >= MIN_LOOPBACK_PORT && port <= MAX_LOOPBACK_PORT;
}

export function parseState(state: string | null): ParsedState | null {
  if (state === null) return null;
  const match = STATE_PATTERN.exec(state);
  const nonce = match?.[1];
  const portText = match?.[2];
  if (!nonce || !portText) return null;
  const port = Number(portText);
  return isAllowedPort(port) ? { nonce, port } : null;
}

/** URL de repasse ao listener loopback. Parâmetros são codificados pelo `URLSearchParams`. */
export function buildLoopbackUrl(port: number, params: Readonly<Record<string, string>>): string {
  if (!isAllowedPort(port)) throw new RangeError('porta fora do intervalo permitido');
  const url = new URL(`http://${LOOPBACK_HOST}:${port}${LOOPBACK_CALLBACK_PATH}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}
