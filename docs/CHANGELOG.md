# Changelog

Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/); versões seguem
[Semantic Versioning](https://semver.org/lang/pt-BR/).

## [Não lançado]

### Adicionado

- Miniaturas reais na biblioteca: capturadas pelo WebView2 durante a importação (sem FFmpeg) e gravadas em
  `%APPDATA%\com.socialmanager.desktop\thumbnails\`. Vídeos sem miniatura (importados antes ou com falha na
  captura) são processados automaticamente em segundo plano ao abrir o app.
- Comandos Rust `save_thumbnail` e `delete_thumbnail`; remover um vídeo da biblioteca apaga a miniatura.
- Testes do serviço de mídia (importação, falhas, miniaturas).
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
