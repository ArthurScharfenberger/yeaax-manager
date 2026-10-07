# Integrações

Status possíveis: `NOT_STARTED` · `MOCK` · `IN_PROGRESS` · `ACTIVE` · `BLOCKED`.
O mesmo status aparece na UI (Configurações → Integrações), definido em `src/lib/integrations.ts` —
**mantenha os dois em sincronia.**

| Integração | Status        | Código                                                                     | Próximo passo                           |
| ---------- | ------------- | -------------------------------------------------------------------------- | --------------------------------------- |
| TikTok     | `MOCK`        | `src/services/social/TikTokProvider.ts`                                    | Fase 3: Login Kit + Content Posting API |
| Instagram  | `MOCK`        | `src/services/social/InstagramProvider.ts`                                 | Fase 3: Instagram Graph API             |
| OpenAI     | `MOCK`        | `src/services/ai/MockAIProvider.ts`                                        | Fase 3: `OpenAIProvider` via Rust       |
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
- **Plano (Fase 3):**
  1. Registrar app no TikTok for Developers; obter Client Key/Secret (guardar fora do repositório).
  2. OAuth (Login Kit) no Rust: abrir navegador do sistema, receber callback em loopback local, trocar code por token.
  3. Tokens no Credential Manager; o banco guarda só o estado do canal.
  4. Publicação via Content Posting API (upload do arquivo local); acompanhar status por polling.
  5. Analytics a partir dos endpoints oficiais disponíveis para o escopo concedido.
- **Pontos de atenção:** ver API_NOTES.md (auditoria do app, visibilidade de posts, escopos).

## Instagram — `MOCK`

- **Contrato:** `SocialProvider`.
- **Hoje:** `InstagramProvider extends MockSocialProvider`.
- **Plano (Fase 3):** app na Meta for Developers; OAuth no Rust; Instagram Graph API para contas
  profissionais (Business/Creator); publicação de Reels por container + publish; insights para analytics.
- **Pontos de atenção:** exigência de conta profissional; forma de envio do vídeo (URL pública vs. upload
  resumável) impacta o modelo local-first — ver API_NOTES.md.

## OpenAI — `MOCK`

- **Contrato:** `AIProvider.generateCaptions(request)` → variações de legenda + hashtags.
- **Hoje:** `MockAIProvider` — modelos de texto locais (3 idiomas × 4 tons) + `extractHashtags` (sem IA).
- **Plano (Fase 3):** `OpenAIProvider` cuja chamada HTTP é feita por um comando Rust; chave de API no Credential
  Manager (configurada na tela IA); registrar execuções em `ai_executions` (sem dados sensíveis); limites de custo.
- **Usos futuros:** tradução de legendas, sugestão de hashtags por canal, classificação de conteúdo.

## FFmpeg — `NOT_STARTED`

- **Contrato:** `VideoProcessor` (`getStatus`, `generateThumbnail`, `adaptForPlatform`, `applyWatermark`).
- **Hoje:** `getStatus` funciona (comando Rust `detect_ffmpeg` executa `ffmpeg -version` do PATH, sem janela de
  console); as demais operações retornam `NOT_AVAILABLE`.
- **Plano (Fase 2):**
  1. `ffprobe` para metadados (substitui a leitura via `<video>` — DEC-017).
  2. Miniaturas em pasta do app; preencher `media.thumbnail_path`.
  3. Jobs assíncronos no Rust com progresso (`media_processing_jobs`).
  4. Presets: TikTok/Reels 9:16, compressão, watermark por canal.
- **Regras:** argumentos montados no Rust a partir de presets fixos — nunca de texto livre do usuário;
  caminhos validados; saídas sempre na pasta do app.
- **Instalação sugerida:** `winget install Gyan.FFmpeg`.
