# Yeaax Manager API (backend mínimo)

Serviço **separado** do app desktop, publicado como projeto próprio na Vercel em `https://api.yeaax.xyz`.
Existe só para o que exige servidor público: callback OAuth HTTPS e uso do `client_secret` (DEC-023, DEC-024).

- **Sem estado:** sem banco, sem sessão, não guarda tokens nem codes.
- **Nenhuma mídia** passa por aqui: o upload vai do desktop direto para o TikTok.
- O app desktop **não importa** código desta pasta (e vice-versa).

## Rotas

| Rota                        | Quem chama              | Função                                                                     | Rate limit (por IP/instância) |
| --------------------------- | ----------------------- | -------------------------------------------------------------------------- | ----------------------------- |
| `GET /health`               | monitoramento           | `{ status, service, version, configured }`                                 | —                             |
| `GET /config`               | desktop (Rust)          | `client_key`, URL de autorização, `redirect_uri`, escopos (dados públicos) | 60/min                        |
| `GET /auth/tiktok/callback` | navegador (vindo do TT) | valida o formato do `state` e repassa `code`/`state`/`scopes` ao loopback  | 30/min                        |
| `POST /auth/tiktok/token`   | desktop (Rust)          | `{ code, codeVerifier? }` → tokens (usa o secret)                          | 10/min                        |
| `POST /auth/tiktok/refresh` | desktop (Rust)          | `{ refreshToken }` → tokens novos (usa o secret)                           | 30/min                        |
| `POST /auth/tiktok/revoke`  | desktop (Rust)          | `{ accessToken }` → `204` (usa o secret)                                   | 10/min                        |

Erros sempre em `{ "error": { "code": "...", "message": "..." } }` com mensagens fixas — o corpo do TikTok nunca
é repassado. Códigos: `INVALID_INPUT`, `INVALID_JSON`, `UNSUPPORTED_MEDIA_TYPE`, `PAYLOAD_TOO_LARGE`,
`FORBIDDEN_ORIGIN`, `RATE_LIMITED`, `NOT_CONFIGURED`, `INVALID_GRANT`, `UPSTREAM_REJECTED`,
`UPSTREAM_RATE_LIMITED`, `UPSTREAM_UNAVAILABLE`, `UPSTREAM_INVALID_RESPONSE`, `NOT_FOUND`, `METHOD_NOT_ALLOWED`,
`INTERNAL`.

## Segurança

- **Callback sem open redirect:** destino fixo `http://127.0.0.1:<porta>/tiktok/callback`; só a porta vem do
  `state` (`<nonce de 43 caracteres base64url>.<porta 1024–65535>`). `state` inválido → página de erro, sem redirect.
- **CORS fechado:** nenhuma resposta tem `Access-Control-Allow-*`; rotas `POST` recusam qualquer requisição com
  `Origin` (navegadores) e exigem `Content-Type: application/json` (corpo até 8 KB, schema estrito com Zod).
- **Logs** (JSON no stdout): só evento, método, caminho sem query, status e duração. Nunca code, state, tokens,
  secret, IP ou corpo; campos com nomes sensíveis são redigidos por garantia (testado).
- **Rate limit** em memória por instância (melhor esforço). Recomendado complementar com uma regra no Firewall da
  Vercel (ex.: 20 req/min por IP em `/auth/*`).
- Cabeçalhos em todas as respostas: `Cache-Control: no-store`, `Referrer-Policy: no-referrer`,
  `X-Content-Type-Options: nosniff`, CSP `default-src 'none'`, `X-Frame-Options: DENY`.
- Timeout de 10 s nas chamadas ao TikTok.

## Variáveis de ambiente

Ver [`.env.example`](.env.example). Valores reais **só** na Vercel (Settings → Environment Variables, marcadas
como _Sensitive_, ambiente **Production**). Sem elas, `/config` e as rotas `POST` respondem `503 NOT_CONFIGURED`
e `/health` mostra `configured: false`.

## Desenvolvimento

```bash
cd backend
npm install
npm run check      # typecheck + lint + testes (Vitest, sem rede: o fetch é injetado)
```

Na raiz: `npm run backend:check`. A formatação (Prettier) é verificada pelo `npm run check` da raiz.

## Deploy (Vercel)

1. Vercel → **Add New → Project** → importar o repositório `yeaax-manager`.
2. **Root Directory:** `backend` · **Framework Preset:** Other · sem build/output command · Node.js **24.x**.
3. Environment Variables (Production): `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`, `TIKTOK_REDIRECT_URI`
   (opcional: `TIKTOK_SCOPES`).
4. Settings → **Domains** → `api.yeaax.xyz` (a Vercel mostra o registro DNS, normalmente `CNAME api →`
   valor indicado pela Vercel; automático se o domínio já usa o DNS da Vercel).
5. Conferir: `https://api.yeaax.xyz/health` → `"configured": true`; `https://api.yeaax.xyz/config` → dados públicos.

Todas as rotas chegam à função única `api/index.ts` pelo rewrite de `vercel.json` (recomendação da Vercel: uma
função com roteamento interno).
