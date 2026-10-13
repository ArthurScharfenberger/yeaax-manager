//! Cliente do backend mínimo `api.yeaax.xyz` (DEC-023/027): configuração pública e troca, renovação e
//! revogação de tokens. O `client_secret` existe só no backend; este módulo nunca o vê.
//!
//! Nenhuma função registra tokens, codes ou verifiers. As mensagens de erro são fixas.

use std::sync::LazyLock;
use std::time::Duration;

use serde::Deserialize;
use serde_json::json;

use super::loopback::{CALLBACK_PATH, LOOPBACK_HOST};
use super::secret::Secret;
use crate::error::{CommandError, CommandResult};

const PRODUCTION_BASE_URL: &str = "https://api.yeaax.xyz";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(20);
const MAX_TOKEN_LENGTH: usize = 4096;

static CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .unwrap_or_default()
});

/// URL base do backend. Em builds de desenvolvimento pode apontar para um backend local via
/// `YEAAX_API_BASE_URL` (só `https://` ou `http://127.0.0.1`/`localhost`); em release é sempre a produção.
fn base_url() -> String {
    #[cfg(debug_assertions)]
    if let Ok(value) = std::env::var("YEAAX_API_BASE_URL") {
        let value = value.trim().trim_end_matches('/');
        let allowed = value.starts_with("https://")
            || value.starts_with("http://127.0.0.1:")
            || value.starts_with("http://localhost:");
        if allowed {
            return value.to_owned();
        }
    }
    PRODUCTION_BASE_URL.to_owned()
}

/// Dados públicos de `GET /config` usados para montar a URL de autorização.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct PublicConfig {
    pub client_key: String,
    pub scopes: Vec<String>,
}

/// Tokens devolvidos pelo backend. Sem `Debug` derivado: a implementação manual não mostra os valores.
pub struct TokenSet {
    pub open_id: String,
    pub scopes: Vec<String>,
    pub access_token: Secret,
    pub expires_in: u64,
    pub refresh_token: Secret,
    pub refresh_expires_in: u64,
}

impl std::fmt::Debug for TokenSet {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("TokenSet")
            .field("open_id", &self.open_id)
            .field("scopes", &self.scopes)
            .field("expires_in", &self.expires_in)
            .field("refresh_expires_in", &self.refresh_expires_in)
            .finish_non_exhaustive()
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ConfigResponse {
    tiktok: TikTokConfigResponse,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TikTokConfigResponse {
    client_key: String,
    scopes: Vec<String>,
    redirect: RedirectResponse,
    pkce: PkceResponse,
}

#[derive(Deserialize)]
struct RedirectResponse {
    host: String,
    path: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PkceResponse {
    method: String,
    challenge_encoding: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TokenResponse {
    open_id: String,
    scopes: Vec<String>,
    access_token: String,
    expires_in: u64,
    refresh_token: String,
    refresh_expires_in: u64,
}

#[derive(Deserialize)]
struct ErrorEnvelope {
    error: ErrorBody,
}

#[derive(Deserialize)]
struct ErrorBody {
    code: String,
}

fn invalid_response() -> CommandError {
    CommandError::new(
        "TIKTOK_ERROR",
        "Resposta inesperada do servidor do Yeaax Manager.",
    )
}

pub(crate) fn is_valid_scope(scope: &str) -> bool {
    !scope.is_empty()
        && scope.len() <= 64
        && scope
            .bytes()
            .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'.')
}

pub(crate) fn is_valid_open_id(open_id: &str) -> bool {
    (1..=128).contains(&open_id.len())
        && open_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
}

fn is_valid_token(token: &str) -> bool {
    !token.is_empty()
        && token.len() <= MAX_TOKEN_LENGTH
        && token.bytes().all(|byte| (0x21..=0x7e).contains(&byte))
}

fn parse_config(body: &str) -> CommandResult<PublicConfig> {
    let parsed: ConfigResponse = serde_json::from_str(body).map_err(|_| invalid_response())?;
    let tiktok = parsed.tiktok;
    let key_ok = (4..=128).contains(&tiktok.client_key.len())
        && tiktok
            .client_key
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'));
    // O backend e o desktop precisam concordar com o redirect e o PKCE (peculiaridade hex do TikTok).
    let consistent = tiktok.redirect.host == LOOPBACK_HOST
        && tiktok.redirect.path == CALLBACK_PATH
        && tiktok.pkce.method == "S256"
        && tiktok.pkce.challenge_encoding == "hex";
    let scopes_ok = !tiktok.scopes.is_empty()
        && tiktok.scopes.iter().all(|scope| is_valid_scope(scope))
        && tiktok.scopes.iter().any(|scope| scope == "user.info.basic");
    if !key_ok || !consistent || !scopes_ok {
        return Err(invalid_response());
    }
    Ok(PublicConfig {
        client_key: tiktok.client_key,
        scopes: tiktok.scopes,
    })
}

fn parse_tokens(body: &str) -> CommandResult<TokenSet> {
    let parsed: TokenResponse = serde_json::from_str(body).map_err(|_| invalid_response())?;
    let valid = is_valid_open_id(&parsed.open_id)
        && is_valid_token(&parsed.access_token)
        && is_valid_token(&parsed.refresh_token)
        && parsed.expires_in > 0
        && parsed.refresh_expires_in > 0
        && parsed.scopes.iter().all(|scope| is_valid_scope(scope));
    if !valid {
        return Err(invalid_response());
    }
    Ok(TokenSet {
        open_id: parsed.open_id,
        scopes: parsed.scopes,
        access_token: Secret::new(parsed.access_token),
        expires_in: parsed.expires_in,
        refresh_token: Secret::new(parsed.refresh_token),
        refresh_expires_in: parsed.refresh_expires_in,
    })
}

/// Converte o erro padronizado do backend (`{ error: { code } }`) em mensagens fixas para o usuário.
fn map_backend_error(status: u16, body: &str) -> CommandError {
    let code = serde_json::from_str::<ErrorEnvelope>(body)
        .map(|envelope| envelope.error.code)
        .unwrap_or_default();
    match code.as_str() {
        "INVALID_GRANT" => CommandError::new(
            "TIKTOK_AUTH_EXPIRED",
            "A autorização do TikTok expirou ou foi revogada. Conecte a conta novamente.",
        ),
        "RATE_LIMITED" | "UPSTREAM_RATE_LIMITED" => CommandError::new(
            "TIKTOK_RATE_LIMIT",
            "Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.",
        ),
        "NOT_CONFIGURED" => CommandError::new(
            "TIKTOK_NOT_CONFIGURED",
            "O servidor do Yeaax Manager ainda não está configurado para o TikTok.",
        ),
        "UPSTREAM_UNAVAILABLE" => CommandError::new(
            "TIKTOK_UNAVAILABLE",
            "O TikTok está indisponível no momento. Tente novamente em instantes.",
        ),
        _ if status >= 500 => CommandError::new(
            "TIKTOK_UNAVAILABLE",
            "O servidor do Yeaax Manager está indisponível no momento.",
        ),
        _ => CommandError::new("TIKTOK_ERROR", "O TikTok recusou a solicitação."),
    }
}

fn network_error(error: &reqwest::Error) -> CommandError {
    let message = if error.is_timeout() {
        "O servidor do Yeaax Manager demorou demais para responder."
    } else {
        "Não foi possível falar com o servidor do Yeaax Manager. Verifique a internet."
    };
    CommandError::new("TIKTOK_UNAVAILABLE", message)
}

async fn read_response(response: reqwest::Response) -> CommandResult<String> {
    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|error| network_error(&error))?;
    if status.is_success() {
        Ok(body)
    } else {
        Err(map_backend_error(status.as_u16(), &body))
    }
}

async fn post(path: &str, payload: serde_json::Value) -> CommandResult<String> {
    let response = CLIENT
        .post(format!("{}{path}", base_url()))
        .json(&payload)
        .send()
        .await
        .map_err(|error| network_error(&error))?;
    read_response(response).await
}

pub async fn fetch_config() -> CommandResult<PublicConfig> {
    let response = CLIENT
        .get(format!("{}/config", base_url()))
        .send()
        .await
        .map_err(|error| network_error(&error))?;
    parse_config(&read_response(response).await?)
}

/// `POST /auth/tiktok/token` com o code do loopback, o verifier do PKCE e a redirect URI usada.
pub async fn exchange_code(
    code: &Secret,
    code_verifier: &Secret,
    redirect_uri: &str,
) -> CommandResult<TokenSet> {
    let body = post(
        "/auth/tiktok/token",
        json!({
            "code": code.expose(),
            "codeVerifier": code_verifier.expose(),
            "redirectUri": redirect_uri,
        }),
    )
    .await?;
    parse_tokens(&body)
}

pub async fn refresh(refresh_token: &Secret) -> CommandResult<TokenSet> {
    let body = post(
        "/auth/tiktok/refresh",
        json!({ "refreshToken": refresh_token.expose() }),
    )
    .await?;
    parse_tokens(&body)
}

pub async fn revoke(access_token: &Secret) -> CommandResult<()> {
    post(
        "/auth/tiktok/revoke",
        json!({ "accessToken": access_token.expose() }),
    )
    .await
    .map(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;

    const CONFIG: &str = r#"{"tiktok":{"clientKey":"awtestkey","authorizeUrl":"https://www.tiktok.com/v2/auth/authorize/",
        "scopes":["user.info.basic","user.info.profile"],
        "redirect":{"registered":"http://127.0.0.1:*/tiktok/callback","host":"127.0.0.1","path":"/tiktok/callback"},
        "pkce":{"method":"S256","challengeEncoding":"hex"}}}"#;

    #[test]
    fn le_a_configuracao_publica_e_confere_redirect_e_pkce() {
        assert_eq!(
            parse_config(CONFIG).unwrap(),
            PublicConfig {
                client_key: "awtestkey".into(),
                scopes: vec!["user.info.basic".into(), "user.info.profile".into()],
            }
        );
        for broken in [
            CONFIG.replace("\"hex\"", "\"base64url\""),
            CONFIG.replace("\"/tiktok/callback\"}", "\"/outro\"}"),
            CONFIG.replace("\"host\":\"127.0.0.1\"", "\"host\":\"localhost\""),
            CONFIG.replace("awtestkey", "chave com espaço"),
            CONFIG.replace("\"user.info.basic\",", ""),
            "{}".to_owned(),
        ] {
            assert_eq!(parse_config(&broken).unwrap_err().code, "TIKTOK_ERROR");
        }
    }

    #[test]
    fn valida_os_tokens_recebidos() {
        let body = r#"{"openId":"-000abc.X_1","scopes":["user.info.basic"],"accessToken":"act.123",
            "expiresIn":86400,"refreshToken":"rft.456","refreshExpiresIn":31536000,"tokenType":"Bearer"}"#;
        let tokens = parse_tokens(body).unwrap();
        assert_eq!(tokens.open_id, "-000abc.X_1");
        assert_eq!(tokens.access_token.expose(), "act.123");
        assert!(parse_tokens(&body.replace("act.123", "")).is_err());
        assert!(parse_tokens(&body.replace("act.123", "a b")).is_err());
        assert!(parse_tokens(&body.replace("86400", "0")).is_err());
        assert!(parse_tokens(&body.replace("-000abc.X_1", "../x")).is_err());
    }

    #[test]
    fn debug_dos_tokens_nao_mostra_valores() {
        let body = r#"{"openId":"open","scopes":[],"accessToken":"act.SEGREDO","expiresIn":1,
            "refreshToken":"rft.SEGREDO","refreshExpiresIn":1}"#;
        let printed = format!("{:?}", parse_tokens(body).unwrap());
        assert!(!printed.contains("SEGREDO"), "{printed}");
    }

    #[test]
    fn normaliza_erros_do_backend_com_mensagens_fixas() {
        let case = |status, code: &str| {
            map_backend_error(
                status,
                &format!(r#"{{"error":{{"code":"{code}","message":"x"}}}}"#),
            )
            .code
        };
        assert_eq!(case(400, "INVALID_GRANT"), "TIKTOK_AUTH_EXPIRED");
        assert_eq!(case(429, "RATE_LIMITED"), "TIKTOK_RATE_LIMIT");
        assert_eq!(case(429, "UPSTREAM_RATE_LIMITED"), "TIKTOK_RATE_LIMIT");
        assert_eq!(case(503, "NOT_CONFIGURED"), "TIKTOK_NOT_CONFIGURED");
        assert_eq!(case(503, "UPSTREAM_UNAVAILABLE"), "TIKTOK_UNAVAILABLE");
        assert_eq!(case(400, "INVALID_INPUT"), "TIKTOK_ERROR");
        assert_eq!(map_backend_error(502, "<html>").code, "TIKTOK_UNAVAILABLE");
        // A mensagem do backend nunca é repassada.
        let error = map_backend_error(400, r#"{"error":{"code":"X","message":"act.vazado"}}"#);
        assert!(!error.message.contains("vazado"));
    }

    #[test]
    fn producao_usa_https_do_dominio_oficial() {
        assert_eq!(PRODUCTION_BASE_URL, "https://api.yeaax.xyz");
    }
}
