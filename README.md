# Yeaax Manager

Repositório: [yeaax-manager](https://github.com/ArthurScharfenberger/yeaax-manager) · Site: [yeaax.xyz](https://yeaax.xyz).
(Antes chamado "Social Manager"; o identificador interno `com.socialmanager.desktop` foi mantido — DEC-025.)

Central pessoal **local-first** para organizar, preparar, agendar e (futuramente) publicar e analisar
conteúdo em múltiplos canais do **TikTok** e do **Instagram**. Aplicativo desktop que roda inteiramente no
seu computador — sem Docker e sem nuvem para os seus dados. Um **backend mínimo e sem estado** em
`https://api.yeaax.xyz` (pasta [`backend/`](backend/README.md), projeto Vercel separado) existe só para o callback OAuth e
o client secret das plataformas (DEC-023).

> Objetivo de longo prazo: um _Content Automation Engine_ — você adiciona conteúdo à biblioteca e o
> sistema ajuda a organizar, preparar, agendar, publicar e analisar.

## Status

**v0.1.0 — Fundação (MVP em andamento).** A interface e os fluxos locais funcionam com SQLite. As
integrações externas (TikTok, Instagram, OpenAI, FFmpeg) estão **preparadas na arquitetura, mas
simuladas** — nenhuma publicação real acontece ainda. A OpenAI já é real (chave do usuário). **Fase atual:**
integração real do TikTok (Login Kit Web + Content Posting API). Detalhes em [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md).

## Funcionalidades atuais

| Área          | O que já funciona                                                                                               |
| ------------- | --------------------------------------------------------------------------------------------------------------- |
| Dashboard     | Busca global, métricas rápidas, fila de publicação, contas, agenda da semana, sugestões (simuladas), biblioteca |
| Canais        | Lista, filtros, conectar/desconectar/sincronizar (provider mock), adicionar e remover canal                     |
| Biblioteca    | Importação local (.mp4/.mov/.webm) sem copiar arquivos, grid/lista, busca, filtros, tags, preview do vídeo      |
| Posts         | Rascunho / revisão / agendado, validação de limites, anti-duplicidade, histórico de alterações                  |
| Calendário    | Visão semanal por hora, detalhes do post, **arrastar para reagendar**, duplo clique para criar                  |
| Automação     | Configuração do Auto Schedule salva localmente + prévia de horários (execução ainda não implementada)           |
| Legendas IA   | Gerador **local simulado** de legendas e hashtags (3 variações, 3 idiomas, 4 tons)                              |
| Analytics     | Placeholder honesto (nenhuma métrica é inventada)                                                               |
| Configurações | Geral, Armazenamento, Integrações, IA, FFmpeg (detecção), Aparência, Sobre (com logs da sessão)                 |

Na primeira execução o app cria **dados de demonstração** (@yeaxx, @techfix.rs, Clipes…), que podem ser
removidos em _Configurações → Geral_.

## Stack

- **Desktop:** Tauri 2 (Rust) — banco, diálogos nativos, inspeção de arquivos
- **Frontend:** React 19 · TypeScript (strict) · Vite 8 · Tailwind CSS 4 · React Router (hash)
- **Dados:** SQLite (`tauri-plugin-sql`) · TanStack Query · Zod
- **Qualidade:** ESLint (typescript-eslint strict, type-aware) · Prettier · Vitest (com SQLite real em memória)

## Pré-requisitos (Windows)

| Ferramenta        | Versão usada             | Instalação                                                                                                  |
| ----------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| Node.js           | 24 LTS (≥ 22.12)         | `winget install OpenJS.NodeJS.LTS`                                                                          |
| Rust              | stable (MSVC)            | `winget install Rustlang.Rustup`                                                                            |
| C++ Build Tools   | VS 2022 + workload C++   | `winget install Microsoft.VisualStudio.2022.BuildTools` (selecionar "Desenvolvimento para desktop com C++") |
| WebView2          | já incluso no Windows 11 | —                                                                                                           |
| FFmpeg (opcional) | —                        | `winget install Gyan.FFmpeg` (ainda só é detectado)                                                         |

## Instalação

```bash
npm install
```

## Execução

```bash
# App desktop completo (Tauri + SQLite em arquivo)
npm run app:dev

# Preview só da interface no navegador (SQLite WASM em memória + dados de demonstração)
npm run dev        # http://localhost:1420

# Executável de produção (gera instalador NSIS em src-tauri/target/release/bundle)
npm run app:build
```

O banco do app desktop fica em `%APPDATA%\com.socialmanager.desktop\social-manager.db` e as miniaturas em
`%APPDATA%\com.socialmanager.desktop\thumbnails\`.

> **PowerShell bloqueando o `npm`?** Se aparecer "npm.ps1 não pode ser carregado porque a execução de scripts
> foi desabilitada", use `npm.cmd run app:dev` (ou rode no Prompt de Comando). Alternativa permanente, a seu
> critério: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`.

## Scripts de qualidade

```bash
npm run typecheck     # tsc -b (strict)
npm run lint          # ESLint
npm run format:check  # Prettier
npm run test          # Vitest
npm run check         # todos os anteriores
cargo test --manifest-path src-tauri/Cargo.toml   # testes do lado Rust
```

## Estrutura do projeto

```
src/
  app/          shell: bootstrap, composição de serviços, rotas, layout, erros
  components/   componentes visuais compartilhados (ui/ = design system próprio)
  db/           ÚNICO lugar com SQL: clientes SQLite, repositórios, dados de demonstração
  features/     domínios: dashboard, channels, media, posts, scheduling, automation, ai, analytics, settings, search
  hooks/        hooks genéricos
  lib/          infraestrutura: erros, logger, query client, labels, plataformas, integrações
  services/     integrações externas isoladas: social/ (TikTok, Instagram), ai/, media/ (FFmpeg), desktop/ (Tauri)
  stores/       reservado (sem Zustand por enquanto)
  types/        entidades e enums do domínio (Zod)
  utils/        funções puras (datas, formatação)
src-tauri/      app Rust: comandos, migrations SQL, permissões (capabilities)
backend/        serviço separado (Vercel, api.yeaax.xyz): OAuth e client secrets (DEC-023) — ver backend/README.md
docs/           documentação viva do projeto
```

Detalhes em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Roadmap resumido

- **MVP** — fundação, biblioteca, posts, calendário, configurações ✅ · validação manual no desktop, logs em arquivo, backup
- **Fase 2** — FFmpeg (metadados, miniaturas, formatos, watermark), motor de Auto Schedule, fila e agendador local
- **Fase 3** — integrações oficiais TikTok/Instagram, tokens no Credential Manager, publicação real, OpenAI, analytics
- **Longo prazo** — serviço remoto opcional, recomendações de conteúdo/horário, importação por URL quando permitido

Completo em [docs/ROADMAP.md](docs/ROADMAP.md).

## Documentação

| Documento                                          | Conteúdo                                                      |
| -------------------------------------------------- | ------------------------------------------------------------- |
| [AGENTS.md](AGENTS.md)                             | Regras para agentes de IA e colaboradores — **leia primeiro** |
| [docs/PROJECT.md](docs/PROJECT.md)                 | Visão, objetivos, princípios e escopo                         |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)       | Camadas, pastas, fluxo de dados, runtime                      |
| [docs/DATABASE.md](docs/DATABASE.md)               | Tabelas, relacionamentos, migrations                          |
| [docs/DECISIONS.md](docs/DECISIONS.md)             | Registro de decisões (ADR)                                    |
| [docs/ROADMAP.md](docs/ROADMAP.md)                 | Fases e progresso                                             |
| [docs/TODO.md](docs/TODO.md)                       | Agora / Próximo / Depois                                      |
| [docs/INTEGRATIONS.md](docs/INTEGRATIONS.md)       | TikTok, Instagram, OpenAI, FFmpeg — status e plano            |
| [docs/API_NOTES.md](docs/API_NOTES.md)             | Anotações sobre as APIs externas                              |
| [docs/SECURITY.md](docs/SECURITY.md)               | Tokens, segredos, armazenamento, logs                         |
| [docs/DESIGN.md](docs/DESIGN.md)                   | Diretrizes visuais e componentes                              |
| [docs/CHANGELOG.md](docs/CHANGELOG.md)             | Mudanças por versão                                           |
| [docs/DEVELOPMENT_LOG.md](docs/DEVELOPMENT_LOG.md) | Diário técnico das sessões                                    |

## Licença

Projeto pessoal, uso privado.
