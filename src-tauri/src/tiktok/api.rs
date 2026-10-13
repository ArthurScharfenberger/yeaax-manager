//! Chamadas diretas à API do TikTok com o token do usuário (o backend não participa).
//! Etapa 3: só o perfil (`/v2/user/info/`). A publicação de vídeo chega na etapa 6.

use std::sync::LazyLock;
use std::time::Duration;

use serde::{Deserialize, Serialize};

use super::backend::is_valid_open_id;
use super::secret::Secret;
use crate::error::{CommandError, CommandResult};

const USER_INFO_URL: &str = "https://open.tiktokapis.com/v2/user/info/";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(20);
const MAX_DISPLAY_NAME_CHARS: usize = 100;
const MAX_AVATAR_URL_LENGTH: usize = 2048;

static CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .unwrap_or_default()
});

/// Dados públicos da conta — os únicos que vão ao frontend.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TikTokProfile {
    pub open_id: String,
    pub username: Option<String>,
    pub display_name: String,
    pub avatar_url: Option<String>,
}

#[derive(Deserialize)]
struct UserInfoResponse {
    data: Option<UserInfoData>,
    error: ApiErrorBody,
}

#[derive(Deserialize)]
struct UserInfoData {
    user: UserInfo,
}

#[derive(Deserialize)]
struct UserInfo {
    open_id: Option<String>,
    display_name: Option<String>,
    avatar_url: Option<String>,
    username: Option<String>,
}

#[derive(Deserialize)]
struct ApiErrorBody {
    code: String,
}

/// Campos pedidos conforme os escopos concedidos (`username` exige `user.info.profile`).
pub fn user_info_fields(scopes: &[String]) -> &'static str {
    if scopes.iter().any(|scope| scope == "user.info.profile") {
        "open_id,avatar_url,display_name,username"
    } else {
        "open_id,avatar_url,display_name"
    }
}

fn map_api_error(code: &str) -> CommandError {
    match code {
        "access_token_invalid" => CommandError::new(
            "TIKTOK_AUTH_EXPIRED",
            "A autorização do TikTok expirou ou foi revogada. Conecte a conta novamente.",
        ),
        "scope_not_authorized" | "scope_permission_missed" => CommandError::new(
            "TIKTOK_PROFILE",
            "O TikTok não concedeu a permissão de perfil. Conecte novamente e aceite todas as permissões.",
        ),
        "rate_limit_exceeded" => CommandError::new(
            "TIKTOK_RATE_LIMIT",
            "O TikTok limitou as requisições. Tente novamente em alguns minutos.",
        ),
        _ => CommandError::new("TIKTOK_ERROR", "O TikTok não devolveu o perfil da conta."),
    }
}

fn is_valid_username(value: &str) -> bool {
    (1..=64).contains(&value.len())
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_'))
}

/// Valida a resposta (dados externos são não confiáveis) e confere que é a conta dos tokens.
fn parse_user_info(body: &str, expected_open_id: &str) -> CommandResult<TikTokProfile> {
    let invalid = || CommandError::new("TIKTOK_ERROR", "Resposta inesperada do TikTok.");
    let parsed: UserInfoResponse = serde_json::from_str(body).map_err(|_| invalid())?;
    if parsed.error.code != "ok" {
        return Err(map_api_error(&parsed.error.code));
    }
    let user = parsed.data.ok_or_else(invalid)?.user;
    let open_id = user.open_id.ok_or_else(invalid)?;
    if !is_valid_open_id(&open_id) || open_id != expected_open_id {
        return Err(invalid());
    }
    let display_name: String = user
        .display_name
        .unwrap_or_default()
        .trim()
        .chars()
        .filter(|char| !char.is_control())
        .take(MAX_DISPLAY_NAME_CHARS)
        .collect();
    let username = user.username.filter(|value| is_valid_username(value));
    let avatar_url = user.avatar_url.filter(|url| {
        url.len() <= MAX_AVATAR_URL_LENGTH
            && url::Url::parse(url).is_ok_and(|parsed| parsed.scheme() == "https")
    });
    Ok(TikTokProfile {
        display_name: if display_name.is_empty() {
            username.clone().unwrap_or_default()
        } else {
            display_name
        },
        open_id,
        username,
        avatar_url,
    })
}

pub async fn fetch_profile(
    access_token: &Secret,
    open_id: &str,
    scopes: &[String],
) -> CommandResult<TikTokProfile> {
    let url = url::Url::parse_with_params(USER_INFO_URL, &[("fields", user_info_fields(scopes))])
        .map_err(|_| CommandError::new("TIKTOK_ERROR", "URL do TikTok inválida."))?;
    let response = CLIENT
        .get(url)
        .bearer_auth(access_token.expose())
        .send()
        .await
        .map_err(|_| {
            CommandError::new(
                "TIKTOK_UNAVAILABLE",
                "Não foi possível falar com o TikTok. Verifique a internet.",
            )
        })?;
    let body = response
        .text()
        .await
        .map_err(|_| CommandError::new("TIKTOK_UNAVAILABLE", "O TikTok não respondeu a tempo."))?;
    parse_user_info(&body, open_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    const OK: &str = r#"{"data":{"user":{"open_id":"open-1","display_name":" YEAXX Cars ",
        "avatar_url":"https://p16.tiktokcdn.com/a.jpg","username":"yeaxx"}},
        "error":{"code":"ok","message":"","log_id":"L1"}}"#;

    #[test]
    fn pede_username_so_com_user_info_profile() {
        assert!(user_info_fields(&["user.info.profile".into()]).contains("username"));
        assert!(!user_info_fields(&["user.info.basic".into()]).contains("username"));
    }

    #[test]
    fn le_o_perfil_valido() {
        assert_eq!(
            parse_user_info(OK, "open-1").unwrap(),
            TikTokProfile {
                open_id: "open-1".into(),
                username: Some("yeaxx".into()),
                display_name: "YEAXX Cars".into(),
                avatar_url: Some("https://p16.tiktokcdn.com/a.jpg".into()),
            }
        );
    }

    #[test]
    fn recusa_perfil_de_outra_conta_e_descarta_campos_invalidos() {
        assert!(parse_user_info(OK, "outra").is_err());
        let weird = OK
            .replace("https://p16", "http://p16")
            .replace("\"yeaxx\"", "\"nome com espaço\"");
        let profile = parse_user_info(&weird, "open-1").unwrap();
        assert_eq!(profile.avatar_url, None);
        assert_eq!(profile.username, None);
    }

    #[test]
    fn mapeia_erros_da_api() {
        let error = |code: &str| {
            parse_user_info(
                &format!(r#"{{"error":{{"code":"{code}","message":"x"}}}}"#),
                "open-1",
            )
            .unwrap_err()
            .code
        };
        assert_eq!(error("access_token_invalid"), "TIKTOK_AUTH_EXPIRED");
        assert_eq!(error("scope_not_authorized"), "TIKTOK_PROFILE");
        assert_eq!(error("rate_limit_exceeded"), "TIKTOK_RATE_LIMIT");
        assert_eq!(error("outro"), "TIKTOK_ERROR");
    }
}
