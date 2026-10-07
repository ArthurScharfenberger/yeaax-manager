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
