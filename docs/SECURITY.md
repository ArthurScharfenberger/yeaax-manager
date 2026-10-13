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
- O `client_key` do TikTok é público (vai na URL de autorização) e é servido por `GET /auth/tiktok/config`.
- A chave da OpenAI é do usuário e é lida **apenas pelo lado Rust** (DEC-022).
- Chaves configuradas pelo usuário (hoje: API key da OpenAI) vão para o **Gerenciador de Credenciais do
  Windows** (`keyring-core` + `windows-native-keyring-store`, serviço `com.socialmanager.desktop`), nunca para o
  SQLite ou arquivos de configuração em texto plano (DEC-022).
- Comandos de segredo: `secret_set`, `secret_has`, `secret_delete` — só aceitam nomes de uma lista fixa no Rust
  e **não existe comando que leia o valor**. A chave só é usada dentro do Rust por `ai_chat_completion`, que fala
  com um endpoint fixo (`api.openai.com/v1/chat/completions`) e nunca ecoa a resposta de erro 401.
- A interface mostra apenas "configurada / não configurada"; o campo de chave é `password` e é limpo após salvar.

## Tokens e OAuth (DEC-024)

- Fluxo executado no **Rust**: abre o navegador padrão do sistema; o TikTok redireciona para o callback HTTPS
  `https://api.yeaax.xyz/auth/tiktok/callback`, que só **repassa** `code` e `state` para o listener loopback
  `http://127.0.0.1:<porta>` do desktop. O Rust valida o `state` (aleatório, CSPRNG, de uso único) e troca o `code`
  pelo backend. O listener aceita uma única requisição e expira em poucos minutos.
- O callback só redireciona para host fixo `127.0.0.1` e porta numérica 1024–65535 tirada do `state` — nunca para
  URL arbitrária (sem open redirect).
- Access/refresh tokens: **somente** no Credential Manager do Windows, um item por conta
  (`tiktok_token:<open_id>`, JSON com tokens, expirações e escopos). O banco guarda apenas status e metadados
  públicos (open_id, @, nome, avatar). Nenhum comando devolve tokens ao webview.
- O backend **não guarda** tokens, codes nem logs com eles; devolve os tokens na resposta HTTPS ao Rust e esquece.
- O frontend **nunca recebe tokens nem o `code`**: `SocialProvider.connect()` devolve só o perfil.
- Refresh token rotativo: o novo substitui o anterior antes de qualquer outra ação. Refresh falhou → canal
  `expired`; nunca re-tentar autenticação de forma automática e silenciosa em loop.
- Proibido: scraping, automação de navegador, captura de cookies, endpoints não oficiais, burla de autenticação.

## Backend mínimo (`backend/`, DEC-023)

- Sem banco, sem sessão, sem estado; HTTPS obrigatório (Vercel). Só o processo Rust chama o backend (CORS
  fechado: o webview não chama `api.yeaax.xyz`).
- Entradas validadas com Zod; respostas de erro genéricas (sem ecoar o corpo do TikTok nem o secret).
- Logs sem tokens, codes, secrets ou corpo de requisições; nunca logar `Authorization`.
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

| Item                                           | Motivo                                                                    |
| ---------------------------------------------- | ------------------------------------------------------------------------- |
| `dialog:allow-open`                            | seletor de vídeos na importação                                           |
| `log:allow-log`                                | gravar no arquivo de log as entradas do logger do frontend (já redigidas) |
| `sql:allow-execute`                            | escrita no banco local                                                    |
| `assetProtocol.enable`                         | preview/metadados de vídeos autorizados individualmente                   |
| `assetProtocol.scope: $APPDATA/thumbnails/*`   | exibir miniaturas geradas pelo app (DEC-018)                              |
| comandos `save_thumbnail` / `delete_thumbnail` | gravar/remover miniaturas na pasta do app                                 |
| `dragDropEnabled: false`                       | permite drag-and-drop HTML5 no calendário (DEC-010)                       |
| listener loopback `127.0.0.1` (planejado)      | receber o `code` repassado pelo callback OAuth; porta aleatória, 1 uso    |
