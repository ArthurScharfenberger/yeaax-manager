# Roadmap

Marque `[x]` ao concluir (com a versão entre parênteses quando fizer sentido). Itens novos entram na fase adequada.

## MVP — fundação e fluxos locais (v0.x)

### Fundação

- [x] Tauri 2 + React 19 + TypeScript strict + Vite 8 (v0.1.0)
- [x] Tailwind CSS 4 com tokens próprios e design system em `components/ui` (v0.1.0)
- [x] ESLint (strict, type-aware) + Prettier + Vitest (v0.1.0)
- [x] SQLite local, migrations, repositórios, dados de demonstração (v0.1.0)
- [x] Tratamento de erros (`AppError`) e logger com redação de dados sensíveis (v0.1.0)
- [x] Modo preview no navegador com SQLite WASM (v0.1.0)
- [x] Documentação completa + AGENTS.md (v0.1.0)
- [x] Repositório remoto GitHub configurado: `ArthurScharfenberger/yeaax-manager`, branch `main` (2026-10-13)

### Produto

- [x] Layout principal + sidebar (v0.1.0)
- [x] Dashboard: busca global, métricas, fila, contas, agenda da semana, sugestões, biblioteca (v0.1.0)
- [x] Canais com provider mock (conectar, desconectar, sincronizar, adicionar, remover) (v0.1.0)
- [x] Biblioteca: importação local por caminho, validação, grid/lista, busca, filtros, tags, preview (v0.1.0)
- [x] Posts: rascunho, revisão, agendamento, histórico, anti-duplicidade, limites por plataforma (v0.1.0)
- [x] Calendário semanal com detalhes e arrastar para reagendar (v0.1.0)
- [x] Automação: configuração do Auto Schedule + prévia de horários (sem execução) (v0.1.0)
- [x] Legendas IA com gerador local simulado (v0.1.0)
- [x] Analytics: placeholder honesto (v0.1.0)
- [x] Configurações: Geral, Armazenamento, Integrações, IA, FFmpeg, Aparência, Sobre (v0.1.0)
- [x] Validação manual no app desktop: importação `.mp4`, preview e persistência (v0.1.0)
- [x] Miniaturas automáticas capturadas pelo WebView2 na importação + preenchimento das pendentes (não lançado)
- [x] Logs persistidos em arquivo (tauri-plugin-log) com rotação (não lançado)
- [ ] Backup e restauração do banco (exportar/importar arquivo)
- [x] Duplicar post para outro canal como rascunho (não lançado)
- [x] Página Posts com todos os posts e filtros, inclusive rascunhos sem data (não lançado)
- [ ] Instalador NSIS revisado (ícone, nome, atalhos)

## Fase 2 — preparação de conteúdo e automação local

- [ ] FFmpeg: leitura de metadados com ffprobe (substitui DEC-017)
- [ ] Miniaturas via FFmpeg para codecs que o WebView2 não decodifica
- [ ] Jobs de processamento assíncronos (`media_processing_jobs`) com progresso na UI
- [ ] Adaptação de formato (9:16, Reels/TikTok), compressão
- [ ] Logo/watermark próprio por canal
- [ ] Classificação automática por regras (nome de arquivo, pastas, duração)
- [ ] Detecção de vídeo duplicado na importação (hash do arquivo)
- [ ] Motor do Auto Schedule: **sugere** posts em revisão com horários; o usuário confirma cada um (DEC-019)
- [ ] Filas de postagem por canal
- [ ] Agendador local: dispara publicações enquanto o app está aberto (bandeja do sistema)
- [ ] Notificações do sistema (falhas, publicações concluídas)

## Fase 3 — integrações oficiais

- [x] Pesquisa de viabilidade das APIs oficiais (2026-10-07 — ver API_NOTES.md)
- [x] Arquitetura da fase TikTok real: backend mínimo, nome "Yeaax Manager" (DEC-023/025, 2026-10-13)
- [x] Login Kit Desktop + PKCE no lugar do Web; callback público removido (DEC-027, 2026-10-13)
- [x] Backend mínimo `backend/`: `/health`, `/config`, token (PKCE), refresh, revoke + testes (DEC-023/026/027, 2026-10-13)
- [ ] Deploy do backend na Vercel em `api.yeaax.xyz`
- [x] Tokens no Credential Manager por canal (`tiktok_token:<channel_id>`), conexão em duas fases — DEC-027 (2026-10-13)
- [ ] Compositor com campos por plataforma (UX obrigatória do TikTok, `share_to_feed`/capa no Instagram) + coluna `platform_options`
- [ ] Validação de especificações por plataforma antes de agendar (duração, tamanho, formato)
- [ ] Instagram: token do painel + renovação automática + publicação de Reels por upload resumável
- [x] TikTok: PKCE (hex) e validação do callback local no Rust, com testes (2026-10-13)
- [x] TikTok: Login Kit **Desktop** no Rust (listener loopback, troca via backend, perfil) + `TikTokProvider` real (2026-10-13)
- [x] TikTok: teste real no sandbox — login, PKCE, troca, perfil, cofre, sincronizar, desconectar/revogar (2026-10-13)
- [x] TikTok: UI da conta conectada — botão direto, open_id, avatar, verificação ao abrir, sessão expirada, cancelar login (DEC-028, 2026-10-13)
- [ ] TikTok: compositor com a UX obrigatória + publicação real (Content Posting API) — **prioridade**
- [ ] TikTok: Content Posting API (Direct Post `SELF_ONLY` no sandbox; público após auditoria; rascunho como alternativa)
- [ ] TikTok: fluxo demonstrável para o vídeo do App Review
- [ ] TikTok: App Review/auditoria (necessária para posts públicos) — usuário decidiu solicitar
- [ ] Publicação real + acompanhamento de status (`publication_attempts`)
- [x] OpenAI: legendas, hashtags e "Postar com IA" com leitura da miniatura (não lançado)
- [ ] Registro de execuções de IA e custos (`ai_executions`)
- [ ] Analytics: snapshots periódicos por post/canal (`analytics_snapshots`)
- [ ] Tratamento de expiração/renovação de tokens

## Longo prazo

- [ ] Serviço remoto opcional para agendamentos com o computador desligado
- [ ] Sugestão de melhor conteúdo e horário por canal (dados próprios de analytics)
- [ ] Importação de conteúdo via URL quando tecnicamente e legalmente permitido
- [ ] Tema escuro
- [ ] Novas plataformas (ex.: YouTube Shorts)
- [ ] Content Automation Engine: pipeline completo biblioteca → preparo → agenda → publicação → análise
