# Diário de desenvolvimento

Uma entrada por sessão significativa, **a mais recente no topo**. Objetivo: qualquer pessoa ou agente
retoma o trabalho lendo apenas a última entrada (+ AGENTS.md).

Formato:

```
## Sessão AAAA-MM-DD — <título>
### Objetivo
### Alterações realizadas
### Arquivos importantes
### Decisões
### Problemas encontrados
### Pendências
### Próximo passo
```

---

## Sessão 2026-10-13 (8) — Etapa 5: compositor do TikTok (DEC-029)

### Objetivo

Implementar no compositor tudo que as Content Sharing Guidelines do TikTok exigem antes de publicar, guardando as
escolhas e o consentimento por post. Sem publicação real ainda (etapa 6).

### Alterações realizadas

- Diretrizes e `creator_info` reconferidos na documentação oficial (API_NOTES).
- Rust: `tiktok/creator.rs` (`creator_info`, erros `TIKTOK_CANNOT_POST`), comandos `tiktok_creator_info` e
  `open_tiktok_policy` (URLs fixas). 58 testes, clippy limpo.
- Banco: migration `0003_post_platform_options.sql`; `Post.platformOptions` (Zod, união por plataforma);
  repositório serializa JSON e lê inválido como `null`.
- Regras: `features/posts/tiktokOptionsRules.ts` (pendências, rótulo comercial, declaração, normalização,
  `requiresPostOptions`); `postService` recusa agendar TikTok sem escolhas e grava `consentedAt`; `postPlanner`
  manda posts TikTok com horário para revisão.
- Providers: `SocialProvider.getCreatorInfo` (real no `TikTokProvider`, simulado no mock); `DesktopBridge` com
  `tiktokCreatorInfo` e `openTikTokPolicy`.
- UI: `PostComposerDialog` dividido (`PostComposerForm`, `composerState`, `TikTokPostOptions` com
  `TikTokOptionsSection` e `TikTokDeclaration`); prévia do vídeo reaproveitada da Biblioteca (`MediaVideoPreview`);
  hook `useCreatorInfo` sem cache. Validado no preview: seção aparece com a conta, privacidade sem padrão,
  "Somente eu" bloqueado com conteúdo de marca, rótulo "Parceria paga", declaração correta, "Agendar" bloqueado
  até completar, agendamento ok, sem erros no console.
- Testes: 136 TS (regras, serviço, planner, repositório, provider).

### Arquivos importantes

`src/features/posts/tiktokOptionsRules.ts`, `src/features/posts/components/{PostComposerForm,TikTokPostOptions,composerState}.tsx`,
`src-tauri/src/tiktok/creator.rs`, `src-tauri/migrations/0003_post_platform_options.sql`.

### Decisões

DEC-029.

### Problemas encontrados

- `react-refresh/only-export-components` → estado do formulário movido para `composerState.ts`.
- O limite de uso interrompeu a sessão no meio; retomada sem perda.

### Pendências

- Usuário: validar no app com a conta real (`creator_info` real do `@yeeax`).
- UI em pt-BR × revisores do TikTok: decidir legendas em inglês no vídeo do App Review.

### Próximo passo

Etapa 6 — publicação real pela Content Posting API (Direct Post `FILE_UPLOAD` em chunks, status, "Publicar
agora"/agendador local), revalidando `creator_info` e escolhas antes de enviar.

---

## Sessão 2026-10-13 (7) — Etapa 4: conta conectada na UI (DEC-028)

### Objetivo

Transformar o login já validado em experiência de produto: "Conectar TikTok" sem @, open_id persistido, avatar e
perfil reais, sessão expirada, cancelar login — e, a pedido do usuário, garantir que a conta "volte conectada" ao
reabrir o app (verificação ao abrir).

### Alterações realizadas

- Migration `0002_channel_external_id.sql` (+ `migrations.rs`); `Channel.externalId`; repositório com
  `findByExternalId` e patch de `username`/`externalId`.
- Contratos: `SocialProfile.externalId`, `ProviderCapabilities.officialLogin`, `SocialProvider.cancelConnect?`.
  `TikTokProvider` devolve open_id e avatar (só CDNs do TikTok — `safeAvatarUrl`); CSP `img-src` liberada para eles.
- `features/channels/`: `channelConnector.ts` (connectNew, connectAccount, connect, cancelConnect — duas fases),
  `channelRules.ts` (`isSameAccount`, `profilePatch`), `channelService` com `verifyConnections`, `sync` que marca
  `expired`, `remove` que limpa o cofre. `errors.ts`: `SESSION_LOST_ERROR_CODES`/`isSessionLostError`.
- UI: `AddChannelDialog` (login oficial sem @; "Aguardando autorização"; "Cancelar login"), linha do canal
  ("Cancelar login" durante a conexão, "Reconectar" se expirado), `useConnectionCheck` no `AppLayout`, `Avatar`
  com `referrerPolicy="no-referrer"` e fallback para iniciais.
- Testes: 119 TS (conexão por login oficial, reconexão por open_id/@ legado, rollback, verificação ao abrir,
  expirado, offline, remoção, regras, avatar, repositório + índice único), 53 Rust, clippy limpo.
- Validado no app real: migration 0002 aplicada no banco do usuário; verificação ao abrir preencheu o open_id do
  `@yeeax`. Preview segue simulado.

### Arquivos importantes

`src-tauri/migrations/0002_channel_external_id.sql`, `src/features/channels/{channelConnector,channelRules,channelService,hooks}.ts`,
`src/features/channels/components/AddChannelDialog.tsx`, `src/services/social/TikTokProvider.ts`, `src-tauri/tauri.conf.json`.

### Decisões

DEC-028.

### Problemas encontrados

- Durante a edição, o recarregamento a quente do `tauri dev` carregou o `hooks.ts` novo com o serviço antigo
  (`verifyConnections is not a function`) — some ao recarregar; não afeta builds de produção.
- O usuário estava com o próprio `app:dev` aberto; a instância iniciada pelo agente falhou por porta ocupada
  (sem efeito: o app dele recompilou sozinho com o Rust novo).

### Pendências

- Usuário: validar avatar, conectar sem @, cancelar login (ver TODO).

### Próximo passo

Etapa 5 — compositor TikTok com a UX obrigatória (creator_info, privacidade sem padrão, toggles, divulgação
comercial, aviso de música, prévia) e, em seguida, publicação real pela Content Posting API.

---

## Sessão 2026-10-13 (6) — Deploy do backend e validação real da etapa 3

### Objetivo

Publicar o backend em `api.yeaax.xyz`, configurar o sandbox do TikTok e validar o login real ponta a ponta antes de
qualquer mudança de banco/UI (pedido do usuário: etapa 3 só conclui com o teste real).

### Alterações realizadas

- Push de `d79e376..fe2d310`. Projeto Vercel separado (Root Directory `backend`, Production), variáveis
  `TIKTOK_CLIENT_KEY`/`TIKTOK_CLIENT_SECRET` do **sandbox** (client key `sbaw…`), domínio `api.yeaax.xyz` (CNAME no
  GoDaddy → `…vercel-dns-017.com`). Conferidos `/health` (`configured: true`, cabeçalhos de segurança), `/config` e uma
  troca com code falso (`INVALID_GRANT`).
- Sandbox do TikTok: Desktop, redirect `http://127.0.0.1:*/tiktok/callback`, escopos `user.info.basic`,
  `user.info.profile`, `video.publish` (exigiu ligar Direct Post), `video.upload`; formulário do sandbox (ícone
  1024×1024 gerado do `logo.svg` do site, termos `https://yeaax.xyz/terms.html`, privacidade
  `https://yeaax.xyz/privacy.html`, site `https://yeaax.xyz`).
- **Teste real (todos os itens OK):** autorização oficial "Yeaax Manager (Sandbox)"; redirect para
  `127.0.0.1:62412`; sem erro de redirect_uri/PKCE; troca pelo backend; perfil real `@yeeax`; canal criado;
  credencial `tiktok_token:<channel_id>` no Gerenciador de Credenciais; Sincronizar; Desconectar (revogação sem
  aviso + item apagado); reconexão (porta 54248). Busca no log por padrões de token: nada.
- Endurecimento: `secrets.rs` grava com persistência `Local`; `lib.rs` limita `keyring_core`, `reqwest`, `hyper*`,
  `h2`, `rustls` a WARN no log.

### Arquivos importantes

`src-tauri/src/commands/secrets.rs`, `src-tauri/src/lib.rs`, `docs/SECURITY.md`, `docs/DECISIONS.md` (DEC-027).

### Decisões

Nenhuma nova; complemento da DEC-027 (validação real e endurecimento).

### Problemas encontrados

- Primeira importação na Vercel apontou para o repositório do site (`site yeeax`) — corrigido antes do deploy.
- O sandbox tem formulário próprio (ícone, categoria, descrição, URLs) e só mostra `video.publish` com Direct Post ligado.
- O `tauri dev` em execução não recompilou sozinho após a mudança no Rust feita pelo agente → reiniciar o app.
- Dados de demonstração (@yeaxx…) conflitariam com o @ real; foram removidos pelo usuário antes do teste.

### Pendências

- Nenhuma da etapa 3. Confirmado depois: credencial regravada com "Persistência de máquina local"; conta continua
  conectada após fechar e reabrir o app; Sincronizar ok; `@yeeax` é a conta principal do usuário.

### Próximo passo

Etapa 4 (UI da conta conectada), quando o usuário liberar.

---

## Sessão 2026-10-13 (5) — Etapa 3: `tiktok_connect` (Login Kit Desktop + PKCE)

### Objetivo

Implementar o login real do TikTok no app desktop: listener local, navegador do sistema, troca via backend,
tokens no cofre, perfil e desconexão — com os cuidados pedidos (listener antes do navegador e mesma porta na
troca; listener encerra no primeiro resultado; nada sensível ao frontend; conexão transacional). Sem publicação.

### Alterações realizadas

- Rust `src-tauri/src/tiktok/`: `listener.rs` (bind `127.0.0.1:0`, uso único, timeout 5 min, cancelamento,
  limite de requisições inválidas), `backend.rs` (`/config`, token, refresh, revoke; erros com mensagens fixas),
  `tokens.rs` (cofre por canal, refresh com trava, `Debug` sem valores), `api.rs` (`/v2/user/info/`, valida que é a
  mesma conta), `pending.rs` (conexões pendentes, uso único, 5 min), `secret.rs` (envelope que nunca aparece em
  `Debug`). `commands/tiktok.rs`: `tiktok_connect`, `tiktok_cancel_connect`, `tiktok_commit_connection`,
  `tiktok_discard_connection`, `tiktok_get_profile`, `tiktok_disconnect`. `secrets.rs`: itens `tiktok_token:`
  só internos. Dependências: `tokio`, `tauri-plugin-opener`.
- TS: `DesktopBridge` + implementações (Zod nas respostas; preview rejeita), `SocialProvider.ConnectResult.session`
  (commit/discard), `TikTokProvider` real (desktop) e mock no preview, `channelService.connectNew/connect`
  transacionais, códigos de erro `TIKTOK_*`, status da integração `IN_PROGRESS`, aviso da página Canais.
- Testes: Rust 53 (listener real em 127.0.0.1: ignora inválidas, fecha após sucesso/erro/timeout/cancelamento;
  URL de autorização; conta sem campos sensíveis; tokens sem `Debug`), TS 106 (conexão em duas fases e
  `TikTokProvider`), backend 61. Clippy limpo. Preview validado (TikTok simulado, sem erros no console).

### Arquivos importantes

`src-tauri/src/commands/tiktok.rs`, `src-tauri/src/tiktok/*.rs`, `src/services/social/TikTokProvider.ts`,
`src/features/channels/channelService.ts`, `src/features/channels/channelConnection.test.ts`.

### Decisões

Complemento da DEC-027 (tokens por canal, conexão em duas fases, descarte sem revogar, login único, novas deps).

### Problemas encontrados

- `reqwest` 0.13 não traz `.query()` sem feature → URL montada com `url::Url::parse_with_params`.
- `erasableSyntaxOnly` proíbe parameter properties no construtor → campo explícito.

### Pendências

- Teste real (usuário): backend publicado, portal como Desktop, conta de teste no sandbox.
- Etapa 4: UI da conta conectada (botão sem @, `external_id`, avatar/CSP, `expired`, cancelar login).

### Próximo passo

Teste real da conexão no sandbox; depois etapa 4.

---

## Sessão 2026-10-13 (4) — Login Kit Desktop + PKCE (DEC-027)

### Objetivo

Trocar o login do TikTok de Web (callback HTTPS + repasse) para **Desktop + PKCE** com redirect direto ao loopback,
a pedido do usuário, antes da etapa 3. Confirmar na documentação oficial a sintaxe do redirect e o formato do
`code_challenge`.

### Alterações realizadas

- Documentação oficial confirmada (2026-10-13): redirect `http://127.0.0.1:*/tiktok/callback` é válido (porta
  curinga suportada e recomendada); `code_challenge` = SHA-256 do verifier em **hex** (não base64url); `S256`.
- Backend: removidos `GET /auth/tiktok/callback`, `oauthState.ts` e a variável `TIKTOK_REDIRECT_URI`;
  `POST /auth/tiktok/token` exige `{ code, codeVerifier, redirectUri }` com redirect só no formato loopback
  (`src/loopback.ts`); `/config` informa redirect e PKCE. 61 testes.
- Rust: `src-tauri/src/tiktok/pkce.rs` (state/verifier via `getrandom`, challenge hex, comparação em tempo
  constante) e `tiktok/loopback.rs` (validação pura do callback: GET, caminho exato, Host, state antes de
  code/error, parâmetros repetidos, tamanho). 16 testes novos (29 no total). Ainda não ligados a comandos.
- Docs: DEC-027 (DEC-024 marcada como substituída), SECURITY, ARCHITECTURE, INTEGRATIONS, API_NOTES, ROADMAP,
  TODO, CHANGELOG, README, PROJECT, AGENTS, `backend/README.md`, `backend/.env.example`.

### Arquivos importantes

`src-tauri/src/tiktok/{mod,pkce,loopback}.rs`, `src-tauri/Cargo.toml`, `backend/src/loopback.ts`,
`backend/src/routes/tiktokAuth.ts`, `docs/DECISIONS.md` (DEC-027).

### Decisões

DEC-027. Dependências Rust novas: `getrandom` 0.3, `sha2` 0.10, `url` 2 (já estavam na árvore via Tauri).

### Problemas encontrados

- Heredocs longos no Bash do Windows voltaram a falhar ("unexpected EOF") → scripts de edição gravados em arquivo
  no scratchpad e executados com `python -I`.

### Pendências

- Usuário: portal do TikTok como **Desktop** com `http://127.0.0.1:*/tiktok/callback`; push e deploy do backend
  (sem `TIKTOK_REDIRECT_URI`).

### Próximo passo

Etapa 3 (após aprovação da lista de arquivos): comando `tiktok_connect` — `/config` do backend, listener
`127.0.0.1:0` com timeout de 5 min, `tauri-plugin-opener` para abrir a autorização, troca via backend, tokens no
Credential Manager, perfil via `/v2/user/info/`.

---

## Sessão 2026-10-13 (3) — Etapa 2: revisão da DEC-024 e backend mínimo

### Objetivo

Revisar a segurança da DEC-024 contra a documentação atual do Login Kit e criar o `backend/` (Node + TypeScript)
com `/health`, `/config`, `/auth/tiktok/{callback,token,refresh,revoke}`. Sem push.

### Alterações realizadas

- `backend/` como serviço separado: função única da Vercel (`api/index.ts`, export `fetch`) + rewrite em
  `vercel.json`; roteamento em `src/app.ts`; `src/oauthState.ts` (formato do `state` e repasse só para
  `127.0.0.1:<porta>`); `src/tiktok/oauthClient.ts` (token/refresh/revoke com o secret, timeout 10 s, erros
  normalizados); `src/http.ts` (cabeçalhos de segurança, leitura de JSON com limite); `src/rateLimit.ts`;
  `src/logger.ts` (JSON com redação); `src/config.ts` (env validado com Zod; só nomes de variáveis inválidas
  vão para o log). 62 testes (Vitest, `fetch` injetado). `backend/.env.example` só com nomes/placeholders.
- Raiz: ESLint ignora `backend/` (lint próprio), script `npm run backend:check`, `.vercel/` no `.gitignore`.
- Revisão da DEC-024 (8 itens) em DECISIONS.md, incluindo a **divergência** sobre refresh tokens no Credential
  Manager (também em SECURITY.md) e a comparação Web × Desktop+PKCE. DEC-026 (backend sem framework).
- Docs: ARCHITECTURE (rotas implementadas), SECURITY, INTEGRATIONS, ROADMAP, TODO, CHANGELOG, README,
  `backend/README.md` (rotas, segurança, deploy).

### Arquivos importantes

`backend/src/app.ts`, `backend/src/oauthState.ts`, `backend/src/tiktok/oauthClient.ts`,
`backend/src/routes/tiktokAuth.ts`, `backend/README.md`, `docs/DECISIONS.md` (revisão da DEC-024, DEC-026).

### Decisões

DEC-026. DEC-024 mantida como Web; a troca para Desktop + PKCE ficou para o usuário decidir (recomendação técnica:
Desktop + PKCE é o padrão para apps nativos — RFC 8252 — e o backend já aceita `codeVerifier`).

### Problemas encontrados

- Heredoc grande no Bash do Windows falhou ("unexpected EOF") → arquivos criados com a ferramenta de escrita.
- Não foi possível validar o empacotamento na Vercel localmente (rewrite preservando o caminho e imports `.js`
  apontando para `.ts`): conferir `/health` e `/config` logo após o primeiro deploy.

### Pendências

- Usuário: decidir Web × Desktop+PKCE; push; projeto Vercel (Root Directory `backend`), variáveis, domínio
  `api.yeaax.xyz`; portal do TikTok (lista em `docs/TODO.md`).

### Próximo passo

Depois do deploy e da decisão: etapa 3 — OAuth no Rust (`state` CSPRNG, listener `127.0.0.1`, navegador do
sistema via `tauri-plugin-opener`, troca pelo backend, tokens no Credential Manager `tiktok_token:<open_id>`).

---

## Sessão 2026-10-13 (2) — Auditoria e arquitetura do TikTok real (etapa 1)

### Objetivo

Início da fase "protótipo + mocks → app real + TikTok API + domínio + backend mínimo". Auditar o estado atual,
propor a arquitetura e documentar as decisões antes de escrever código de integração.

### Alterações realizadas

- Auditoria: `npm run check` (96 testes) e `cargo test` (13 testes) verdes. TikTok 100% mock
  (`TikTokProvider extends MockSocialProvider`); **não existe publicador** (`publish()` não é chamado); canal sem id
  externo; posts sem opções por plataforma; cofre com lista fixa de um segredo.
- Verificadas as páginas oficiais atuais do TikTok (Login Kit Web/Desktop, tokens, sandbox, escopos) →
  `API_NOTES.md` ("Verificação de 2026-10-13").
- Decisões novas: DEC-023 (backend mínimo sem estado em `api.yeaax.xyz`, pasta `backend/`, projeto Vercel
  separado), DEC-024 (Login Kit Web; callback HTTPS repassa o `code` ao loopback do desktop; tokens só no
  Credential Manager; chamadas de API e upload direto do Rust), DEC-025 (nome exibido "Yeaax Manager", identificador
  mantido). DEC-020 marcada como substituída parcialmente. DEC-022 entrou no índice (faltava).
- Docs atualizados: PROJECT (princípios "sem servidor" → backend mínimo), ARCHITECTURE (backend + fluxo OAuth),
  SECURITY (secrets no backend, OAuth, backend), INTEGRATIONS (plano TikTok em 8 etapas), ROADMAP, TODO, CHANGELOG,
  README, AGENTS (regra de secrets no backend).
- Nome exibido trocado para "Yeaax Manager" (`productName`, título da janela, `APP_NAME`, `index.html`, mensagens).
- `.env.example` da raiz sem client secrets.

### Arquivos importantes

`docs/DECISIONS.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `docs/INTEGRATIONS.md`, `docs/API_NOTES.md`,
`.env.example`, `src-tauri/tauri.conf.json`, `src/lib/runtime.ts`.

### Decisões

DEC-023, DEC-024, DEC-025 (respostas do usuário: Login Kit Web; backend em `backend/` como serviço separado na
Vercel; incluir `user.info.profile`; renomear só o nome exibido).

### Problemas encontrados

- O fluxo Web do TikTok não documenta PKCE e o PKCE do Desktop usa hex — a segurança do repasse vem do `state`
  validado pelo desktop; testar PKCE no sandbox como defesa extra.
- Sandbox não permite vídeo público; sem auditoria só `SELF_ONLY` em conta privada (suficiente para a demonstração).

### Pendências

- Usuário: configurar o portal do TikTok, o projeto Vercel e o DNS de `api.yeaax.xyz` (lista em `docs/TODO.md`).

### Próximo passo

Etapa 2: criar `backend/` (Node + TypeScript, Vercel Functions, Zod, Vitest) com `health`, `auth/tiktok/config`,
`callback` (repasse para `127.0.0.1:<porta>` validado), `token`, `refresh`, `revoke` e `backend/.env.example`.

---

## Sessão 2026-10-13 — Repositório no GitHub

### Objetivo

Preparar o commit e o envio do projeto para `ArthurScharfenberger/yeaax-manager`, conforme solicitado.

### Alterações realizadas

- Configurado `origin` para `https://github.com/ArthurScharfenberger/yeaax-manager.git`.
- Adicionado o link do repositório ao README; mantidos a branch `main` e os commits existentes.

### Arquivos importantes

`README.md`, `docs/DEVELOPMENT_LOG.md`, `docs/TODO.md`, `docs/ROADMAP.md`.

### Decisões

Preservar o histórico local existente. Nenhuma mudança de arquitetura, dependências ou versão.

### Problemas encontrados

A sandbox bloqueou o acesso ao GitHub e a inicialização dos testes (`spawn EPERM`); as verificações
foram repetidas com execução autorizada fora da sandbox.

### Validação

`npm run check` passou: TypeScript, lint, formatação e 96 testes. O remoto estava vazio antes do envio.
Nenhum código de aplicação foi alterado nesta sessão.

### Pendências

Permanecem as validações funcionais e integrações listadas em `TODO.md`.

### Próximo passo

Validar a conexão com OpenAI no desktop usando a chave do usuário e continuar a integração oficial do Instagram.

---

## Sessão 2026-10-07 (4) — "Postar com IA" com OpenAI

### Objetivo

Automatizar o máximo possível: importar o vídeo, descrever o que se quer ("legenda em inglês com boas hashtags") e a
IA executar — respeitando a confirmação por post exigida pelo TikTok (DEC-019).

### Alterações realizadas

- Contas do Instagram confirmadas como profissionais pelo usuário. Provedor de IA escolhido: **OpenAI**.
- Rust: `commands/secrets.rs` (Gerenciador de Credenciais via `keyring-core`), `commands/ai.rs`
  (`ai_chat_completion` com `reqwest`/rustls). DEC-022.
- `OpenAIProvider` (Structured Outputs estrito, canais por `enum`, miniatura como imagem), `AIService` (OpenAI com
  chave; simulador local sem chave), `mockPlanner` (regras: idioma, plataforma, canal, horário).
- `postPlanner` + `postPlanRules`: contexto (canais, horários do Auto Schedule, miniatura), validação da resposta,
  canais que já têm o vídeo saem do plano, resolução de horário, confirmação com histórico de origem.
- UI: `AiPostDialog` + `AiPlanReview` (botão "Postar com IA" no painel do vídeo), Configurações → IA (chave,
  modelo, testar conexão), Legendas IA com selo dinâmico e erros visíveis; após importar, o vídeo novo abre
  selecionado.
- Modal: foco inicial via `data-autofocus` (o `autoFocus` do React é perdido no `showModal`).

### Validação

`npm run check` (96 testes), `cargo test` (13) + clippy, `npm run build`. No preview (simulador): pedido "Poste no
instagram da yeaxx com uma legenda em inglês e boas hashtags, amanhã às 19h" → plano correto → confirmado → "1
post agendado · Amanhã 19:00"; com vídeo já agendado no canal, o plano avisa e remove o canal. **A chamada real à
OpenAI ainda não foi testada** (depende da chave do usuário).

### Pendências

- Usuário: chave da OpenAI → Configurações → IA → "Testar conexão" → "Postar com IA" num vídeo real.
- Publicação real ainda não existe: os posts ficam agendados (próximo: Instagram real).

### Próximo passo

Instagram real (Fase 3): o usuário cria o app na Meta e cola o token; o app guarda no cofre, renova e publica Reels
por upload resumável no horário agendado (agendador local).

---

## Sessão 2026-10-07 (3) — Pesquisa das APIs, página Posts, duplicar e logs em arquivo

### Objetivo

Verificar a viabilidade das APIs oficiais do TikTok e do Instagram e preparar o app para uso diário.

### Alterações realizadas

- `docs/API_NOTES.md` reescrito com notas verificadas na documentação oficial; DEC-019 (consentimento por post,
  Auto Schedule só sugere) e DEC-020 (credenciais do próprio usuário). Limite de 20 menções do Instagram no código.
- Página **Posts** (`/posts`, `PostsPage` + `PostsTable`), filtro `hasSchedule` no repositório, hook compartilhado
  `useUrlParams` (também usado pela Biblioteca).
- **Duplicar para outro canal**: `postService.duplicateToChannels` (cópias como rascunho, histórico com a origem,
  falhas por canal) + `DuplicatePostDialog` com pré-seleção da mesma marca.
- **Logs em arquivo**: `tauri-plugin-log` (Rust + npm 2.10.0), `logger.addSink`, `fileLogSink.ts`, pasta exibida em
  Configurações → Sobre. DEC-021.

### Arquivos importantes

`docs/API_NOTES.md`, `src/features/posts/PostsPage.tsx`, `src/features/posts/components/DuplicatePostDialog.tsx`,
`src/features/posts/postService.ts`, `src/hooks/useUrlParams.ts`, `src/lib/logger.ts`,
`src/services/desktop/fileLogSink.ts`, `src-tauri/src/lib.rs`.

### Problemas encontrados

- No primeiro teste do duplicar, um clique por coordenada caiu fora do botão e fechou o diálogo pelo fundo —
  falha da automação, não do app (repetido via referência do botão: funcionou).

### Validação

`npm run check` (80 testes), `cargo test` (8) e clippy sem avisos. No preview: filtro "Sem data" (2 rascunhos) e
duplicar Gol GTI (TikTok YEAXX → Instagram YEAXX) criando o rascunho. Logs em arquivo **ainda não verificados no
desktop**.

### Pendências

- Validar no desktop (reiniciar o `app:dev`): página Posts, duplicar, criação do arquivo de log.
- Decisões do usuário: contas do Instagram profissionais? Auditoria do app no TikTok ou modo rascunho?

### Próximo passo

Com as decisões do usuário, iniciar a Fase 3 pelo Instagram (credenciais no Credential Manager + publicação de
Reels por upload resumável), ou o backup do banco se preferir segurança antes.

---

## Sessão 2026-10-07 (2) — Miniaturas sem FFmpeg

### Objetivo

Exibir miniaturas reais na biblioteca (antes só placeholders), sem depender do FFmpeg.

### Alterações realizadas

- `src/services/media/videoAnalysis.ts` (substitui `videoMetadata.ts`): um único `<video>` fora do DOM lê
  duração/resolução e captura um quadro (~1 s) em JPEG de até 360 px via canvas. Fallback sem CORS para metadados.
- Rust `commands/thumbnails.rs`: `save_thumbnail` (bytes via IPC binário, id no header `media-id`, valida id e
  assinatura JPEG, máx. 2 MB) e `delete_thumbnail`. Arquivos em `%APPDATA%\com.socialmanager.desktop\thumbnails\<id>.jpg`.
- Asset protocol: escopo estático `$APPDATA/thumbnails/*` (miniaturas visíveis após reiniciar o app).
- `mediaService`: a importação grava a miniatura automaticamente; `generateMissingThumbnails()` gera, em segundo
  plano e um por vez, as que faltam (vídeos antigos ou falhas), disparado ao abrir o app
  (`useThumbnailBackfill` no `AppLayout`); cada vídeo é tentado uma vez por sessão. Remover da biblioteca apaga a
  miniatura. Falhas de miniatura nunca bloqueiam a importação.
- O botão manual "Gerar miniatura" (primeira versão) foi removido a pedido do usuário: miniaturas são sempre
  automáticas.
- Testes: `mediaService.test.ts` (6) e 3 testes Rust de validação.

### Arquivos importantes

`src/services/media/videoAnalysis.ts`, `src/features/media/mediaService.ts`,
`src-tauri/src/commands/thumbnails.rs`, `src-tauri/tauri.conf.json` (assetProtocol.scope).

### Decisões

DEC-018 (miniaturas via WebView2 + gravação no Rust). DEC-016 atualizada (escopo da pasta de miniaturas).

### Problemas encontrados

- **Sandbox do agente:** os comandos do agente enxergam `%APPDATA%` através de uma camada própria; arquivos
  criados por processos do agente (inclusive o `.exe` lançado por ele) não aparecem para o app do usuário e
  vice-versa. Isso gerou um falso alarme de perda de dados. Regra nova no AGENTS.md (seção 4.1).
- O PowerShell do usuário bloqueia `npm.ps1` (ExecutionPolicy). Documentado no README (`npm.cmd` ou cmd).

### Validação

`npm run check` e `cargo test` (8) + clippy sem avisos. **Validado no app desktop pelo usuário:** miniatura do
`white.mp4` gerada (JPEG 360×640, quadro correto) — confirma o CORS do protocolo `asset:` (conferido também no
código-fonte do Tauri 2.12: `Access-Control-Allow-Origin` = origem da janela).

### Pendências

- Confirmar no app: miniatura automática ao importar um vídeo novo.
- Testar `.mov`/`.webm` (codecs que o WebView2 não decodifica ficam sem miniatura até o FFmpeg).

### Próximo passo

Confirmar a miniatura automática na importação. Depois: backup/restauração do banco ou início do FFmpeg (ffprobe).

---

## Sessão 2026-10-07 — Fundação do projeto (v0.1.0)

### Objetivo

Criar a fundação completa do Social Manager: ambiente, projeto Tauri + React, banco local, layout, telas
principais com dados de demonstração, providers simulados, testes e documentação.

### Alterações realizadas

- **Ambiente (Windows 11):** Node 20.12 (EOL) → **Node 24.19 LTS**; instalados **Rust 1.99** (rustup,
  stable-msvc) e **VS 2022 Build Tools** (C++). WebView2 já presente. Tudo via winget, com autorização do usuário.
- **Git:** a pasta do usuário (`C:\Users\ascha`) já era um repositório Git; foi criado um repositório próprio em
  `Desktop\StoryManager` (branch `main`) para isolar o projeto.
- Projeto criado manualmente (sem template) com Tauri 2.12, React 19.3, TypeScript 6.0, Vite 8, Tailwind 4,
  TanStack Query 5, Zod 4, React Router 8, lucide-react; dev: ESLint 10 + typescript-eslint, Prettier, Vitest 5,
  SQLite WASM (preview).
- Rust: plugins SQL (sqlite) e dialog; comandos `inspect_media_file` e `detect_ffmpeg`; migration inicial; 5 testes.
- Frontend: camadas `types → db → services → features → app`, design system próprio, 8 páginas, busca global,
  compositor/detalhes de post, calendário com drag-and-drop, dados de demonstração.
- Documentação completa em `docs/` + README + AGENTS.md + CLAUDE.md.

### Arquivos importantes

- `src/app/services.ts` (composition root) e `src/app/bootstrap.ts` (inicialização)
- `src/db/` (todo o SQL) e `src-tauri/migrations/0001_initial_schema.sql`
- `src/features/posts/postService.ts` + `postRules.ts` (regras centrais de posts)
- `src/services/social/SocialProvider.ts` (contrato das integrações)
- `src/components/ui/` (design system) e `src/styles/index.css` (tokens)
- `src-tauri/src/commands/media.rs`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`

### Decisões

DEC-001 a DEC-017 registradas em `docs/DECISIONS.md`. Destaques: enums sem `CHECK` (DEC-007), sem transações
entre chamadas (DEC-008), preview com SQLite WASM (DEC-009), DnD HTML5 com `dragDropEnabled: false` (DEC-010),
asset protocol com autorização por arquivo (DEC-016), TypeScript 6.0 por compatibilidade com typescript-eslint (DEC-015).

### Problemas encontrados

- Node 20.12 incompatível com Vite 8 / ESLint 10 / Vitest 5 → atualização para Node 24 (DEC-015).
- TypeScript 7 não suportado pelo typescript-eslint → fixado `~6.0.3`.
- `FormEvent` está depreciado no `@types/react` atual → usar `SubmitEvent`.
- Classes Tailwind conflitantes (`w-full` vs `w-40`) não se resolvem pela ordem → componentes base sem largura padrão.
- `setSearchParams` funcional do React Router não encadeia chamadas no mesmo tick → atualização em lote (`update({...})`).
- O drag simulado pela ferramenta de automação não dispara DnD HTML5; a lógica foi validada com `DragEvent`s reais via JS.
- Rolagem inicial do calendário usava `offsetTop` relativo ao elemento errado → contêiner `relative`.

### Validação

- `npm run typecheck`, `npm run lint`, `npm run format:check`: sem erros.
- `npm run test`: 11 arquivos, todos passando (regras, serviços e repositórios contra SQLite real em memória).
- `cargo test`: 5 testes passando.
- `npm run build` e `npx tauri build --no-bundle`: sucesso (`src-tauri/target/release/social-manager.exe`).
- Preview no navegador: todas as páginas navegadas; criar/editar post, reagendar por DnD (inclusive bloqueio de
  horário passado), gerar legendas, filtros da biblioteca.
- Teste de fumaça do executável de release: banco criado em `%APPDATA%\com.socialmanager.desktop\`, migration 1
  aplicada, dados de demonstração gravados via IPC (5 canais, 10 vídeos, 15 posts, 36 eventos).

### Validação do usuário (mesma sessão)

- Importação real via `npm run app:dev` **funcionou**: `white.mp4` gravado com tamanho correto, duração 25,3 s e
  resolução 576×1024 (metadados lidos pelo WebView2 — DEC-017 confirmada para MP4).
- Preview do vídeo no painel de detalhes **funcionou**; persistência após fechar/reabrir confirmada.
- **Falso alarme (resolvido):** parecia que o banco tinha sido recriado ao abrir o `app:dev`. Causa real: os
  comandos do agente rodam em um sandbox com camada própria de arquivos — o banco criado pelo teste de fumaça
  existia só nessa camada, então o app do usuário criou o seu (correto). As "versões alternando" eram leituras
  do agente vendo ora a camada, ora o arquivo real. O banco real nunca perdeu dados. Ver aviso em AGENTS.md.

### Pendências

- Validar `.mov` e `.webm` reais.
- Ver `docs/TODO.md` (Agora/Próximo).

### Próximo passo

Ver a sessão seguinte (miniaturas).
