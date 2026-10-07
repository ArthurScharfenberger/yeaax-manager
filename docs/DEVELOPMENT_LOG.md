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

### Pendências

- Validação manual interativa no app desktop (importar vídeos reais, preview, reabrir o app) — não foi possível
  operar a janela nativa nesta sessão.
- Ver `docs/TODO.md` (Agora/Próximo).

### Próximo passo

Rodar `npm run app:dev`, importar alguns vídeos reais e validar o fluxo completo da biblioteca no desktop. Em
seguida, iniciar a Fase 2 pelo FFmpeg: comando Rust com `ffprobe` (metadados) e geração de miniaturas em pasta
do app, preenchendo `media.thumbnail_path`.
