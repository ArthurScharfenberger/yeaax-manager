# Arquitetura

> Atualize este documento sempre que camadas, pastas ou fluxos mudarem. Decisões e alternativas ficam em
> [DECISIONS.md](DECISIONS.md).

## Visão geral

```
┌────────────────────────────── App desktop (Tauri 2) ──────────────────────────────┐
│                                                                                    │
│  WebView2 (frontend React/TypeScript)                       Processo Rust          │
│  ┌──────────────────────────────────────────────┐          ┌───────────────────┐  │
│  │ app/        shell, rotas, composição          │          │ tauri-plugin-sql  │  │
│  │ features/   páginas + hooks + casos de uso    │  invoke  │  └ migrations     │──┼─► SQLite (arquivo)
│  │   └ *Service.ts / *Rules.ts (regras)          │ ───────► │ tauri-plugin-dialog│  │
│  │ db/         DbClient + repositórios (SQL)     │          │ commands/         │  │
│  │ services/   social · ai · media · desktop     │          │  inspect_media_file│─┼─► arquivos locais
│  │ lib/ types/ utils/ components/                │          │  detect_ffmpeg    │──┼─► ffmpeg (PATH)
│  └──────────────────────────────────────────────┘          └───────────────────┘  │
└────────────────────────────────────────────────────────────────────────────────────┘
```

- **Regras de negócio vivem no TypeScript.** O Rust cuida apenas do que exige o sistema operacional:
  banco (via plugin), diálogos, inspeção de arquivos, processos externos e, no futuro, credenciais e OAuth.
- **Local-first.** Dados, vídeos e tokens ficam no computador. Chamadas de rede saem só do Rust: OpenAI
  (DEC-022), APIs das plataformas e o backend mínimo (DEC-023).

### Backend mínimo (`backend/` → `https://api.yeaax.xyz`)

Serviço **separado** do app desktop (projeto Vercel próprio, `package.json` próprio), mas no mesmo repositório.
Sem banco e sem estado: existe só porque o `client_secret` não pode ir no app (o TikTok o exige na troca e no refresh).

```
 Desktop (Rust)  ──HTTPS──►  api.yeaax.xyz (Vercel Functions)  ──►  TikTok OAuth (token/refresh/revoke)
      │                         └─ futuro: Meta/Instagram, webhooks, API/MCP
      └────────HTTPS (token do usuário, upload do vídeo)────────►  open.tiktokapis.com
```

| Rota (implementada)         | Função                                                                   |
| --------------------------- | ------------------------------------------------------------------------ |
| `GET /health`               | verificação                                                              |
| `GET /config`               | `client_key`, escopos, formato do redirect loopback e do PKCE (públicos) |
| `POST /auth/tiktok/token`   | troca `code` + `code_verifier` por tokens com o `client_secret`          |
| `POST /auth/tiktok/refresh` | renova o access token com o `client_secret`                              |
| `POST /auth/tiktok/revoke`  | revoga o token ao desconectar                                            |

Detalhes (validação, CORS fechado, rate limit, logs, deploy): [backend/README.md](../backend/README.md) e DEC-026.

### Fluxo OAuth do TikTok (Login Kit Desktop + PKCE — DEC-027)

1. Rust gera `state` e `code_verifier` (CSPRNG, novos a cada login), calcula
   `code_challenge = hex(SHA-256(code_verifier))` e abre um listener em `127.0.0.1:<porta escolhida pelo sistema>`.
2. Abre o navegador do sistema em `https://www.tiktok.com/v2/auth/authorize/` com `client_key`, `scope`,
   `response_type=code`, `redirect_uri=http://127.0.0.1:<porta>/tiktok/callback`, `state`, `code_challenge` e
   `code_challenge_method=S256`.
3. Usuário autoriza → o TikTok redireciona **direto** para `http://127.0.0.1:<porta>/tiktok/callback?code&scopes&state`
   (sem passar pelo backend).
4. Rust valida `Host`, caminho e `state` (tempo constante, uso único) e fecha o listener.
5. Rust chama `POST https://api.yeaax.xyz/auth/tiktok/token` com `{ code, codeVerifier, redirectUri }`; o backend
   acrescenta o `client_secret`, chama `/v2/oauth/token/` e devolve os tokens (não guarda nada).
6. Rust busca o perfil em `/v2/user/info/` direto no TikTok e guarda tokens + perfil como **conexão pendente**
   (memória, id opaco, 5 min). Nada vai para o cofre ainda.
7. O frontend recebe só `{ connectionId, account }` (dados públicos), grava o canal no banco e chama
   `tiktok_commit_connection(connectionId, channelId)` → tokens no Credential Manager (`tiktok_token:<channel_id>`).
   Se algo falhar, desfaz o banco e chama `tiktok_discard_connection` (conexão transacional — `channelService`).

## Camadas e dependências

```
 components/ui ◄── features/*/components ◄── features/*/Page
                         │
                         ▼
                 features/*/hooks.ts  (TanStack Query)
                         │  useServices()
                         ▼
          features/*/…Service.ts  ──►  features/*/…Rules.ts (puras, testadas)
                 │            │
                 ▼            ▼
          db/repositories   services/ (social, ai, media, desktop)
                 │                   │
                 ▼                   ▼
          db/client (DbClient)   @tauri-apps/* (apenas aqui)
```

Regras de dependência:

| Camada                   | Pode importar                                                        | Não pode importar                           |
| ------------------------ | -------------------------------------------------------------------- | ------------------------------------------- |
| `types/`, `utils/`       | `zod`                                                                | qualquer outra camada                       |
| `lib/`                   | `types`, `utils`                                                     | `features`, `db`, `services` (exceto tipos) |
| `db/`                    | `types`, `lib`, `utils`                                              | `features`, `services`, React               |
| `services/`              | `types`, `lib`, `utils`                                              | `features`, `db`, React                     |
| `features/*/…Service.ts` | `db` (tipos de repositório), `services` (interfaces), `lib`, `types` | React                                       |
| `features/*` (UI)        | tudo acima + `components`, `hooks`, `app/ServicesContext`            | `@tauri-apps/*`, SQL                        |
| `app/`                   | tudo (é a raiz de composição)                                        | —                                           |

## Pastas

```
src/
├── app/                    Shell da aplicação
│   ├── bootstrap.ts        Detecta o runtime, abre o banco, cria serviços, insere demo (uma vez)
│   ├── services.ts         Composition root: instancia repositórios, providers e casos de uso
│   ├── ServicesContext.ts  useServices()
│   ├── router.tsx          createHashRouter com todas as páginas
│   ├── routes.ts           Constantes de rota + itens da sidebar
│   ├── layout/             AppLayout + Sidebar
│   └── ErrorBoundary / ErrorScreen / RouteError / NotFoundPage
├── components/
│   ├── ui/                 Design system próprio: Button, Input, Modal, ActionMenu, Toast, Table…
│   └── *.tsx               Peças de domínio compartilhadas: PlatformMark, MediaThumbnail, StatusBadges
├── db/                     ÚNICO lugar com SQL
│   ├── client.ts           Interface DbClient + mapeamento de erros do driver
│   ├── tauriClient.ts      Implementação via tauri-plugin-sql (app desktop)
│   ├── previewClient.ts    SQLite WASM em memória (somente `npm run dev`)
│   ├── migrations.ts       Lê src-tauri/migrations/*.sql (preview e testes)
│   ├── sql.ts              Helpers (placeholders, LIKE escapado, SET dinâmico seguro, enums)
│   ├── demoData.ts         Seed e remoção dos dados de demonstração
│   └── repositories/       channel, media, tag, post, postHistory, settings
├── features/               Um diretório por domínio
│   ├── dashboard/          Página + métricas
│   ├── channels/           Página, diálogo de novo canal, channelService
│   ├── media/              Biblioteca, detalhes, tags, mediaService, mediaRules
│   ├── posts/              Compositor, detalhes, fila, postService, postRules, PostDialogsProvider
│   ├── scheduling/         Calendário semanal, agenda do dashboard, calendarLayout
│   ├── automation/         Auto Schedule (config + prévia de horários)
│   ├── ai/                 Página de legendas + sugestões do dashboard
│   ├── analytics/          Placeholder
│   ├── settings/           Página, seções, settingsService
│   └── search/             Busca global
├── hooks/                  useNow, useDebouncedValue, useInvalidate
├── lib/                    errors, logger, queryClient, queryKeys, labels, platforms, integrations, settings, demo, runtime, ids, clock
├── services/               Integrações externas (isoladas)
│   ├── social/             SocialProvider + MockSocialProvider + TikTokProvider + InstagramProvider
│   ├── ai/                 AIProvider + MockAIProvider + gerador local de hashtags
│   ├── media/              VideoProcessor (FFmpeg, preparado) + videoAnalysis (metadados + miniatura)
│   └── desktop/            DesktopBridge (Tauri) + implementação de preview
├── stores/                 Reservado (Zustand só com necessidade real — DEC-005)
├── styles/index.css        Tokens do Tailwind (@theme) e estilos base
├── test/                   Banco de teste (node:sqlite) e factories
├── types/                  Entidades e enums (Zod)
└── utils/                  date, format, cn

src-tauri/
├── src/lib.rs              Registro de plugins e comandos
├── src/migrations.rs       Lista de migrations (include_str!)
├── src/commands/           media.rs (inspect_media_file), system.rs (detect_ffmpeg),
│                           thumbnails.rs (save_thumbnail, delete_thumbnail), secrets.rs, ai.rs,
│                           tiktok.rs (tiktok_connect/cancel/commit/discard/get_profile/disconnect)
├── src/tiktok/             pkce, loopback (validação pura), listener (127.0.0.1, uso único), backend
│                           (api.yeaax.xyz), tokens (cofre por canal), pending, api (/v2/user/info/), secret
├── src/error.rs            CommandError { code, message }
├── migrations/*.sql        Schema (fonte única para Rust, preview e testes)
├── capabilities/default.json  Permissões mínimas da janela
└── tauri.conf.json         Janela, CSP, asset protocol, bundle

backend/                    Serviço separado (Vercel, api.yeaax.xyz) — OAuth e client secrets, sem estado (DEC-023)
```

## Fluxo de dados (exemplo: agendar um post)

1. `PostComposerDialog` monta um `PostInput` e chama `useSavePost().mutate()`.
2. O hook chama `services.posts.create(input)` (obtido via `useServices()`).
3. `postService.create` valida com Zod, consulta canal/mídia nos repositórios, aplica `postRules`
   (limites de legenda, data futura, anti-duplicidade) e lança `AppError` se algo falhar.
4. `postRepository.insert` executa `INSERT` via `DbClient` → `tauri-plugin-sql` → SQLite.
5. `postHistoryRepository.insert` registra os eventos `created` e `scheduled`.
6. O hook invalida as queries de `posts`, `dashboard` e `search`; a UI se atualiza.
7. Erros chegam ao componente como `AppError` com mensagem pronta; o logger registra o detalhe técnico.

## Modos de execução

| Modo      | Como                              | Banco                                                    | Arquivos locais                     |
| --------- | --------------------------------- | -------------------------------------------------------- | ----------------------------------- |
| `desktop` | `npm run app:dev` / app instalado | arquivo SQLite em `%APPDATA%\com.socialmanager.desktop\` | sim (diálogo nativo + comando Rust) |
| `preview` | `npm run dev` no navegador        | SQLite WASM **em memória** (some ao recarregar)          | não (importação mostra aviso)       |
| testes    | `npm run test`                    | `node:sqlite` em memória                                 | fakes injetados                     |

Os três usam **as mesmas migrations SQL** e **os mesmos repositórios** — só o `DbClient` muda (DEC-009, DEC-014).
O modo preview existe apenas em desenvolvimento: o build de produção não inclui o SQLite WASM.

## Providers (integrações)

| Interface        | Implementação atual                                                                                                          | Futuro                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `SocialProvider` | `TikTokProvider` real no desktop (comandos `tiktok_*`; mock no preview); `InstagramProvider extends MockSocialProvider`      | publicação TikTok (etapa 6); Instagram real |
| `AIProvider`     | `OpenAIProvider` (o Rust faz a chamada com a chave do cofre) e `MockAIProvider` (regras locais), escolhidos pelo `AIService` | outros provedores compatíveis               |
| `VideoProcessor` | `getStatus` real (detecção), demais operações lançam `NOT_AVAILABLE`                                                         | FFmpeg/ffprobe como jobs no Rust            |
| `DesktopBridge`  | `tauriDesktopBridge` / `previewDesktopBridge`                                                                                | + credenciais, notificações                 |

O registro (`createSocialProviders`, `createAIProvider`) é o único ponto que conhece as classes concretas.

## Estado

- **Assíncrono/persistido:** TanStack Query. Chaves em `lib/queryKeys.ts`; mutações invalidam por domínio
  (`useInvalidate('posts', 'dashboard')`).
- **UI compartilhada:** contextos pequenos — `ToastProvider` e `PostDialogsProvider` (abre o compositor e
  os detalhes de qualquer tela).
- **Filtros e seleção:** na URL (hash) quando faz sentido (`/library?tag=…&media=…`).
- Sem Redux; sem Zustand até haver necessidade real (DEC-005).

## Erros e logs

- `AppError(code, message)` com códigos estáveis (`lib/errors.ts`). Erros do Rust chegam como
  `{ code, message }` e são convertidos por `toAppError`. Erros do driver SQLite viram `CONFLICT`/`DATABASE`.
- Mensagens ao usuário: `getErrorMessage(error)`; formulários mostram erros inline, ações avulsas usam toast.
- `logger` (`lib/logger.ts`): níveis, redação automática de campos sensíveis, buffer em memória exibido em
  _Configurações → Sobre_. Regras de negócio violadas são `warn`; falhas reais são `error`. No desktop, um
  destino (`logger.addSink`) grava as entradas redigidas em arquivo via `tauri-plugin-log` (DEC-021).
- Erros de renderização: `AppErrorBoundary` (global) e `RouteError` (por página). Erros não tratados de
  `window` também vão para o logger.

## Desempenho

- Vídeos nunca são carregados por inteiro: listas mostram miniaturas JPEG (ou placeholder); `<video>` só no
  painel de detalhes (`preload="metadata"`) e na análise da importação (metadados + um quadro).
- Comandos Rust são `async` (não bloqueiam a thread da UI); processos externos usam `spawn_blocking`.
- Processamento pesado (FFmpeg) será feito no Rust como jobs assíncronos (Fase 2).

## Como adicionar uma feature (checklist)

1. Tipos/enums em `src/types` (com schema Zod).
2. Mudança de schema? Nova migration + `migrations.rs` + `DATABASE.md`.
3. Repositório em `src/db/repositories` (SQL só aqui) + teste com `createTestRepositories()`.
4. Regras puras em `features/<x>/<x>Rules.ts` + testes.
5. Caso de uso em `features/<x>/<x>Service.ts` + registro em `app/services.ts`.
6. Hooks em `features/<x>/hooks.ts` (chaves em `lib/queryKeys.ts`).
7. Componentes/página usando `components/ui`; rota em `app/routes.ts` + `app/router.tsx`.
8. Documentação, TODO, ROADMAP, CHANGELOG, DEVELOPMENT_LOG.
