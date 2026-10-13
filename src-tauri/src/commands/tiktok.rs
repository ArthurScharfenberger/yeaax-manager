//! Comandos do TikTok (Login Kit Desktop + PKCE — DEC-027).
//!
//! Nenhum comando devolve `access_token`, `refresh_token`, `code`, `code_verifier` ou `state`: o webview recebe só
//! dados públicos da conta e um id opaco de conexão pendente. A conexão é confirmada em duas fases
//! (`tiktok_connect` → banco no frontend → `tiktok_commit_connection`) para nunca deixar credenciais gravadas
//! sem o canal correspondente.

use std::sync::{LazyLock, Mutex, PoisonError};
use std::time::Instant;

use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_log::log;
use tauri_plugin_opener::OpenerExt;
use tokio::sync::oneshot;

use crate::error::{CommandError, CommandResult};
use crate::tiktok::api::{self, TikTokProfile};
use crate::tiktok::backend::{self, PublicConfig};
use crate::tiktok::listener::{CallbackListener, LOGIN_TIMEOUT};
use crate::tiktok::loopback::CallbackOutcome;
use crate::tiktok::pending::{PendingConnection, PendingRegistry};
use crate::tiktok::pkce;
use crate::tiktok::secret::Secret;
use crate::tiktok::tokens::{self, now_seconds, StoredTokens};

const AUTHORIZE_URL: &str = "https://www.tiktok.com/v2/auth/authorize/";

/// Dados públicos da conta enviados ao frontend.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TikTokAccount {
    open_id: String,
    username: Option<String>,
    display_name: String,
    avatar_url: Option<String>,
    scopes: Vec<String>,
}

impl TikTokAccount {
    fn new(profile: TikTokProfile, scopes: Vec<String>) -> Self {
        Self {
            open_id: profile.open_id,
            username: profile.username,
            display_name: profile.display_name,
            avatar_url: profile.avatar_url,
            scopes,
        }
    }
}

/// Resultado de `tiktok_connect`: id opaco (não é credencial do TikTok; vale 5 min, uma vez) + conta.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PendingConnectionView {
    connection_id: String,
    account: TikTokAccount,
}

static PENDING: LazyLock<Mutex<PendingRegistry>> = LazyLock::new(Mutex::default);

/// Login em andamento (no máximo um). Um novo login ou `tiktok_cancel_connect` encerra o anterior.
static ACTIVE_LOGIN: Mutex<Option<(u64, oneshot::Sender<()>)>> = Mutex::new(None);
static NEXT_LOGIN_ID: Mutex<u64> = Mutex::new(0);

/// Registra o login ativo e o libera ao sair de escopo (sucesso, erro ou pânico).
struct ActiveLoginGuard(u64);

impl ActiveLoginGuard {
    fn register() -> (Self, oneshot::Receiver<()>) {
        let id = {
            let mut next = NEXT_LOGIN_ID.lock().unwrap_or_else(PoisonError::into_inner);
            *next += 1;
            *next
        };
        let (sender, receiver) = oneshot::channel();
        // Substituir o sender anterior o descarta, o que cancela o login antigo.
        *ACTIVE_LOGIN.lock().unwrap_or_else(PoisonError::into_inner) = Some((id, sender));
        (Self(id), receiver)
    }
}

impl Drop for ActiveLoginGuard {
    fn drop(&mut self) {
        let mut active = ACTIVE_LOGIN.lock().unwrap_or_else(PoisonError::into_inner);
        if active.as_ref().is_some_and(|(id, _)| *id == self.0) {
            *active = None;
        }
    }
}

fn random_error() -> CommandError {
    CommandError::new("TIKTOK_ERROR", "Falha ao gerar dados aleatórios seguros.")
}

fn denied_error(error: &str) -> CommandError {
    let message = if error == "access_denied" {
        "A autorização foi cancelada no TikTok."
    } else {
        "O TikTok não concluiu a autorização. Tente novamente."
    };
    CommandError::new("TIKTOK_DENIED", message)
}

/// URL oficial de autorização (Login Kit Desktop), em `application/x-www-form-urlencoded`.
fn build_authorize_url(
    config: &PublicConfig,
    redirect_uri: &str,
    state: &Secret,
    code_challenge: &str,
) -> CommandResult<url::Url> {
    url::Url::parse_with_params(
        AUTHORIZE_URL,
        &[
            ("client_key", config.client_key.as_str()),
            ("scope", config.scopes.join(",").as_str()),
            ("response_type", "code"),
            ("redirect_uri", redirect_uri),
            ("state", state.expose()),
            ("code_challenge", code_challenge),
            ("code_challenge_method", pkce::CHALLENGE_METHOD),
        ],
    )
    .map_err(|_| CommandError::new("TIKTOK_ERROR", "URL de autorização inválida."))
}

/// Login completo até obter tokens e perfil. Nada é gravado no cofre aqui.
#[tauri::command]
pub async fn tiktok_connect(app: AppHandle) -> CommandResult<PendingConnectionView> {
    let config = backend::fetch_config().await?;
    let verifier = Secret::new(pkce::new_code_verifier().map_err(|_| random_error())?);
    let state = Secret::new(pkce::new_state().map_err(|_| random_error())?);
    let challenge = pkce::code_challenge(verifier.expose());

    // 1. Listener aberto ANTES do navegador; a mesma porta vai na autorização e na troca do code.
    let listener = CallbackListener::bind().await?;
    let redirect_uri = listener.redirect_uri();
    let authorize_url = build_authorize_url(&config, &redirect_uri, &state, &challenge)?;
    let (_login, cancel) = ActiveLoginGuard::register();

    // 2. Navegador padrão do sistema na página oficial do TikTok.
    app.opener()
        .open_url(authorize_url.as_str(), None::<&str>)
        .map_err(|_| {
            CommandError::new(
                "TIKTOK_ERROR",
                "Não foi possível abrir o navegador para autorizar o TikTok.",
            )
        })?;
    log::info!(
        "tiktok: autorização aberta no navegador (porta local {})",
        listener.port()
    );

    // 3. Espera o callback; o listener é consumido e fecha ao retornar.
    let code = match listener.wait(&state, LOGIN_TIMEOUT, cancel).await? {
        CallbackOutcome::Authorized { code, .. } => Secret::new(code),
        CallbackOutcome::Denied { error } => {
            log::info!("tiktok: autorização não concluída ({error})");
            return Err(denied_error(&error));
        }
    };

    // 4. Troca única do code (com o verifier e a mesma redirect URI) pelo backend, que tem o secret.
    let token_set = backend::exchange_code(&code, &verifier, &redirect_uri).await?;
    drop(code);
    drop(verifier);
    if !token_set
        .scopes
        .iter()
        .any(|scope| scope == "user.info.basic")
    {
        return Err(CommandError::new(
            "TIKTOK_PROFILE",
            "O TikTok não concedeu a permissão básica de perfil.",
        ));
    }

    // 5. Perfil direto no TikTok. Se falhar, os tokens são descartados (nada foi gravado).
    let profile = api::fetch_profile(
        &token_set.access_token,
        &token_set.open_id,
        &token_set.scopes,
    )
    .await?;
    let scopes = token_set.scopes.clone();
    let stored = StoredTokens::from_token_set(token_set, now_seconds());

    // 6. Fica pendente na memória até o frontend gravar o canal e confirmar.
    let connection_id = pkce::new_state().map_err(|_| random_error())?;
    let now = Instant::now();
    PENDING
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .insert(
            connection_id.clone(),
            PendingConnection::new(stored, now),
            now,
        );
    log::info!("tiktok: autorização concluída, aguardando confirmação do canal");
    Ok(PendingConnectionView {
        connection_id,
        account: TikTokAccount::new(profile, scopes),
    })
}

/// Cancela o login em andamento (fecha o listener local).
#[tauri::command]
pub async fn tiktok_cancel_connect() -> CommandResult<()> {
    ACTIVE_LOGIN
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .take();
    Ok(())
}

/// Grava no cofre os tokens da conexão pendente, associados ao canal já salvo no banco.
#[tauri::command]
pub async fn tiktok_commit_connection(
    connection_id: String,
    channel_id: String,
) -> CommandResult<()> {
    let pending = PENDING
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .take(&connection_id, Instant::now())
        .ok_or_else(|| {
            CommandError::new(
                "TIKTOK_LOGIN_TIMEOUT",
                "A conexão com o TikTok expirou antes de ser concluída. Conecte novamente.",
            )
        })?;
    // Reconectar um canal com OUTRA conta do TikTok não pode sobrescrever as credenciais dele.
    if let Some(existing) = tokens::load(&channel_id)? {
        if existing.open_id != pending.tokens.open_id {
            return Err(CommandError::new(
                "CONFLICT",
                "Esta é outra conta do TikTok. Entre com a conta deste canal ou adicione um canal novo.",
            ));
        }
    }
    tokens::save(&channel_id, &pending.tokens)?;
    log::info!("tiktok: credenciais do canal gravadas no cofre");
    Ok(())
}

/// Descarta a conexão pendente sem gravar nada (o frontend desistiu ou falhou ao salvar o canal).
#[tauri::command]
pub async fn tiktok_discard_connection(connection_id: String) -> CommandResult<()> {
    PENDING
        .lock()
        .unwrap_or_else(PoisonError::into_inner)
        .discard(&connection_id);
    Ok(())
}

/// Perfil atual do canal, renovando o access token se necessário.
#[tauri::command]
pub async fn tiktok_get_profile(channel_id: String) -> CommandResult<TikTokAccount> {
    let stored = tokens::valid_access_token(&channel_id).await?;
    let profile = api::fetch_profile(&stored.access_token, &stored.open_id, &stored.scopes).await?;
    Ok(TikTokAccount::new(profile, stored.scopes))
}

/// Revoga (melhor esforço) e apaga as credenciais do canal.
#[tauri::command]
pub async fn tiktok_disconnect(channel_id: String) -> CommandResult<()> {
    if let Some(stored) = tokens::load(&channel_id)? {
        if let Err(error) = backend::revoke(&stored.access_token).await {
            log::warn!(
                "tiktok: revogação falhou ({}); credenciais locais apagadas mesmo assim",
                error.code
            );
        }
    }
    tokens::delete(&channel_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn monta_a_url_oficial_com_pkce_hex_e_redirect_loopback() {
        let config = PublicConfig {
            client_key: "awkey".into(),
            scopes: vec!["user.info.basic".into(), "video.publish".into()],
        };
        let challenge = pkce::code_challenge("verifier");
        let url = build_authorize_url(
            &config,
            "http://127.0.0.1:53682/tiktok/callback",
            &Secret::new("state-123"),
            &challenge,
        )
        .unwrap();
        assert_eq!(
            url.as_str().split('?').next(),
            Some("https://www.tiktok.com/v2/auth/authorize/")
        );
        let params: std::collections::HashMap<_, _> = url.query_pairs().into_owned().collect();
        assert_eq!(params["client_key"], "awkey");
        assert_eq!(params["scope"], "user.info.basic,video.publish");
        assert_eq!(params["response_type"], "code");
        assert_eq!(
            params["redirect_uri"],
            "http://127.0.0.1:53682/tiktok/callback"
        );
        assert_eq!(params["state"], "state-123");
        assert_eq!(params["code_challenge"], challenge);
        assert_eq!(params["code_challenge_method"], "S256");
        assert!(
            !url.as_str().contains("verifier"),
            "o verifier nunca vai na URL"
        );
    }

    #[test]
    fn conta_enviada_ao_frontend_nao_tem_campos_sensiveis() {
        let account = TikTokAccount::new(
            TikTokProfile {
                open_id: "open-1".into(),
                username: Some("yeaxx".into()),
                display_name: "YEAXX".into(),
                avatar_url: None,
            },
            vec!["user.info.basic".into()],
        );
        let json = serde_json::to_value(PendingConnectionView {
            connection_id: "id".into(),
            account,
        })
        .unwrap();
        let mut keys: Vec<String> = json["account"]
            .as_object()
            .unwrap()
            .keys()
            .cloned()
            .collect();
        keys.sort();
        assert_eq!(
            keys,
            ["avatarUrl", "displayName", "openId", "scopes", "username"]
        );
        let text = json.to_string().to_lowercase();
        for forbidden in ["token", "verifier", "state", "code"] {
            assert!(!text.contains(forbidden), "{forbidden} em {text}");
        }
    }

    #[test]
    fn negacao_tem_mensagem_fixa() {
        assert_eq!(denied_error("access_denied").code, "TIKTOK_DENIED");
        assert!(!denied_error("<script>").message.contains("script"));
    }
}
