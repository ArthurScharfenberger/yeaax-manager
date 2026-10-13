# Integrações

Status possíveis: `NOT_STARTED` · `MOCK` · `IN_PROGRESS` · `ACTIVE` · `BLOCKED`.
O mesmo status aparece na UI (Configurações → Integrações), definido em `src/lib/integrations.ts` —
**mantenha os dois em sincronia.**

| Integração | Status        | Código                                                                     | Próximo passo                        |
| ---------- | ------------- | -------------------------------------------------------------------------- | ------------------------------------ |
| TikTok     | `MOCK`        | `src/services/social/TikTokProvider.ts`, `backend/`                        | **Prioridade atual:** OAuth Web real |
| Instagram  | `MOCK`        | `src/services/social/InstagramProvider.ts`                                 | Fase 3: Instagram Graph API          |
| OpenAI     | `IN_PROGRESS` | `src/services/ai/OpenAIProvider.ts`, `src-tauri/src/commands/ai.rs`        | Validar com a chave real do usuário  |
| FFmpeg     | `NOT_STARTED` | `src/services/media/VideoProcessor.ts`, `src-tauri/src/commands/system.rs` | Fase 2: ffprobe + miniaturas         |

## Regras gerais (valem para todas)

- **Somente APIs oficiais.** Nada de scraping, automação de navegador, endpoints não documentados ou burla
  de autenticação.
- O domínio só conhece as interfaces (`SocialProvider`, `AIProvider`, `VideoProcessor`). Trocar mock por real
  não pode exigir mudanças em `features/`.
- Segredos (client secret, API key) e tokens **nunca** chegam ao frontend: OAuth, armazenamento de tokens e
  chamadas autenticadas ficam no lado Rust; tokens no Credential Manager. Client secrets das plataformas ficam
  só no backend mínimo `api.yeaax.xyz` (DEC-023; ver SECURITY.md).
- Respostas externas são não confiáveis: validar com Zod antes de usar; nunca logar payloads com tokens.
- Ao mudar o status de uma integração: atualizar esta tabela, `src/lib/integrations.ts`, CHANGELOG e API_NOTES.

---

## TikTok — `MOCK` (prioridade atual)

- **Contrato:** `SocialProvider` (connect, disconnect, getProfile, publish, getPublicationStatus, getAnalytics).
- **Hoje:** `TikTokProvider extends MockSocialProvider` — latência simulada, nenhuma rede. Ainda **não há
  publicador**: `publish()` não é chamado por nenhum caso de uso.
- **App:** "Yeaax Manager" no TikTok for Developers; Login Kit **Web**; produtos Login Kit + Content Posting API;
  escopos `user.info.basic`, `user.info.profile`, `video.publish`, `video.upload`. Termos e privacidade em
  `yeaax.xyz`. Sem auditoria: sandbox com até 10 contas próprias (target users), posts só `SELF_ONLY` em conta
  privada — suficiente para o vídeo do App Review.
- **Arquitetura (DEC-023/024):** callback `https://api.yeaax.xyz/auth/tiktok/callback` repassa o `code` ao loopback
  do desktop; o backend troca/renova/revoga com o `client_secret`; tokens no Credential Manager; chamadas de
  API e upload direto do Rust para `open.tiktokapis.com`. Ver ARCHITECTURE.md.
- **Ordem de implementação:**
  1. [x] Documentação e decisões (DEC-023, DEC-024, DEC-025).
  2. [x] Backend `backend/`: `/health`, `/config`, `/auth/tiktok/{callback,token,refresh,revoke}` + 62 testes
         (DEC-026). [ ] Deploy na Vercel em `api.yeaax.xyz` (usuário).
  3. [ ] Rust OAuth: `state`, listener loopback, navegador do sistema, troca via backend, tokens no cofre.
  4. [ ] Conta conectada: migration 0002 (`channels.external_id`), `connect/getProfile/disconnect` reais, botão
         "Conectar TikTok". Primeiro teste ponta a ponta no sandbox.
  5. [ ] Compositor TikTok (UX obrigatória — DEC-019): `creator_info`, nickname, privacidade sem padrão, toggles
         desmarcados, divulgação comercial, aviso de música, prévia; `posts.platform_options`.
  6. [ ] Publicação: init `FILE_UPLOAD` + chunks sequenciais com progresso, polling de status,
         `publication_attempts`, "Publicar agora".
  7. [ ] Tela de status/resultado e roteiro do vídeo do App Review.
  8. [ ] App Review (usuário). Depois: agendador local e Instagram.

## Instagram — `MOCK`

- **Contrato:** `SocialProvider`.
- **Hoje:** `InstagramProvider extends MockSocialProvider`.
- **Viabilidade (pesquisa de 2026-10-07):** **boa para uso pessoal** — upload resumável do arquivo local (sem
  hospedar o vídeo), Standard Access sem App Review para contas próprias, 100 posts/24 h. Exige conta
  **profissional** (Business ou Creator).
- **Plano (Fase 3):**
  1. Usuário cria o app na Meta (caso de uso Instagram API com Instagram Login) e adiciona as próprias contas.
  2. Token gerado no painel colado em Configurações (Credential Manager); renovação automática antes de 60 dias
     via `refresh_access_token` (sem app secret) — DEC-020.
  3. Publicação de Reels: container `REELS` + `upload_type=resumable` → upload para `rupload.facebook.com` →
     polling de `status_code` → `media_publish`. Validar especificações antes (3 s–15 min, ≤ 300 MB, MP4/MOV com
     faststart, H.264/HEVC, 9:16).
  4. Insights para analytics.
- **Decisão do usuário pendente:** confirmar que as contas são profissionais.

## OpenAI — `IN_PROGRESS`

- **Contrato:** `AIProvider` (`generateCaptions`, `planPost`); o app usa `AIService` (`src/services/ai/index.ts`),
  que escolhe a OpenAI quando há chave no cofre e o `MockAIProvider` (regras locais) caso contrário.
- **Implementado (DEC-022):** `OpenAIProvider` — Chat Completions + Structured Outputs (`json_schema` estrito),
  imagem da miniatura (`image_url`, `detail: low`); chamada HTTP no Rust (`ai_chat_completion`) com a chave do
  Gerenciador de Credenciais; modelo configurável (padrão `gpt-6-luna`); "Testar conexão" em Configurações → IA.
- **Usado em:** "Postar com IA" (plano de publicação) e Legendas IA.
- **Falta:** validação com a chave real do usuário; registro de execuções/custos (`ai_executions`); limite de
  gasto mensal.

## FFmpeg — `NOT_STARTED`

- **Contrato:** `VideoProcessor` (`getStatus`, `generateThumbnail`, `adaptForPlatform`, `applyWatermark`).
- **Hoje:** `getStatus` funciona (comando Rust `detect_ffmpeg` executa `ffmpeg -version` do PATH, sem janela de
  console); as demais operações retornam `NOT_AVAILABLE`.
- **Plano (Fase 2):**
  1. `ffprobe` para metadados (substitui a leitura via `<video>` — DEC-017).
  2. Miniaturas para codecs que o WebView2 não decodifica (hoje a captura é feita pelo WebView2 — DEC-018 —
     e gravada em `thumbnails/` pelo comando `save_thumbnail`).
  3. Jobs assíncronos no Rust com progresso (`media_processing_jobs`).
  4. Presets: TikTok/Reels 9:16, compressão, watermark por canal.
- **Regras:** argumentos montados no Rust a partir de presets fixos — nunca de texto livre do usuário;
  caminhos validados; saídas sempre na pasta do app.
- **Instalação sugerida:** `winget install Gyan.FFmpeg`.
