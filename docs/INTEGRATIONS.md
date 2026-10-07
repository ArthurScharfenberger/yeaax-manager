# Integrações

Status possíveis: `NOT_STARTED` · `MOCK` · `IN_PROGRESS` · `ACTIVE` · `BLOCKED`.
O mesmo status aparece na UI (Configurações → Integrações), definido em `src/lib/integrations.ts` —
**mantenha os dois em sincronia.**

| Integração | Status        | Código                                                                     | Próximo passo                           |
| ---------- | ------------- | -------------------------------------------------------------------------- | --------------------------------------- |
| TikTok     | `MOCK`        | `src/services/social/TikTokProvider.ts`                                    | Fase 3: Login Kit + Content Posting API |
| Instagram  | `MOCK`        | `src/services/social/InstagramProvider.ts`                                 | Fase 3: Instagram Graph API             |
| OpenAI     | `IN_PROGRESS` | `src/services/ai/OpenAIProvider.ts`, `src-tauri/src/commands/ai.rs`        | Validar com a chave real do usuário     |
| FFmpeg     | `NOT_STARTED` | `src/services/media/VideoProcessor.ts`, `src-tauri/src/commands/system.rs` | Fase 2: ffprobe + miniaturas            |

## Regras gerais (valem para todas)

- **Somente APIs oficiais.** Nada de scraping, automação de navegador, endpoints não documentados ou burla
  de autenticação.
- O domínio só conhece as interfaces (`SocialProvider`, `AIProvider`, `VideoProcessor`). Trocar mock por real
  não pode exigir mudanças em `features/`.
- Segredos (client secret, API key) e tokens **nunca** chegam ao frontend: OAuth, armazenamento de tokens e
  chamadas autenticadas ficam no lado Rust; tokens no Credential Manager (ver SECURITY.md).
- Respostas externas são não confiáveis: validar com Zod antes de usar; nunca logar payloads com tokens.
- Ao mudar o status de uma integração: atualizar esta tabela, `src/lib/integrations.ts`, CHANGELOG e API_NOTES.

---

## TikTok — `MOCK`

- **Contrato:** `SocialProvider` (connect, disconnect, getProfile, publish, getPublicationStatus, getAnalytics).
- **Hoje:** `TikTokProvider extends MockSocialProvider` — latência simulada, nenhuma rede.
- **Viabilidade (pesquisa de 2026-10-07, ver API_NOTES.md):** envio do arquivo local é suportado
  (`FILE_UPLOAD` em chunks); login desktop com PKCE e redirect em `localhost` é suportado. **Bloqueio:** sem
  auditoria do app, só posts privados (`SELF_ONLY`) e a conta precisa estar privada.
- **Plano (Fase 3):**
  1. Usuário registra o próprio app no TikTok for Developers (DEC-020); client key/secret no Credential Manager.
  2. OAuth (Login Kit desktop) no Rust: navegador do sistema → callback em `http://127.0.0.1:<porta>` → troca do
     code com PKCE. Access token 24 h, refresh 365 dias (renovação automática).
  3. Compositor com a UX obrigatória do TikTok (privacidade sem padrão, interações, divulgação comercial,
     confirmação de música, prévia) e consulta a `creator_info` antes de postar (DEC-019).
  4. Publicação: _Direct Post_ (app auditado) ou _Upload_ para rascunhos (sem auditoria, se o sandbox confirmar);
     upload sequencial em chunks de 5–64 MB; respeitar 6 req/min e as cotas diárias.
  5. Analytics a partir dos endpoints oficiais disponíveis para o escopo concedido.
- **Decisão do usuário pendente:** solicitar a auditoria do app (necessária para posts públicos) ou usar o modo rascunho.

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
