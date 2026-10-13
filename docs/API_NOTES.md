# Notas sobre APIs externas

Anotações técnicas das APIs oficiais (limites, escopos, formatos, autenticação). **APIs de redes sociais
mudam com frequência:** toda nota tem data e fonte; reconfirme antes de implementar. Itens marcados como
**(não confirmado)** vieram de fontes não oficiais ou de inferência.

Formato para novas notas:

```
### <API> — <assunto>
- Data da verificação: AAAA-MM-DD · Fonte: <link oficial>
- Nota: ...
- Impacto no projeto: ...
```

---

## Resumo executivo (verificado em 2026-10-07)

| Tema                                    | TikTok                                                               | Instagram                                                                                       |
| --------------------------------------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Envio do vídeo **local** (sem hospedar) | Sim — `FILE_UPLOAD` em chunks                                        | Sim — upload resumável (`rupload.facebook.com`)                                                 |
| Login em app desktop                    | OAuth + PKCE com redirect `http://localhost:<porta>`                 | Redirect exige HTTPS **(não confirmado)**; para contas próprias, token gerado no painel da Meta |
| Segredo do app na troca de token        | Sim (`client_secret`, mesmo no desktop)                              | Sim no OAuth; **não** no refresh do token longo                                                 |
| Validade dos tokens                     | access 24 h · refresh 365 dias                                       | longo 60 dias, renovável                                                                        |
| Revisão/auditoria para uso pessoal      | **Auditoria obrigatória** para posts públicos                        | Standard Access basta para contas próprias (sem App Review)                                     |
| Tipo de conta                           | Qualquer (sem auditoria: conta precisa estar **privada**)            | **Profissional** (Business ou Creator)                                                          |
| Limite diário                           | ~15 posts/criador/24 h (varia) · rascunhos: 5 pendentes/24 h         | 100 posts publicados via API/24 h                                                               |
| Agendamento nativo                      | Não                                                                  | Não                                                                                             |
| Regra de consentimento                  | **Envio só após consentimento expresso do usuário** + UX obrigatória | Não exige UX específica                                                                         |

**Conclusão:** o modelo local-first é viável nas duas plataformas (ambas aceitam o arquivo local). O app precisa
estar aberto no horário agendado (já previsto). O maior bloqueio é a **auditoria do TikTok** para publicar posts
públicos. Ver decisões DEC-019 e DEC-020.

---

## TikTok

### Verificação de 2026-10-13 (fase TikTok real)

- Fontes: [Login Kit Web](https://developers.tiktok.com/doc/login-kit-web),
  [Login Kit Desktop](https://developers.tiktok.com/doc/login-kit-desktop),
  [Token management](https://developers.tiktok.com/doc/oauth-user-access-token-management),
  [Sandbox](https://developers.tiktok.com/doc/add-a-sandbox), [Scopes](https://developers.tiktok.com/doc/tiktok-api-scopes)
- **Redirect Web:** até 10 URIs, < 512 caracteres, absolutos, `https`, **estáticos** (sem query) e sem fragmento.
  (Não usado desde a DEC-027.)
- **Redirect Desktop (usado — DEC-027):** "Only `localhost` or loopback IP `127.0.0.1` are allowed host names";
  absoluto, `http` ou `https`, estático (sem query/fragmento), < 512 caracteres, até 10 URIs; porta obrigatória e
  "wildcard port number (\*) is supported" — recomendado para porta aleatória. Exemplos oficiais:
  `http://localhost:3455/callback/`, `http://127.0.0.1:*/callback/`. Cadastrado: `http://127.0.0.1:*/tiktok/callback`.
- **PKCE Desktop:** obrigatório; verifier de 43–128 caracteres `[A-Za-z0-9-._~]`, novo a cada autorização;
  `code_challenge_method=S256` (único aceito); **`code_challenge` = SHA-256 do verifier em hexadecimal** ("You must
  use hex encoding of SHA256"; exemplo oficial com `CryptoJS.SHA256(v).toString(CryptoJS.enc.Hex)`). O exemplo
  oficial usa `Math.random()` — não seguir: usamos o CSPRNG do sistema. O exemplo Express da página põe o verifier no
  lugar do challenge na URL — erro da página.
- **Callback Desktop:** parâmetros em `application/x-www-form-urlencoded`: `code`, `scopes`, `state` ou
  `error`/`error_description`. O `code` é decodificado uma vez antes da troca ("code (URL-decoded)").
- **Autorização:** `https://www.tiktok.com/v2/auth/authorize/` com `client_key`, `scope` (separado por vírgula),
  `response_type=code`, `redirect_uri`, `state`, `disable_auto_auth` (opcional). Callback recebe `code`, `scopes`,
  `state` ou `error`/`error_description`.
- **Token:** `POST https://open.tiktokapis.com/v2/oauth/token/` (`application/x-www-form-urlencoded`) com
  `client_key`, `client_secret`, `code` (decodificado), `grant_type=authorization_code`, `redirect_uri` (igual ao
  usado na autorização — com a porta real, não o `*`) e `code_verifier` ("required for mobile and desktop app
  only"). O secret é exigido mesmo no Desktop → backend obrigatório (DEC-023). Resposta: `open_id`, `scope`, `access_token`,
  `expires_in` (86400), `refresh_token`, `refresh_expires_in` (31536000), `token_type=Bearer`.
- **Refresh:** mesmo endpoint, `grant_type=refresh_token` + `client_secret`; se vier refresh token diferente, usar o novo.
- **Revoke:** `POST /v2/oauth/revoke/` com `client_key`, `client_secret`, `token`; corpo vazio no sucesso.
- **Sandbox:** até 5 por app, até 10 contas próprias como target users (aceitam os termos; podem levar 1 h para
  aparecer); sem App Review; **não** permite publicar vídeo público. Configuração pode ser importada para o draft
  de produção.
- **Escopos:** `user.info.basic` (open_id, avatar, nome de exibição); `user.info.profile` (link do perfil, bio,
  verificado e o `username` — **confirmar o campo** na resposta de `/v2/user/info/`); `video.publish` (Direct Post +
  status); `video.upload` (rascunho + status).
- Impacto: DEC-023 (secret no backend) e DEC-027 (Login Kit Desktop + PKCE; substituiu a DEC-024).

### Content Posting API — modos e auditoria

- Data: 2026-10-07 · Fontes: [Get started](https://developers.tiktok.com/doc/content-posting-api-get-started),
  [Content Sharing Guidelines](https://developers.tiktok.com/doc/content-sharing-guidelines)
- **Direct Post** (escopo `video.publish`): publica direto no perfil. **Upload** (escopo `video.upload`): envia
  para a caixa de entrada do TikTok; o criador termina a edição e publica no app.
- Clientes **não auditados**: no máximo 5 usuários postando por 24 h; "All user accounts using the API client to
  post must be set to private at the time of posting"; conteúdo só em `SELF_ONLY`.
- A página não distingue se essas restrições valem também para o modo Upload (rascunho) **(não confirmado —
  testar no sandbox ao criar o app)**.
- Impacto: publicar posts públicos de forma automática exige **auditar o app** no TikTok for Developers.

### Regras de UX obrigatórias (Direct Post)

- Data: 2026-10-07 · Fonte: [Content Sharing Guidelines](https://developers.tiktok.com/doc/content-sharing-guidelines)
- Antes de enviar, a tela precisa: mostrar o **nickname** do criador; ter seletor de **privacidade sem valor
  padrão** (opções vindas de `creator_info`); toggles de **comentário/dueto/stitch desmarcados** por padrão (e
  desabilitados quando o criador bloqueou); **divulgação de conteúdo comercial** desligada por padrão ("Your Brand"
  / "Branded Content"); texto de **Music Usage Confirmation**; **prévia** do conteúdo; legenda editável.
- "API Clients must only start sending content materials to TikTok after the user has expressly consent to the
  upload." Sobre agendamento: a página não trata do tema.
- O app não pode adicionar watermarks/logos **promocionais do próprio app**. (Logo do criador aplicado por escolha
  dele é conteúdo do criador — **confirmar na auditoria**.)
- Impacto: o compositor precisa de campos específicos do TikTok; o Auto Schedule não pode publicar algo que o
  usuário não confirmou post a post (DEC-019).

### Direct Post — endpoint e limites

- Data: 2026-10-07 · Fonte: [Direct Post reference](https://developers.tiktok.com/doc/content-posting-api-reference-direct-post)
- `POST /v2/post/publish/video/init/` com `post_info` (`title` até **2200 runas UTF-16**, `privacy_level`
  obrigatório: `PUBLIC_TO_EVERYONE` | `MUTUAL_FOLLOW_FRIENDS` | `FOLLOWER_OF_CREATOR` | `SELF_ONLY`;
  `disable_comment/duet/stitch`, `video_cover_timestamp_ms`, `brand_content_toggle`, `brand_organic_toggle`,
  `is_aigc`) e `source_info` (`FILE_UPLOAD`: `video_size`, `chunk_size`, `total_chunk_count`).
- Limite: **6 requisições/minuto por token de usuário**. URL de upload válida por **1 hora**.
- Antes de postar: `POST /v2/post/publish/creator_info/query/` (nickname, avatar, `privacy_level_options`,
  `comment/duet/stitch_disabled`, `max_video_post_duration_sec`).
- Erros de cota: `spam_risk_too_many_posts`, `spam_risk_user_banned_from_posting`, `reached_active_user_cap`.
- Cota: ~15 posts por criador em 24 h (varia por criador).

### Upload (rascunho na caixa de entrada)

- Data: 2026-10-07 · Fonte: [Upload reference](https://developers.tiktok.com/doc/content-posting-api-reference-upload-video)
- `POST /v2/post/publish/inbox/video/init/`, escopo `video.upload`. O criador recebe notificação no app e finaliza.
- No máximo **5 envios pendentes em 24 h** (`spam_risk_too_many_pending_share`). 6 req/min por token.

### Requisitos de mídia e transferência

- Data: 2026-10-07 · Fonte: [Media Transfer Guide](https://developers.tiktok.com/doc/content-posting-api-media-transfer-guide)
- Formatos: MP4 (recomendado), WebM, MOV. Codecs: H.264 (recomendado), H.265, VP8, VP9.
- Resolução: 360 a 4096 px (altura e largura). FPS: 23–60. Tamanho: até 4 GB.
- Duração: até 10 min pela API; o limite real é por criador (`max_video_post_duration_sec`: 3, 5 ou 10 min).
- Chunks: 5–64 MB (o último pode ter até 128 MB), 1–1000 chunks, **envio sequencial**; vídeos < 5 MB em chunk único.
- `PULL_FROM_URL` exige domínio/prefixo verificado e HTTPS (não necessário para nós).

### Login Kit para desktop e tokens

- Data: 2026-10-07 · Fontes: [Login Kit Desktop](https://developers.tiktok.com/doc/login-kit-desktop),
  [Token management](https://developers.tiktok.com/doc/oauth-user-access-token-management)
- Autorização: `https://www.tiktok.com/v2/auth/authorize/` com **PKCE obrigatório (S256)**.
- Redirect: "Only `localhost` or loopback IP `127.0.0.1` are allowed host names in URI", porta obrigatória.
- Troca de código: `POST https://open.tiktokapis.com/v2/oauth/token/` com `client_key`, **`client_secret`**,
  `code`, `redirect_uri` e `code_verifier`.
- `access_token` válido por **24 h**; `refresh_token` por **365 dias** — o refresh pode devolver um refresh_token
  novo, que deve substituir o anterior. Revogação: `POST /v2/oauth/revoke/`.
- Impacto: fluxo totalmente viável no Rust (servidor loopback + PKCE). O `client_secret` precisa ficar no lado
  nativo (Credential Manager) — DEC-020.

---

## Instagram (Instagram Platform)

### Publicação de Reels

- Data: 2026-10-07 · Fonte: [Content publishing](https://developers.facebook.com/docs/instagram-platform/content-publishing)
- Apenas **contas profissionais** (Business ou Creator).
- Fluxo: `POST /<IG_ID>/media` (`media_type=REELS`, `upload_type=resumable`) → upload dos bytes para
  `rupload.facebook.com/ig-api-upload/<CONTAINER_ID>` (headers `offset`, `file_size`) → consultar
  `GET /<CONTAINER_ID>?fields=status_code` (`IN_PROGRESS`/`FINISHED`/`ERROR`/`EXPIRED`/`PUBLISHED`), "once per
  minute, for no more than 5 minutes" → `POST /<IG_ID>/media_publish` com `creation_id`.
- Também aceita `video_url` público — **não necessário**: o upload resumável aceita o arquivo local.
- Limite: **100 posts publicados via API por 24 h** (janela móvel); consultar `GET /<IG_ID>/content_publishing_limit`.
- Sem agendamento nativo: publica no momento do `media_publish`.
- Permissões (Instagram Login): `instagram_business_basic`, `instagram_business_content_publish`.

### Especificações de Reels

- Data: 2026-10-07 · Fonte: [IG User Media reference](https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/media)
- Contêiner MOV ou MP4, sem edit lists, **moov atom no início** (faststart). Vídeo HEVC ou H.264, progressivo,
  GOP fechado, 4:2:0. FPS 23–60. Largura máx. 1920 px; proporção recomendada **9:16**.
- Duração **3 s a 15 min**. Tamanho **até 300 MB**. Áudio AAC, até 48 kHz, mono/estéreo, 128 kbps. Bitrate até 25 Mbps.
- Capa: `cover_url` ou `thumb_offset` (ms). `share_to_feed`: aparece também no feed.
- Legenda: "Maximum 2200 characters, 30 hashtags, and 20 @ tags."
- Impacto: validar duração/tamanho/resolução antes de agendar; a Fase 2 (FFmpeg) corrige faststart/codec/tamanho.

### Autenticação

- Data: 2026-10-07 · Fontes: [Business Login](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/business-login),
  [Refresh token](https://developers.facebook.com/docs/instagram-platform/reference/refresh_access_token),
  [Criar app (passo 7)](https://developers.facebook.com/documentation/development/create-an-app/other-app-types/instagram-apis.md)
- OAuth: `https://www.instagram.com/oauth/authorize`; troca em `https://api.instagram.com/oauth/access_token` com
  **`client_secret`**. Token curto: 1 h; token longo: **60 dias**.
- Refresh: `GET https://graph.instagram.com/refresh_access_token?grant_type=ig_refresh_token&access_token=…` —
  **sem app secret**; o token precisa ter ≥ 24 h e estar válido; renova por mais 60 dias.
- Acesso: "Standard Access if your app serves Instagram professional accounts you own or manage and have added
  to your app in the App Dashboard" — **sem App Review** para uso pessoal.
- O painel do app permite adicionar a conta e **gerar o token** (passo 7 do guia; a conta precisa ser pública).
  Duração do token gerado no painel **(não confirmado — provável token longo de 60 dias)**.
- Redirect URI exige HTTPS, inclusive em localhost **(não confirmado — fontes não oficiais)**.
- Impacto: para contas próprias, o caminho mais simples é colar o token gerado no painel e o app renová-lo
  automaticamente antes de 60 dias — sem servidor HTTPS local e sem guardar o app secret (DEC-020).

---

## OpenAI

- Pendente: modelo, limites de tokens/custo, política de dados; definir teto de gasto mensal.

## Pendências de verificação

- [ ] TikTok: restrições de app não auditado valem para o modo Upload (rascunho)? Testar no sandbox.
- [ ] TikTok: nome exato do campo do @ (`username`) em `/v2/user/info/` com `user.info.profile`.
- [ ] TikTok: requisitos e prazo da auditoria para um app pessoal (URLs de termos/privacidade, vídeo de demonstração).
- [ ] TikTok: aplicar o logo do próprio criador (FFmpeg) é aceito pelas diretrizes?
- [ ] Instagram: validade do token gerado no painel e confirmação oficial da exigência de HTTPS no redirect.
- [ ] Instagram: confirmar que as contas usadas são profissionais (Business/Creator).
