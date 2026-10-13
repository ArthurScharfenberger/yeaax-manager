# Segurança

Mesmo sendo um app pessoal, ele vai lidar com contas reais, tokens de acesso e arquivos do usuário.
Estas políticas valem desde já; a arquitetura foi desenhada para cumpri-las quando as integrações forem reais.

## Segredos e credenciais

- **Segredos nunca entram no repositório.** `.env`, `*.pem`, `*.key`, `credentials*.json`, `tokens*.json`
  estão no `.gitignore`. Use `.env.example` (valores vazios) como referência.
- **Nunca use o prefixo `VITE_` em segredos.** Variáveis `VITE_*` são embutidas no bundle do frontend e ficam
  visíveis para qualquer um. O Vite só expõe `VITE_*` e `TAURI_ENV_*` (`vite.config.ts → envPrefix`).
- **Client secrets das plataformas (TikTok; Instagram no futuro) ficam só no backend mínimo**, como variáveis de
  ambiente secretas da Vercel (DEC-023). Nunca no app desktop, no bundle, no banco, no `.env` da raiz ou em
  `VITE_*`. `backend/.env.example` lista os nomes com valores vazios.
- O `client_key` do TikTok é público (vai na URL de autorização) e é servido por `GET /config`.
- A chave da OpenAI é do usuário e é lida **apenas pelo lado Rust** (DEC-022).
- Chaves configuradas pelo usuário (hoje: API key da OpenAI) vão para o **Gerenciador de Credenciais do
  Windows** (`keyring-core` + `windows-native-keyring-store`, serviço `com.socialmanager.desktop`), nunca para o
  SQLite ou arquivos de configuração em texto plano (DEC-022).
- Comandos de segredo: `secret_set`, `secret_has`, `secret_delete` — só aceitam nomes de uma lista fixa no Rust
  e **não existe comando que leia o valor**. A chave só é usada dentro do Rust por `ai_chat_completion`, que fala
  com um endpoint fixo (`api.openai.com/v1/chat/completions`) e nunca ecoa a resposta de erro 401.
- A interface mostra apenas "configurada / não configurada"; o campo de chave é `password` e é limpo após salvar.

## Tokens e OAuth (Login Kit Desktop + PKCE — DEC-027)

- Fluxo no **Rust**, sem passar pelo backend no redirect: o desktop gera `state` e `code_verifier` novos a cada
  login (CSPRNG do sistema; 43 e 64 caracteres), calcula `code_challenge` (SHA-256 em **hex**, exigência do
  TikTok), abre um listener em `127.0.0.1` numa porta escolhida pelo sistema e abre o navegador padrão na
  autorização oficial. O TikTok redireciona **direto** para `http://127.0.0.1:<porta>/tiktok/callback`.
- **Listener loopback** (`src-tauri/src/tiktok/loopback.rs`): bind só em `127.0.0.1` (nunca `0.0.0.0` nem
  `localhost`); aceita só `GET` no caminho exato `/tiktok/callback`; exige `Host: 127.0.0.1:<porta>` (bloqueia DNS
  rebinding); recusa parâmetros repetidos e cabeçalhos > 8 KB; confere o `state` em tempo constante **antes** de
  olhar `code`/`error`; descarta `error_description`; encerra no primeiro callback válido ou em 5 min (uso único).
- **Troca do code:** o Rust envia `code` + `code_verifier` + a redirect URI usada ao backend
  (`POST /auth/tiktok/token`), que acrescenta o `client_secret`. O code é trocado uma única vez, imediatamente.
  O backend só aceita redirect URI no formato `http://127.0.0.1:<1024–65535>/tiktok/callback` e exige PKCE.
- `state`, `code_verifier` e `code` ficam só na memória da tentativa de login e **nunca** vão para logs, banco ou
  webview.
- Access/refresh tokens: **somente** no Credential Manager do Windows, um item por canal
  (`tiktok_token:<channel_id>`, JSON com open_id, tokens, expirações e escopos). Os comandos `secret_*` do webview
  não alcançam esses itens (lista fixa); só `src-tauri/src/tiktok/tokens.rs` os lê e grava. O banco guarda apenas
  status e metadados públicos (@, nome, avatar). Nenhum comando devolve tokens ao webview.
- **Conexão transacional:** `tiktok_connect` não grava nada — deixa tokens e perfil pendentes na memória do Rust
  (id opaco, uso único, 5 min) e devolve só dados públicos. O canal é gravado no banco e então
  `tiktok_commit_connection` grava no cofre; reconectar com outra conta é recusado. Falhou → banco desfeito e
  conexão descartada. O id pendente não é credencial do TikTok e só existe dentro do processo do app.
- No Rust, valores sensíveis ficam no tipo `Secret` (sem `Display`/`Serialize`; `Debug` mostra `[redacted]`), e
  as structs de tokens têm `Debug` manual sem os valores (testado). Os logs registram só porta local, códigos de
  erro normalizados e eventos. Bibliotecas de rede, TLS e cofre (`reqwest`, `hyper*`, `h2`, `rustls`,
  `keyring_core`) ficam em WARN no log. Verificado no teste real: nenhum token, code ou verifier no arquivo de log.
- Itens do cofre são gravados com persistência **Local** (`CRED_PERSIST_LOCAL_MACHINE`): ficam só neste
  computador. O padrão da biblioteca (`Enterprise`) acompanharia perfis móveis de domínio para outras máquinas.
  Itens antigos mudam na próxima gravação (reconectar a conta ou salvar a chave da OpenAI de novo).
- O backend **não guarda** tokens, codes nem logs com eles; devolve os tokens na resposta HTTPS ao Rust e esquece.
- O frontend **nunca recebe tokens nem o `code`**: `SocialProvider.connect()` devolve só o perfil.
- Refresh token rotativo: o novo substitui o anterior antes de qualquer outra ação. Refresh falhou → canal
  `expired`; nunca re-tentar autenticação de forma automática e silenciosa em loop.
- Remover um canal de login oficial revoga e apaga a credencial do cofre antes de apagar o canal (nada órfão).
- **Publicação (DEC-030):** o caminho do vídeo vindo do webview é revalidado no Rust (absoluto, extensão aceita,
  arquivo regular, não vazio) antes do envio; o arquivo vai direto do disco para o `upload_url` HTTPS do TikTok
  (nunca pelo backend), em partes; legenda e escolhas revalidadas no Rust e contra o `creator_info`. Só há envio
  com consentimento registrado no post; providers simulados nunca marcam posts como publicados.
- Proibido: scraping, automação de navegador, captura de cookies, endpoints não oficiais, burla de autenticação.

### Divergência da recomendação do TikTok (refresh token no desktop)

O TikTok recomenda que o **servidor** guarde o client secret **e o refresh token**. Aqui o client secret fica no
servidor, mas o **refresh token fica no Credential Manager do Windows** do usuário — divergência consciente,
registrada na revisão da DEC-024 (item 6) e mantida pela DEC-027:

- **Motivo:** backend sem estado e local-first; guardar no servidor exigiria banco, contas e uma credencial do
  desktop para o backend, que também ficaria no computador do usuário.
- **Riscos:** malware rodando como o usuário pode ler o cofre; com um refresh token roubado (válido por até 365
  dias), qualquer um obtém access tokens pela rota pública `/auth/tiktok/refresh`; computador perdido sem bloqueio.
- **Mitigações:** escopos mínimos, rate limit, revogação ao desconectar, rotação do refresh token pelo TikTok,
  revogação pelo usuário nas configurações do TikTok, tokens nunca no banco/logs/webview.
- **Reavaliar** se o app tiver outros usuários além do dono ou se o backend ganhar estado (API/MCP).

## Backend mínimo (`backend/`, DEC-023/DEC-026)

- Sem banco, sem sessão, sem estado; HTTPS obrigatório (Vercel). Só o processo Rust chama as rotas `POST`.
- **CORS fechado:** nenhuma resposta tem `Access-Control-Allow-*`; rotas `POST` recusam requisições com `Origin`
  (navegadores) e exigem `Content-Type: application/json` (força preflight, que recebe `405`).
- Entradas validadas com Zod (schemas estritos, corpo até 8 KB); erros com mensagens fixas — nunca ecoam a entrada
  nem o corpo do TikTok. Erros do TikTok são normalizados (`INVALID_GRANT`, `UPSTREAM_*`).
- **Rate limit** por IP em memória da instância (10–60/min por rota; melhor esforço) + regra recomendada no
  Firewall da Vercel.
- Logs JSON só com evento, método, caminho sem query, status e duração; nunca code, state, tokens, secret, IP ou
  corpo (redação por nome de campo como defesa extra; testado).
- Não há rota pública de callback (DEC-027): o redirect do OAuth vai direto ao loopback do desktop.
- Segredos só nas variáveis de ambiente do projeto Vercel; rotacionar o `client_secret` no portal do TikTok se
  houver suspeita de vazamento.
- O vídeo nunca passa pelo backend.

## Logs

- Use sempre `logger` (`src/lib/logger.ts`); `console.*` é bloqueado pelo lint.
- O logger **redige automaticamente** chaves com `token`, `secret`, `password`, `authorization`, `api_key`,
  `cookie`, `credential` e valores `Bearer …`. Ainda assim: não passe payloads de autenticação ao logger.
- Erros do Rust (`CommandError`) não incluem conteúdo de arquivos nem segredos.
- Logs vão para a memória (Configurações → Sobre) e, no desktop, para arquivos em
  `%LOCALAPPDATA%\com.socialmanager.desktop\logs\` (5 MB por arquivo, 5 mantidos). A redação acontece
  antes de qualquer destino (`logger.addSink`). Nunca versione nem compartilhe logs sem revisar.

## Armazenamento local

- Banco em `%APPDATA%\com.socialmanager.desktop\` — protegido pelas permissões do usuário do Windows.
  Contém dados pessoais (legendas, agendas, caminhos): nunca versionar (`*.db` no `.gitignore`).
- Vídeos não são copiados (DEC-006). Remover da biblioteca **nunca** apaga o arquivo original.
- Arquivos gerados pelo app (miniaturas, versões processadas) ficarão em subpastas do diretório do app.

## Arquivos e caminhos

- Caminhos chegam do diálogo nativo, mas são **revalidados no Rust** (`inspect_media_file`): absoluto,
  arquivo regular existente, extensão permitida (`mp4`, `mov`, `webm`), tamanho > 0.
- Asset protocol com escopo estático **apenas** para `$APPDATA/thumbnails/*` (arquivos gerados pelo app);
  vídeos do usuário são autorizados um a um, na sessão, depois de validados (DEC-016).
- `save_thumbnail`/`delete_thumbnail` nunca recebem caminhos do webview: o nome do arquivo deriva do id da
  mídia (validado: só letras, números e hífen), o conteúdo precisa ser JPEG e ter até 2 MB.
- Processos externos (FFmpeg) recebem argumentos montados no Rust a partir de valores fixos/validados,
  nunca de texto livre; executados sem shell e sem janela de console.

## Superfície do Tauri

- Permissões mínimas em `src-tauri/capabilities/default.json`: `core:default`, `dialog:allow-open`,
  `log:allow-log`, `sql:allow-load|select|execute|close`. **Toda nova permissão deve ser justificada aqui.**
- CSP restritiva em `tauri.conf.json` (`default-src 'self'`; IPC, `asset:` para imagens/vídeos locais;
  `style-src 'unsafe-inline'` por causa de estilos inline do React).
- Comandos customizados validam toda entrada vinda do webview.

## Dados externos

- Toda resposta de API (e do lado Rust) é **não confiável**: validar com Zod antes de usar (exemplo:
  `tauriDesktopBridge.ts`). URLs externas (avatar) só são exibidas como imagem.
- Conteúdo de legendas é tratado como texto (React escapa por padrão); nunca usar `dangerouslySetInnerHTML`.

## Dependências

- Adicionar dependência só com necessidade real, preferindo pacotes mantidos e populares; registrar em DECISIONS.md.
- `npm audit` e `cargo audit` (quando instalado) antes de cada versão.

## Justificativas de permissões e exceções

| Item                                                             | Motivo                                                                                                                              |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `dialog:allow-open`                                              | seletor de vídeos na importação                                                                                                     |
| `log:allow-log`                                                  | gravar no arquivo de log as entradas do logger do frontend (já redigidas)                                                           |
| `sql:allow-execute`                                              | escrita no banco local                                                                                                              |
| `assetProtocol.enable`                                           | preview/metadados de vídeos autorizados individualmente                                                                             |
| `assetProtocol.scope: $APPDATA/thumbnails/*`                     | exibir miniaturas geradas pelo app (DEC-018)                                                                                        |
| comandos `save_thumbnail` / `delete_thumbnail`                   | gravar/remover miniaturas na pasta do app                                                                                           |
| `dragDropEnabled: false`                                         | permite drag-and-drop HTML5 no calendário (DEC-010)                                                                                 |
| CSP `img-src https://*.tiktokcdn.com https://*.tiktokcdn-us.com` | avatar real da conta (DEC-028); outras origens são descartadas no provider (`safeAvatarUrl`); o CDN vê o IP, como no próprio TikTok |
| listener loopback `127.0.0.1`                                    | receber o redirect do Login Kit Desktop; porta do sistema, 1 uso, 5 min                                                             |
| plugin `opener` (sem permissão no webview)                       | o Rust abre a URL oficial de autorização no navegador padrão                                                                        |
| comando `open_tiktok_policy`                                     | abre só as 2 URLs fixas das políticas do TikTok (o webview envia a chave, nunca a URL) — DEC-029                                    |
| rede do Rust: `api.yeaax.xyz`, `open.tiktokapis.com`             | troca/refresh/revoke (backend) e perfil (TikTok); a CSP do webview não muda                                                         |
