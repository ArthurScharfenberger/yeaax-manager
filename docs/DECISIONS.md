# Registro de decisões (ADR simplificado)

Toda decisão arquitetural relevante entra aqui **antes** ou **junto** do código. Formato:
**Data · Decisão · Motivo · Alternativas consideradas · Impactos.** Decisões substituídas não são apagadas:
marque como _Substituída por DEC-XXX_.

| Id      | Decisão                                                           | Status     |
| ------- | ----------------------------------------------------------------- | ---------- |
| DEC-001 | SQLite local via `tauri-plugin-sql`                               | Ativa      |
| DEC-002 | Tauri 2 + React + TypeScript + Vite                               | Ativa      |
| DEC-003 | Regras de negócio em TypeScript; Rust só para sistema             | Ativa      |
| DEC-004 | Tailwind CSS 4 + componentes próprios + lucide-react              | Ativa      |
| DEC-005 | TanStack Query; sem Redux; Zustand só com necessidade real        | Ativa      |
| DEC-006 | Mídia referenciada pelo caminho original, sem cópia               | Ativa      |
| DEC-007 | Enums validados na aplicação, sem `CHECK` no SQLite               | Ativa      |
| DEC-008 | Sem transações entre chamadas ao banco (pool do plugin)           | Ativa      |
| DEC-009 | Modo preview no navegador com SQLite WASM (só em dev)             | Ativa      |
| DEC-010 | Drag-and-drop HTML5 no calendário (`dragDropEnabled: false`)      | Ativa      |
| DEC-011 | React Router com HashRouter                                       | Ativa      |
| DEC-012 | Integrações como interfaces + mocks; só APIs oficiais             | Ativa      |
| DEC-013 | Dados de demonstração com prefixo `demo-`, seed único e removível | Ativa      |
| DEC-014 | Testes com Vitest + `node:sqlite` usando as migrations reais      | Ativa      |
| DEC-015 | Node 24 LTS e TypeScript 6.0 (não 7.x)                            | Ativa      |
| DEC-016 | Asset protocol com escopo vazio e autorização por arquivo         | Ativa      |
| DEC-017 | Metadados de vídeo via `<video preload="metadata">` até o ffprobe | Provisória |

---

## DEC-001 — SQLite local via `tauri-plugin-sql`

- **Data:** 2026-10-07
- **Decisão:** usar SQLite em arquivo local, acessado pelo plugin oficial `tauri-plugin-sql` (sqlx), com SQL
  escrito à mão em repositórios TypeScript (`src/db/repositories`). Migrations em `src-tauri/migrations/*.sql`,
  aplicadas pelo plugin ao carregar o banco.
- **Motivo:** local-first, zero servidor, arquivo único fácil de fazer backup; plugin oficial e mantido; mantém
  a lógica de dados no TypeScript (DEC-003).
- **Alternativas:** `rusqlite` + comandos Rust (mais Rust e boilerplate por consulta); ORM (Drizzle/Prisma)
  — dependência pesada para poucas tabelas; IndexedDB/JSON — sem SQL, consultas e integridade fracas.
- **Impactos:** SQL concentrado em `src/db`; placeholders `?`; sem transações entre chamadas (DEC-008).

## DEC-002 — Tauri 2 + React + TypeScript + Vite

- **Data:** 2026-10-07
- **Decisão:** app desktop em Tauri 2 com frontend React 19 + TypeScript strict + Vite.
- **Motivo:** binário pequeno, WebView2 nativo no Windows, acesso seguro ao sistema por permissões; React é o
  ecossistema mais familiar para manutenção por pessoas e agentes.
- **Alternativas:** Electron (maior consumo de memória e disco); app web + servidor local (contraria "sem servidor").
- **Impactos:** requer Rust + MSVC Build Tools para compilar; o frontend também roda sozinho no navegador (DEC-009).

## DEC-003 — Regras de negócio em TypeScript; Rust só para sistema

- **Data:** 2026-10-07
- **Decisão:** casos de uso e regras ficam em `src/features/*` (TypeScript). O Rust expõe apenas capacidades de
  sistema: plugins (SQL, diálogo), inspeção de arquivo, detecção do FFmpeg; no futuro, OAuth, credenciais e jobs.
- **Motivo:** uma linguagem para o domínio, testes rápidos (Vitest), menos fricção para evoluir.
- **Alternativas:** domínio em Rust com comandos por caso de uso (mais seguro em transações, porém muito mais lento de evoluir).
- **Impactos:** operações que exigirem atomicidade forte ou segredos irão para comandos Rust específicos.

## DEC-004 — Tailwind CSS 4 + componentes próprios + lucide-react

- **Data:** 2026-10-07
- **Decisão:** Tailwind 4 (plugin Vite) com tokens em `@theme` (`src/styles/index.css`) e design system próprio em
  `src/components/ui`. Ícones: `lucide-react` (tree-shaking por ícone).
- **Motivo:** visual próprio e sóbrio, sem cara de "SaaS genérico"; nenhuma biblioteca gigante de componentes.
- **Alternativas:** MUI/Ant/Chakra (visual genérico, pesado); shadcn/ui + Radix (boa opção, mas adiciona muitas
  dependências para os poucos componentes necessários hoje); CSS Modules (mais verboso para tokens).
- **Impactos:** componentes acessíveis feitos à mão (Modal via `<dialog>`, menus via Popover API). Atenção: classes
  conflitantes do Tailwind não se sobrescrevem pela ordem — componentes base não definem largura (ver `Input.tsx`).

## DEC-005 — TanStack Query; sem Redux; Zustand só com necessidade real

- **Data:** 2026-10-07
- **Decisão:** estado assíncrono/persistido via TanStack Query; estado de UI compartilhado via contextos pequenos
  (`ToastProvider`, `PostDialogsProvider`); filtros na URL. Nenhuma store global.
- **Motivo:** quase todo estado vem do banco; contextos cobrem o restante sem dependência extra.
- **Alternativas:** Redux Toolkit (excessivo); Zustand desde já (sem caso de uso real ainda).
- **Impactos:** `src/stores/` existe vazio, reservado. Adotar Zustand exige nova DEC.

## DEC-006 — Mídia referenciada pelo caminho original, sem cópia

- **Data:** 2026-10-07
- **Decisão:** a importação registra caminho absoluto, nome, tamanho, tipo e metadados; o arquivo permanece onde está.
- **Motivo:** vídeos são grandes; copiar duplicaria disco sem ganho nesta fase.
- **Alternativas:** copiar para uma pasta gerenciada (robusto a renomeações, mas dobra o espaço).
- **Impactos:** mover/renomear o arquivo o torna indisponível (o painel de detalhes avisa). Arquivos gerados
  (miniaturas, versões processadas) irão para uma pasta do app na Fase 2. Remover da biblioteca nunca apaga o original.

## DEC-007 — Enums validados na aplicação, sem `CHECK` no SQLite

- **Data:** 2026-10-07
- **Decisão:** colunas de status/plataforma são `TEXT` sem `CHECK`; os valores são validados com Zod ao escrever
  (tipos) e ao ler (`parseEnum` nos repositórios — valor desconhecido gera `DATA_INTEGRITY`).
- **Motivo:** no SQLite, alterar um `CHECK` exige recriar a tabela; recriar `posts` com foreign keys ativas
  dispararia o `ON DELETE CASCADE` e apagaria `post_history`. Novos status e plataformas (ex.: YouTube Shorts) são prováveis.
- **Alternativas:** `CHECK` + procedimento de recriação de tabela (frágil dentro das migrations transacionais do plugin).
- **Impactos:** a integridade de enums depende da aplicação; leitura defensiva nos repositórios.

## DEC-008 — Sem transações entre chamadas ao banco

- **Data:** 2026-10-07
- **Decisão:** não usar `BEGIN`/`COMMIT` em chamadas separadas. Operações compostas (ex.: post + histórico) são
  escritas sequenciais; o histórico é registrado depois da escrita principal.
- **Motivo:** `tauri-plugin-sql` usa um pool de conexões (sqlx); chamadas consecutivas podem cair em conexões
  diferentes, então transações manuais não são confiáveis.
- **Alternativas:** comandos Rust transacionais por caso de uso (planejado para fluxos críticos, ex.: publicação).
- **Impactos:** em falha no meio, pode faltar uma entrada de histórico (aceitável nesta fase). Ver TODO "Próximo".

## DEC-009 — Modo preview no navegador com SQLite WASM (só em dev)

- **Data:** 2026-10-07
- **Decisão:** fora do Tauri, `npm run dev` usa `@sqlite.org/sqlite-wasm` (pacote oficial do SQLite) em memória,
  com as mesmas migrations e repositórios, e carrega os dados de demonstração. Import dinâmico protegido por
  `import.meta.env.DEV`: o build de produção não inclui o WASM.
- **Motivo:** desenvolver e revisar a UI (inclusive por agentes com navegador) sem compilar Rust, exercitando o mesmo SQL.
- **Alternativas:** repositórios em memória duplicados (duas implementações para manter); exigir sempre o Tauri.
- **Impactos:** importação de arquivos e FFmpeg não funcionam no preview (mensagem clara). Dados somem ao recarregar.

## DEC-010 — Drag-and-drop HTML5 no calendário

- **Data:** 2026-10-07
- **Decisão:** a janela usa `dragDropEnabled: false` para permitir DnD HTML5 no WebView2 (reagendar arrastando).
- **Motivo:** no Windows, o handler nativo de arquivos do Tauri bloqueia o DnD HTML5. Implementação simples e acessível
  (alternativa por teclado: detalhes → Editar).
- **Alternativas:** DnD por pointer events (mais código); manter drop nativo de arquivos (sem reagendar arrastando).
- **Impactos:** arrastar arquivos do Explorer para importar não funciona; quando for desejado, avaliar DnD por
  pointer events no calendário ou drop de arquivos via `<input type=file>`/eventos do webview.

## DEC-011 — React Router com HashRouter

- **Data:** 2026-10-07
- **Decisão:** `react-router` (v8) com `createHashRouter`; rotas em `src/app/routes.ts`.
- **Motivo:** app servido como arquivos estáticos; hash funciona sem servidor; parâmetros na URL guardam filtros e seleção.
- **Alternativas:** navegação por estado próprio (sem histórico/parâmetros); TanStack Router (mais setup).
- **Impactos:** links internos usam `ROUTES`; filtros de páginas podem ser compartilhados por link interno (ex.: dashboard → biblioteca).

## DEC-012 — Integrações como interfaces + mocks; somente APIs oficiais

- **Data:** 2026-10-07
- **Decisão:** `SocialProvider` (connect, disconnect, getProfile, publish, getPublicationStatus, getAnalytics),
  `AIProvider` e `VideoProcessor` são contratos; as implementações atuais são simuladas. Nada de scraping,
  automação de navegador ou endpoints não oficiais. OAuth e tokens ficarão no lado Rust.
- **Motivo:** desacoplar o domínio das APIs; permitir desenvolver a UI e os fluxos sem credenciais.
- **Alternativas:** chamar APIs direto do frontend (exporia segredos; contraria SECURITY.md).
- **Impactos:** trocar mock por real não altera features — só o provider. Status em INTEGRATIONS.md e na UI.

## DEC-013 — Dados de demonstração

- **Data:** 2026-10-07
- **Decisão:** seed único na primeira execução, apenas se não houver canais; ids `demo-*`; datas relativas ao momento do seed;
  remoção em Configurações → Geral.
- **Motivo:** interface utilizável e realista sem APIs; remoção segura sem coluna extra no schema.
- **Alternativas:** coluna `is_demo` (polui o schema); seed só em dev (o app instalado ficaria vazio).
- **Impactos:** posts criados pelo usuário em canais de demonstração somem junto ao remover os dados de demonstração (avisado na UI).

## DEC-014 — Testes com Vitest + `node:sqlite`

- **Data:** 2026-10-07
- **Decisão:** Vitest em ambiente Node; repositórios e serviços testados contra SQLite real em memória
  (`node:sqlite`, nativo do Node 24) com as migrations do app. Sem testes de detalhes visuais.
- **Motivo:** testa o SQL de verdade sem dependências extras nem Tauri.
- **Alternativas:** mocks de repositório (não testam SQL); `better-sqlite3` (dependência nativa).
- **Impactos:** Node ≥ 22.12 obrigatório. Testes de componentes (Testing Library + jsdom) ficam para quando houver fluxos de UI críticos.

## DEC-015 — Node 24 LTS e TypeScript 6.0

- **Data:** 2026-10-07
- **Decisão:** ambiente atualizado de Node 20.12 (EOL) para Node 24 LTS; TypeScript fixado em `~6.0.3`.
- **Motivo:** Vite 8, ESLint 10 e Vitest 5 exigem Node ≥ 20.19/22.12. O TypeScript 7 (nativo) ainda não é
  suportado pelo `typescript-eslint` (peer `<6.1.0`).
- **Alternativas:** manter Node 20 com Vite 6/ESLint 9/Vitest 3 (projeto nasceria defasado).
- **Impactos:** reavaliar TS 7 quando o typescript-eslint suportar.

## DEC-016 — Asset protocol com escopo vazio e autorização por arquivo

- **Data:** 2026-10-07
- **Decisão:** `assetProtocol.enable: true` com `scope: []`. O comando `inspect_media_file` valida o arquivo
  (absoluto, existente, extensão permitida, não vazio) e autoriza **apenas ele** na sessão.
- **Motivo:** permitir preview e leitura de metadados de vídeos escolhidos pelo usuário sem abrir o disco inteiro ao webview.
- **Alternativas:** escopo amplo (`**`) — expõe qualquer arquivo; copiar vídeos para pasta do app (DEC-006).
- **Impactos:** autorizações não persistem entre execuções; o painel de detalhes reautoriza ao abrir.

## DEC-017 — Metadados de vídeo via `<video preload="metadata">` (provisória)

- **Data:** 2026-10-07
- **Decisão:** na importação, duração e resolução são lidas pelo WebView2 com um `<video>` fora do DOM (só o cabeçalho é lido).
- **Motivo:** dados úteis já na Fase 1 sem exigir FFmpeg instalado.
- **Alternativas:** aguardar ffprobe (biblioteca sem duração até a Fase 2).
- **Impactos:** formatos/codecs que o WebView2 não lê ficam com duração `—`. Substituir por ffprobe na Fase 2.
