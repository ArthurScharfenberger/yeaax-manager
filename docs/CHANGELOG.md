# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões seguem
[Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Segurança

- Credenciais (tokens do TikTok e chave da OpenAI) passam a ser gravadas no Gerenciador de Credenciais com
  persistência **local** (não acompanham perfis móveis de domínio).
- Logs de bibliotecas de rede, TLS e cofre limitados a avisos (menos ruído e nenhuma descrição de itens do cofre).

### Alterado

- Nome exibido do app passa a ser **Yeaax Manager** (janela, sidebar, instalador). Identificador interno, pasta de
  dados, banco e cofre de credenciais continuam os mesmos (DEC-025).
- `.env.example` da raiz não lista mais client secrets: eles ficarão só no backend mínimo (DEC-023).
- Arquitetura da integração real do TikTok documentada: backend mínimo sem estado em `api.yeaax.xyz` e OAuth Web
  com callback HTTPS repassado ao desktop (DEC-023, DEC-024).

### Adicionado

- **Conexão real com o TikTok no app desktop** (Login Kit Desktop + PKCE): "Conectar" abre a autorização oficial no
  navegador, o app recebe o retorno em `127.0.0.1`, troca o code pelo backend e guarda os tokens no Gerenciador de
  Credenciais. Conexão transacional (canal e credenciais gravados juntos ou nada muda), sincronização do perfil e
  desconexão com revogação. No preview do navegador continua simulado. Publicação ainda não.
- Login do TikTok passa a ser **Login Kit Desktop + PKCE** (DEC-027): núcleo no Rust com geração de `state` e
  `code_verifier` pelo CSPRNG do sistema, `code_challenge` SHA-256 em hex (formato exigido pelo TikTok) e validação
  estrita do callback local em `127.0.0.1` (16 testes novos).
- **Backend mínimo** (`backend/`, publicado separadamente em `api.yeaax.xyz`): `/health`, `/config`,
  `/auth/tiktok/token` (exige PKCE e redirect loopback), `/refresh` e `/revoke`. A rota de callback do fluxo Web foi
  removida com a DEC-027.
  Sem estado, CORS fechado, validação Zod, rate limit, logs sem dados sensíveis, erros do TikTok normalizados,
  62 testes (DEC-026).
- Revisão de segurança da DEC-024 e registro da divergência sobre refresh tokens no desktop (SECURITY.md).
- Miniaturas reais na biblioteca: capturadas pelo WebView2 durante a importação (sem FFmpeg) e gravadas em
  `%APPDATA%\com.socialmanager.desktop\thumbnails\`. Vídeos sem miniatura (importados antes ou com falha na
  captura) são processados automaticamente em segundo plano ao abrir o app.
- Comandos Rust `save_thumbnail` e `delete_thumbnail`; remover um vídeo da biblioteca apaga a miniatura.
- Testes do serviço de mídia (importação, falhas, miniaturas).
- **Postar com IA**: no painel do vídeo, descreva o que quer (ex.: "legenda em inglês com boas hashtags,
  amanhã às 19h"); a IA vê a miniatura, escolhe canais, escreve legendas/hashtags e propõe o horário; você revisa,
  edita e confirma. Canais que já têm o vídeo saem do plano automaticamente.
- **OpenAI real** (modelo padrão `gpt-6-luna`): chave em Configurações → IA, guardada no Gerenciador de
  Credenciais do Windows; chamadas feitas pelo Rust. Legendas IA também passam a usar a OpenAI. Sem chave, um
  simulador local mantém tudo funcionando.
- Após importar, o vídeo novo abre selecionado na Biblioteca.
- Página **Posts** (`/posts`): todos os posts, inclusive rascunhos sem data, com filtros na URL (busca, status,
  canal, data, ordenação) e ações por linha.
- **Duplicar para outro canal**: cópias como rascunho (mesmo vídeo, legenda e horário planejado), com
  pré-seleção da mesma marca na outra plataforma; disponível nos detalhes e nos menus de ação.
- **Logs em arquivo** via `tauri-plugin-log` em `%LOCALAPPDATA%\com.socialmanager.desktop\logs\`
  (5 MB por arquivo, 5 arquivos mantidos); pasta exibida em Configurações → Sobre.
- Limite de 20 menções (@) por legenda no Instagram, com contador no compositor.
- Pesquisa de viabilidade das APIs oficiais do TikTok e do Instagram (`docs/API_NOTES.md`), com as
  decisões DEC-019 (consentimento por post; Auto Schedule só sugere) e DEC-020 (credenciais do próprio usuário).

### Alterado

- `videoMetadata.ts` substituído por `videoAnalysis.ts` (metadados + quadro em uma única leitura).
- Asset protocol: escopo estático restrito à pasta de miniaturas do app.

## [0.1.0] — 2026-10-07

Primeira versão: fundação do projeto.

### Adicionado

- Projeto Tauri 2 + React 19 + TypeScript strict + Vite 8 + Tailwind CSS 4.
- SQLite local via `tauri-plugin-sql` com migration inicial (`channels`, `media`, `tags`, `media_tags`,
  `posts`, `post_history`, `app_settings`).
- Camada de dados em `src/db` com três clientes (Tauri, SQLite WASM para preview, `node:sqlite` para testes).
- Dados de demonstração (5 canais, 10 vídeos, 15 posts com histórico), removíveis em Configurações.
- Dashboard com busca global, métricas, fila de publicação, contas conectadas, agenda da semana,
  sugestões simuladas e biblioteca recente.
- Página Canais com provider mock (conectar, desconectar, sincronizar, adicionar, remover).
- Biblioteca com importação local (.mp4/.mov/.webm) sem cópia, leitura de duração/resolução, grid/lista,
  busca, filtros por status e tag, edição de tags, preview do vídeo e remoção segura.
- Posts: compositor (rascunho, revisão, agendamento), detalhes com histórico, cancelamento, exclusão,
  regras de transição de status, anti-duplicidade por canal e limites de legenda/hashtags.
- Calendário semanal por hora com arrastar para reagendar e duplo clique para criar.
- Automação: configuração do Auto Schedule persistida + prévia de horários.
- Legendas IA: gerador local simulado de legendas e hashtags.
- Analytics: placeholder sem métricas inventadas.
- Configurações: Geral, Armazenamento, Integrações, IA, FFmpeg (detecção no PATH), Aparência, Sobre (logs).
- Contratos de integração: `SocialProvider` (TikTok/Instagram mock), `AIProvider`, `VideoProcessor`, `DesktopBridge`.
- Comandos Rust `inspect_media_file` (validação de caminho/extensão/tamanho) e `detect_ffmpeg`.
- Tratamento de erros (`AppError`), logger com redação de segredos, error boundaries.
- ESLint, Prettier, Vitest (testes de regras, serviços e repositórios com SQLite real) e testes Rust.
- Documentação: README, AGENTS.md, docs/ (projeto, arquitetura, banco, decisões, roadmap, TODO,
  integrações, notas de API, segurança, design, diário de desenvolvimento).
