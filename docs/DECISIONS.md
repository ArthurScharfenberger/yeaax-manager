# Registro de decisões (ADR simplificado)

Toda decisão arquitetural relevante entra aqui **antes** ou **junto** do código. Formato:
**Data · Decisão · Motivo · Alternativas consideradas · Impactos.** Decisões substituídas não são apagadas:
marque como _Substituída por DEC-XXX_.

| Id      | Decisão                                                                | Status                                   |
| ------- | ---------------------------------------------------------------------- | ---------------------------------------- |
| DEC-001 | SQLite local via `tauri-plugin-sql`                                    | Ativa                                    |
| DEC-002 | Tauri 2 + React + TypeScript + Vite                                    | Ativa                                    |
| DEC-003 | Regras de negócio em TypeScript; Rust só para sistema                  | Ativa                                    |
| DEC-004 | Tailwind CSS 4 + componentes próprios + lucide-react                   | Ativa                                    |
| DEC-005 | TanStack Query; sem Redux; Zustand só com necessidade real             | Ativa                                    |
| DEC-006 | Mídia referenciada pelo caminho original, sem cópia                    | Ativa                                    |
| DEC-007 | Enums validados na aplicação, sem `CHECK` no SQLite                    | Ativa                                    |
| DEC-008 | Sem transações entre chamadas ao banco (pool do plugin)                | Ativa                                    |
| DEC-009 | Modo preview no navegador com SQLite WASM (só em dev)                  | Ativa                                    |
| DEC-010 | Drag-and-drop HTML5 no calendário (`dragDropEnabled: false`)           | Ativa                                    |
| DEC-011 | React Router com HashRouter                                            | Ativa                                    |
| DEC-012 | Integrações como interfaces + mocks; só APIs oficiais                  | Ativa                                    |
| DEC-013 | Dados de demonstração com prefixo `demo-`, seed único e removível      | Ativa                                    |
| DEC-014 | Testes com Vitest + `node:sqlite` usando as migrations reais           | Ativa                                    |
| DEC-015 | Node 24 LTS e TypeScript 6.0 (não 7.x)                                 | Ativa                                    |
| DEC-016 | Asset protocol com escopo vazio e autorização por arquivo              | Ativa                                    |
| DEC-017 | Metadados de vídeo via `<video preload="metadata">` até o ffprobe      | Provisória                               |
| DEC-018 | Miniaturas capturadas pelo WebView2 e gravadas pelo Rust               | Provisória                               |
| DEC-019 | Publicação sempre com consentimento por post; Auto Schedule só sugere  | Ativa                                    |
| DEC-020 | Credenciais do próprio usuário ("traga seu app") no Credential Manager | Substituída parcialmente por DEC-023/024 |
| DEC-021 | Logs em arquivo com tauri-plugin-log                                   | Ativa                                    |
| DEC-022 | OpenAI via Rust com chave no Credential Manager; "Postar com IA"       | Ativa                                    |
| DEC-023 | Backend mínimo `api.yeaax.xyz` (Vercel) só para segredos do app        | Ativa                                    |
| DEC-024 | OAuth TikTok Web com callback HTTPS repassado ao loopback do desktop   | Substituída por DEC-027                  |
| DEC-025 | Nome exibido "Yeaax Manager"; identificador interno mantido            | Ativa                                    |
| DEC-026 | Backend sem framework: um handler `fetch` + Zod, rate limit em memória | Ativa                                    |
| DEC-027 | OAuth TikTok com Login Kit Desktop + PKCE (loopback direto)            | Ativa                                    |

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
- **Atualização (DEC-018):** o escopo estático passou a incluir apenas `$APPDATA/thumbnails/*` — arquivos
  gerados pelo próprio app, nunca vídeos do usuário.

## DEC-017 — Metadados de vídeo via `<video preload="metadata">` (provisória)

- **Data:** 2026-10-07
- **Decisão:** na importação, duração e resolução são lidas pelo WebView2 com um `<video>` fora do DOM (só o cabeçalho é lido).
- **Motivo:** dados úteis já na Fase 1 sem exigir FFmpeg instalado.
- **Alternativas:** aguardar ffprobe (biblioteca sem duração até a Fase 2).
- **Impactos:** formatos/codecs que o WebView2 não lê ficam com duração `—`. Substituir por ffprobe na Fase 2.
- **Validação (2026-10-07):** importação real de `.mp4` (576×1024, 25,3 s) leu duração e resolução corretamente.
  `.mov` e `.webm` ainda não foram testados com arquivos reais.

## DEC-018 — Miniaturas capturadas pelo WebView2 e gravadas pelo Rust (provisória)

- **Data:** 2026-10-07
- **Decisão:** miniaturas são **sempre automáticas** (requisito do usuário — sem ação manual). Na importação, o
  mesmo `<video>` que lê os metadados busca ~1 s, desenha o quadro num canvas e gera um JPEG de até 360 px. Os
  bytes vão por IPC binário para o comando `save_thumbnail`, que valida (id só com letras/números/hífen,
  assinatura JPEG, até 2 MB) e grava em `%APPDATA%\com.socialmanager.desktop\thumbnails\<id>.jpg`;
  `media.thumbnail_path` guarda o caminho. Ao abrir o app, vídeos ainda sem miniatura (importados antes do
  recurso ou com falha na captura) são processados em segundo plano, um por vez, uma tentativa por sessão.
- **Motivo:** miniaturas reais já no MVP sem exigir FFmpeg instalado. O canvas não fica bloqueado porque o
  protocolo `asset:` do Tauri responde com `Access-Control-Allow-Origin` da janela e o vídeo é carregado com
  `crossOrigin`.
- **Alternativas:** FFmpeg agora (exige instalação; previsto para a Fase 2); `<video>` ao vivo em cada card
  (carregaria vídeos na grade — contraria a regra de desempenho); base64 via JSON (maior e exigiria crate extra).
- **Impactos:** codecs que o WebView2 não decodifica ficam sem miniatura (placeholder) até o FFmpeg; falhas de
  miniatura nunca bloqueiam a importação; remover da biblioteca apaga a miniatura. Com o FFmpeg,
  `VideoProcessor.generateThumbnail` pode substituir a captura mantendo o mesmo comando de gravação.

## DEC-019 — Publicação sempre com consentimento por post; Auto Schedule só sugere

- **Data:** 2026-10-07
- **Decisão:**
  1. Nenhum conteúdo é enviado a uma plataforma sem que o usuário tenha **confirmado aquele post** no compositor,
     com os campos exigidos pela plataforma (no TikTok: privacidade sem valor padrão, comentário/dueto/stitch
     desmarcados por padrão, divulgação comercial, confirmação de uso de música, prévia).
  2. O motor do **Auto Schedule** (Fase 2) apenas **propõe**: cria posts em `review` com horários sugeridos; o
     usuário revisa e confirma cada um. Ele nunca publica conteúdo escolhido automaticamente.
  3. Como nenhuma das APIs tem agendamento nativo, o próprio app publica no horário (agendador local, app aberto).
  4. Modos: Instagram — publicação direta com upload resumável do arquivo local. TikTok — _Direct Post_ se o app
     for auditado; sem auditoria, _Upload_ para rascunhos (o usuário finaliza no app do TikTok), sujeito a teste.
- **Motivo:** as diretrizes do TikTok exigem envio "only … after the user has expressly consent to the upload" e
  uma UX específica; sem auditoria, só posts privados (ver API_NOTES.md). Também é a postura mais segura para as
  contas do usuário.
- **Alternativas:** publicação 100% automática a partir da fila (viola as diretrizes do TikTok e arrisca as
  contas); usar só o modo rascunho em ambas (desperdiça a publicação direta do Instagram).
- **Impactos:** o compositor terá uma seção por plataforma; `posts` ganhará uma coluna `platform_options` (JSON)
  em uma migration futura; o roadmap do Auto Schedule muda de "publica sozinho" para "sugere e o usuário confirma".

## DEC-020 — Credenciais do próprio usuário no Credential Manager

_Substituída parcialmente por DEC-023 e DEC-024 (2026-10-13): o app do TikTok passa a ser o app oficial "Yeaax
Manager", com o client secret no backend mínimo. Continua valendo: tokens só no Credential Manager do desktop;
Instagram com token do painel enquanto não for revisto._

- **Data:** 2026-10-07
- **Decisão:** o usuário registra **seus próprios apps de desenvolvedor** (TikTok for Developers e Meta). Client
  key/secret e tokens são informados em Configurações e guardados pelo lado Rust no **Credential Manager do
  Windows** (crate `keyring`). Instagram: colar o token gerado no painel da Meta para as contas próprias; o app o
  renova automaticamente antes dos 60 dias (o refresh não exige app secret). TikTok: OAuth desktop com PKCE e
  servidor de callback em `http://127.0.0.1:<porta>` no Rust.
- **Motivo:** app pessoal sem servidor; o segredo nunca entra no repositório nem no bundle; o Instagram com
  Standard Access dispensa App Review para contas próprias; o redirect do Instagram exige HTTPS, o que complica
  OAuth local — o token do painel evita isso.
- **Alternativas:** embutir o client secret no binário (extraível — viola SECURITY.md); servidor intermediário
  para OAuth (contraria "sem servidor"); OAuth do Instagram com certificado HTTPS local (aviso de certificado no navegador).
- **Impactos:** Configurações → Integrações ganha campos de credenciais; renovação de tokens vira tarefa do
  agendador local; o crate `keyring` entra como dependência na Fase 3.

## DEC-021 — Logs em arquivo com tauri-plugin-log

- **Data:** 2026-10-07
- **Decisão:** o `logger` do frontend ganhou destinos (`addSink`); no desktop, um destino envia cada entrada
  (já redigida) ao `tauri-plugin-log`, que grava em `app_log_dir`
  (`%LOCALAPPDATA%\com.socialmanager.desktop\logs\social-manager.log`), rotacionando a cada 5 MB e mantendo os
  5 arquivos mais recentes. Nível mínimo: debug em dev, info em release.
- **Motivo:** diagnosticar problemas depois que o app fecha (ex.: falhas de publicação na Fase 3); plugin oficial
  do Tauri, mesma versão no npm e no crate (2.10.0).
- **Alternativas:** comando Rust próprio gravando arquivos (reimplementaria rotação); `tauri-plugin-fs`
  (permissões amplas de sistema de arquivos).
- **Impactos:** nova permissão `log:allow-log`; logs do Rust vão para o mesmo arquivo; o modo preview continua
  só em memória.

## DEC-022 — OpenAI via Rust com chave no Credential Manager; "Postar com IA"

- **Data:** 2026-10-07
- **Decisão:**
  1. Provedor de IA: **OpenAI** (escolha do usuário), modelo configurável — padrão `gpt-6-luna`, o mais econômico
     com entrada de imagem no catálogo oficial em 2026-10-07. API Chat Completions com Structured Outputs
     (`json_schema`, `strict`), formato compatível com outros provedores (Grok, Gemini) para troca futura.
  2. A chave é informada em Configurações → IA e gravada no **Gerenciador de Credenciais do Windows** via
     `keyring-core` + `windows-native-keyring-store` (recomendação do próprio crate `keyring` para apps). Não existe
     comando que devolva a chave ao webview; nomes de segredo vêm de uma lista fixa no Rust.
  3. A chamada HTTPS é feita pelo Rust (`ai_chat_completion`, `reqwest` com rustls), para um endpoint fixo,
     anexando a chave; o frontend monta o pedido e valida a resposta com Zod. Erros 401 nunca ecoam a chave.
  4. **"Postar com IA"**: pedido em linguagem natural + miniatura (a IA "vê" o vídeo) + canais + horários do Auto
     Schedule → plano estruturado (canais restritos por `enum`, legenda, hashtags, horário) → revisão editável →
     confirmação cria os posts (DEC-019). Sem chave, um interpretador local por regras mantém o fluxo funcionando.
- **Motivo:** automação máxima pedida pelo usuário, sem expor a chave e sem servidor.
- **Alternativas:** chamar a OpenAI do frontend (exporia a chave); `.env` (texto plano, inadequado para produção);
  crate `keyring` completo (puxa cofres de todas as plataformas); Grok/Gemini (avaliados; custo irrelevante,
  OpenAI escolhida pela saída estruturada garantida).
- **Impactos:** novas dependências Rust (`reqwest`, `keyring-core`, `windows-native-keyring-store`); comandos
  `secret_set/has/delete` e `ai_chat_completion`; custo por post estimado em frações de centavo.

## DEC-023 — Backend mínimo em `api.yeaax.xyz` só para segredos do app

- **Data:** 2026-10-13
- **Decisão:**
  1. Existe um **backend mínimo**, Node.js + TypeScript, na pasta `backend/` deste repositório, tratado como
     **serviço separado** do app desktop: `package.json`, testes e deploy próprios, publicado como um **projeto
     Vercel separado** (Vercel Functions) no domínio `https://api.yeaax.xyz`. O site institucional continua em
     `https://yeaax.xyz` (termos, privacidade, página do projeto).
  2. O backend só faz o que **exige** um servidor público: callback OAuth HTTPS, troca de `code` por token, refresh
     e revogação (todos usam o `client_secret`) e, no futuro, webhooks e a API/MCP.
  3. **Sem banco e sem estado**: o backend não guarda tokens, sessões nem dados do usuário. Os tokens são devolvidos
     por HTTPS ao processo Rust do desktop, que os guarda no Credential Manager (DEC-022/024).
  4. O vídeo **nunca** passa pelo backend: o upload vai do desktop direto para a API da plataforma.
  5. Segredos (`TIKTOK_CLIENT_SECRET` etc.) só existem nas variáveis de ambiente da Vercel; `backend/.env.example`
     com valores vazios documenta os nomes. O app desktop não tem nenhum segredo de app.
- **Motivo:** o TikTok exige `client_secret` na troca do código e no refresh, inclusive para desktop, e diz que ele
  deve ficar num servidor; embutir no binário o tornaria extraível. O usuário quer callback HTTPS no domínio
  próprio (exigência prática do Login Kit Web e do App Review). Manter o servidor sem estado preserva o local-first.
- **Alternativas:** secret no binário (extraível — viola SECURITY.md); cada usuário registrar o próprio app
  (DEC-020 — inviável para um app oficial revisado pelo TikTok); backend com banco e contas de usuário (vira SaaS,
  fora do escopo); Cloudflare Workers (equivalente; Vercel escolhida porque o site já está lá).
- **Impactos:** princípio "sem servidor" ajustado em PROJECT.md para "backend mínimo e sem estado"; nova pasta
  `backend/`; o desktop passa a depender do backend para **conectar e renovar** contas (publicar com token válido
  não depende dele). O plano Hobby da Vercel é para uso não comercial — rever se o projeto virar produto.

## DEC-024 — OAuth TikTok (Login Kit Web) com callback HTTPS repassado ao loopback do desktop

_Substituída por DEC-027 (2026-10-13): o login passou a ser Login Kit Desktop + PKCE, com redirect direto ao
loopback. A rota `/auth/tiktok/callback` foi removida. Continuam valendo os itens 5 e 6 da revisão abaixo
(secret só no backend; divergência sobre refresh tokens no desktop)._

- **Data:** 2026-10-13
- **Decisão:**
  1. Login Kit configurado como **Web**, redirect `https://api.yeaax.xyz/auth/tiktok/callback`.
  2. Fluxo: o Rust gera um `state` aleatório (CSPRNG) e abre um listener em `127.0.0.1:<porta aleatória>`; abre o
     navegador do sistema na URL de autorização com `state = <aleatório>.<porta>`. O TikTok redireciona para o
     callback HTTPS; o backend **não troca nada**: valida o formato do `state` e responde `302` para
     `http://127.0.0.1:<porta>/tiktok/callback?code=…&state=…` (host fixo, porta numérica 1024–65535 — sem open
     redirect). O Rust confere o `state`, envia o `code` ao backend (`POST /auth/tiktok/token`), recebe os tokens
     na resposta HTTPS e grava no Credential Manager (`tiktok_token:<open_id>`). O listener expira em poucos minutos.
  3. O frontend nunca vê `code` nem tokens: só recebe o perfil (`ConnectResult`).
  4. Todas as chamadas autenticadas (`/v2/user/info/`, `creator_info`, init, upload em chunks, status) são feitas
     pelo **Rust direto para `open.tiktokapis.com`**; o backend só entra em token/refresh/revoke.
  5. Escopos: `user.info.basic`, `user.info.profile` (para o @), `video.publish`, `video.upload`.
- **Motivo:** o Login Kit Web exige redirect HTTPS estático, então o callback não pode ir direto ao desktop; repassar
  só o `code` (de uso único e curta duração) mantém os tokens fora do navegador e do servidor.
- **Alternativas:** Login Kit Desktop com redirect `127.0.0.1` direto (dispensa o repasse, mas o usuário optou por
  Web e callback no domínio); backend trocar o code e o desktop buscar os tokens por polling (exigiria estado no
  servidor); entregar tokens ao desktop via URL (vazaria no histórico do navegador).
- **Riscos:** o fluxo Web não documenta PKCE (`code_verifier` é "required for mobile and desktop app only") — a
  proteção vem do `state` verificado pelo desktop e do `code` de uso único entregue só ao loopback; se o TikTok
  aceitar PKCE no fluxo Web (testar no sandbox), usar como defesa extra, lembrando que o desafio do TikTok é SHA-256
  em **hex**. Sem auditoria, só posts `SELF_ONLY` em conta privada.
- **Impactos:** novos comandos Rust de OAuth/publicação; nomes de segredo dinâmicos validados por padrão
  (`tiktok_token:[A-Za-z0-9_-]{1,64}`); coluna `channels.external_id` (open_id) em migration futura.

### Revisão de segurança da DEC-024 (2026-10-13)

Feita contra a documentação atual do Login Kit (Web e Desktop) e do gerenciamento de tokens do TikTok.

1. **`state`:** gerado pelo desktop com 32 bytes do CSPRNG do sistema operacional, em base64url sem padding (43
   caracteres), seguido de `.<porta>`. Fica só na memória da conexão pendente, vale **uma vez**, é comparado em
   tempo constante e expira com o listener (5 min). O backend é stateless: valida apenas o formato
   (`backend/src/oauthState.ts`); quem valida o valor é o desktop. Isso também impede _login CSRF_ (conectar a
   conta de um atacante): o desktop só aceita o `state` que ele mesmo gerou.
2. **Sem open redirect:** o destino é montado pelo backend com host `127.0.0.1` e caminho `/tiktok/callback`
   fixos; só a porta vem do `state` e precisa ser decimal sem zero à esquerda entre 1024 e 65535. `state`
   inválido → página de erro, sem redirect. Testes cobrem injeção de host, caminho, URL completa e portas
   privilegiadas. Um terceiro pode, no máximo, fazer o navegador da vítima abrir uma URL no próprio loopback dela
   — o mesmo que qualquer site pode fazer —, e o desktop a recusa por causa do `state`.
3. **Listener loopback (etapa 3):** bind só em `127.0.0.1` (nunca `0.0.0.0` nem `localhost`, que pode resolver
   para IPv6), porta escolhida pelo sistema, aceita apenas `GET /tiktok/callback`, encerra após o primeiro
   `state` válido ou após 5 min, responde uma página local sem recursos externos.
4. **Authorization code:** de uso único e curta duração (TikTok); o desktop o troca **uma única vez** e logo em
   seguida; nunca é registrado (backend: redação + testes; desktop: idem). Limitação inerente ao fluxo Web: o code
   aparece na URL do callback e do loopback no navegador — mitigado por `Referrer-Policy: no-referrer`, páginas
   sem recursos externos e uso único.
5. **Client secret:** só nas variáveis de ambiente da Vercel; nunca em respostas nem logs (testado).
6. **Tokens — divergência explícita da recomendação do TikTok.** A documentação do Login Kit diz que o servidor é
   responsável por guardar com segurança o client secret **e o refresh token** (gestão server-side). Nesta
   arquitetura, o refresh token fica no **Credential Manager do Windows** do usuário (DPAPI, escopo do usuário),
   não no servidor.
   - **Motivo:** backend sem estado e local-first (DEC-023). Guardar no servidor exigiria banco, contas de usuário
     e uma credencial para o desktop se autenticar no backend — que ficaria igualmente no computador do usuário,
     só mudando o problema de lugar.
   - **Riscos:** (a) malware rodando como o usuário pode ler o cofre e roubar o refresh token (365 dias); (b) o
     refresh exige o client secret, mas a rota pública `/auth/tiktok/refresh` aceita qualquer refresh token
     válido — quem roubar o token consegue access tokens por ela; (c) perda do computador sem bloqueio de sessão.
   - **Mitigações:** escopo mínimo; rate limit; revogação ao desconectar; o TikTok rotaciona o refresh token (o
     antigo deixa de valer); o usuário pode revogar o acesso nas configurações do TikTok; tokens nunca no banco,
     em logs ou no webview.
   - **Endurecimento possível (não implementado):** o backend devolver o refresh token cifrado (AES-GCM com chave
     só na Vercel) para o desktop guardar um blob opaco — o token em claro nunca fica no disco e a rotação da chave
     invalida todos de uma vez. Não impede o uso do blob roubado pela rota de refresh, por isso foi adiado.
7. **PKCE:** o fluxo Web não documenta PKCE (`code_verifier` é "required for mobile and desktop app only"). O
   backend já aceita `codeVerifier` opcional; testar no sandbox se o fluxo Web aceita `code_challenge` (lembrando
   que o desafio do TikTok é SHA-256 em **hex**) e, se aceitar, usar sempre como defesa extra.
8. **Alternativa em avaliação — Login Kit Desktop + PKCE** (decisão do usuário pendente; a DEC-024 continua Web):
   - Vantagens: é o padrão para apps nativos (RFC 8252: loopback + PKCE); o code fica amarrado ao `code_verifier`
     que só o desktop tem, então interceptar o code não basta; elimina o repasse e a rota pública de callback; o
     login não depende do backend estar no ar para o redirect.
   - Desvantagens: o TikTok exige o client secret na troca e no refresh mesmo para Desktop, então o backend
     continua necessário (`/config`, `token`, `refresh`, `revoke`); redirect em `127.0.0.1` em vez do domínio;
     desafio PKCE fora do padrão (hex); não reaproveita o callback HTTPS (útil para clientes Web futuros e
     exigido pelo Instagram).
   - Custo de troca: baixo — o backend já aceita `codeVerifier`; a rota de callback ficaria sem uso.

## DEC-025 — Nome exibido "Yeaax Manager"; identificador interno mantido

- **Data:** 2026-10-13
- **Decisão:** o nome exibido passa a ser **Yeaax Manager** (janela, sidebar, `productName`, títulos, docs). O
  identificador `com.socialmanager.desktop`, o nome do crate/binário, o arquivo `social-manager.db`, o serviço do
  Credential Manager e o nome do arquivo de log **não mudam**.
- **Motivo:** o app registrado no TikTok se chama "Yeaax Manager"; mudar o identificador trocaria a pasta de dados
  (`%APPDATA%`) e o cofre, e o usuário perderia banco, miniaturas e chaves.
- **Alternativas:** renomear tudo com migração de pasta (risco sem benefício agora).
- **Impactos:** o instalador NSIS passa a usar o novo nome; caminhos de dados permanecem os mesmos.

## DEC-026 — Backend sem framework: um handler `fetch` + Zod, rate limit em memória

- **Data:** 2026-10-13
- **Decisão:** o `backend/` é uma única Vercel Function (`api/index.ts`, export Web standard `fetch`) com
  roteamento interno por caminho (`src/app.ts`) e rewrite de todas as rotas em `vercel.json` — formato recomendado
  pela Vercel. Dependência de runtime: só `zod`. Dev: `typescript`, `vitest`, `eslint`/`typescript-eslint`,
  `@types/node`, `globals` (mesmas versões da raiz). `fetch`, logger, relógio e rate limiter são injetados
  (testes sem rede). Rate limit por IP em janela fixa **em memória da instância** (melhor esforço), complementado
  por regra no Firewall da Vercel. TypeScript `NodeNext` com imports `.js`; Node 24.x.
- **Motivo:** seis rotas não justificam framework (Hono/Express); menos dependências para auditar; o handler Web
  standard roda igual nos testes e na Vercel.
- **Alternativas:** Hono (bom, mas desnecessário agora — reavaliar quando houver API/MCP); Express (servidor
  tradicional, pior encaixe em funções); rate limit com Redis/KV (introduziria estado e custo).
- **Impactos:** `backend/` com `package.json`, lint e testes próprios (`npm run backend:check` na raiz); o ESLint da
  raiz ignora `backend/`; Prettier da raiz cobre os dois.

## DEC-027 — OAuth TikTok com Login Kit Desktop + PKCE (loopback direto)

- **Data:** 2026-10-13
- **Decisão (do usuário, substitui a DEC-024):**
  1. No portal do TikTok, Login Kit na plataforma **Desktop**, redirect URI `http://127.0.0.1:*/tiktok/callback`
     (sintaxe confirmada na documentação oficial: "URIs must have a port number, and wildcard port number (\*) is
     supported"; exemplo oficial `http://127.0.0.1:*/callback/`; só `localhost`/`127.0.0.1`; sem query/fragmento).
  2. A cada login o desktop gera `state` (43 caracteres) e `code_verifier` (64 caracteres, RFC 7636) com o CSPRNG do
     sistema, calcula `code_challenge` e manda `code_challenge_method=S256`. **Peculiaridade do TikTok:** o
     `code_challenge` é o SHA-256 do verifier em **hexadecimal** ("You must use hex encoding of SHA256"), não
     base64url como no RFC 7636 — coberto por teste com o vetor do RFC (`src-tauri/src/tiktok/pkce.rs`).
  3. O TikTok redireciona **direto** para `http://127.0.0.1:<porta>/tiktok/callback`; o listener aceita só `GET`
     no caminho exato, `Host` loopback com a porta certa, `state` igual (tempo constante, uso único) e encerra em
     5 min (`src-tauri/src/tiktok/loopback.rs`).
  4. O desktop envia `{ code, codeVerifier, redirectUri }` ao backend (`POST /auth/tiktok/token`). O backend exige
     PKCE, aceita só redirect URI loopback no formato exato e acrescenta o `client_secret` — que continua
     **exclusivamente** no backend. A `redirect_uri` da troca é a usada na autorização, com a porta real.
  5. Backend mantido em `api.yeaax.xyz` para token, refresh, revoke, client secret e futuras APIs/MCP/Instagram.
     **Removida** a rota `GET /auth/tiktok/callback` (não participa mais do login; sem uso futuro previsto — o
     Instagram terá rota própria se precisar) e a variável `TIKTOK_REDIRECT_URI`.
  6. O vídeo continua indo direto do desktop para o TikTok.
- **Motivo:** o cliente é um app desktop e o TikTok tem fluxo oficial para Desktop com loopback + PKCE (padrão
  RFC 8252 para apps nativos): o code fica amarrado ao `code_verifier` que só o desktop conhece, então interceptar
  o code não basta; elimina a rota pública de repasse e a dependência do backend no redirect.
- **Alternativas:** manter Web com repasse (DEC-024 — mais superfície pública, PKCE não documentado no Web).
- **Riscos:** o desafio hex é fora do padrão (testado); o refresh token continua no desktop (divergência mantida —
  ver revisão da DEC-024, item 6, e SECURITY.md); outro processo local poderia ocupar a mesma porta — mitigado pela
  porta escolhida pelo sistema no bind e pelo `state`.
- **Impactos:** novas dependências Rust `getrandom` 0.3, `sha2` 0.10 e `url` 2 (já presentes na árvore via Tauri);
  backend: `POST /auth/tiktok/token` exige `codeVerifier` e `redirectUri`; `/config` informa redirect e PKCE.
