import { ApiError } from './errors.js';

/** Aplicados a todas as respostas. A API não serve conteúdo para navegadores além da página de erro. */
export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'cache-control': 'no-store',
  'content-security-policy':
    "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",
  'referrer-policy': 'no-referrer',
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
};

/** Tamanho máximo do corpo JSON aceito (os maiores campos são tokens). */
export const MAX_JSON_BODY_BYTES = 8 * 1024;

export function jsonResponse(
  status: number,
  body: unknown,
  headers: Readonly<Record<string, string>> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

export function errorResponse(error: ApiError): Response {
  return jsonResponse(
    error.status,
    { error: { code: error.code, message: error.message } },
    error.headers,
  );
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
}

/** Página mínima para o navegador (callback com link inválido). Só texto fixo, escapado. */
export function htmlResponse(status: number, title: string, message: string): Response {
  const body = `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="font-family: system-ui, sans-serif; max-width: 32rem; margin: 4rem auto; padding: 0 1rem; color: #1f2937">
<h1 style="font-size: 1.25rem">${escapeHtml(title)}</h1>
<p>${escapeHtml(message)}</p>
</body>
</html>`;
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

export function redirectResponse(location: string): Response {
  return new Response(null, { status: 302, headers: { location } });
}

/** Devolve uma cópia da resposta com os cabeçalhos de segurança (sem sobrescrever os definidos). */
export function withSecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    if (!headers.has(name)) headers.set(name, value);
  }
  return new Response(response.body, { status: response.status, headers });
}

/**
 * Lê e faz o parse do corpo JSON com limite de tamanho.
 * Exige `Content-Type: application/json`, o que também força preflight CORS em navegadores.
 */
export async function readJsonBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type') ?? '';
  if (!/^application\/json(\s*;|$)/i.test(contentType)) {
    throw new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Envie o corpo como application/json.');
  }
  const declared = Number(request.headers.get('content-length') ?? '0');
  if (declared > MAX_JSON_BODY_BYTES) {
    throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Corpo da requisição grande demais.');
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > MAX_JSON_BODY_BYTES) {
    throw new ApiError(413, 'PAYLOAD_TOO_LARGE', 'Corpo da requisição grande demais.');
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'Corpo JSON inválido.');
  }
}

/**
 * IP do cliente para o rate limit. Na Vercel, `x-vercel-forwarded-for`/`x-forwarded-for` são definidos
 * pela borda (o valor enviado pelo cliente é sobrescrito). Nunca é registrado em log.
 */
export function clientIp(request: Request): string {
  const forwarded =
    request.headers.get('x-vercel-forwarded-for') ??
    request.headers.get('x-forwarded-for') ??
    request.headers.get('x-real-ip');
  return forwarded?.split(',')[0]?.trim() || 'unknown';
}
