//! `creator_info` do Content Posting API: o que a conta pode publicar agora (DEC-029).
//!
//! As diretrizes do TikTok exigem consultar isso **sempre que a tela de publicação abre**: nickname exibido,
//! opções de privacidade (sem padrão), interações bloqueadas pelo criador e duração máxima do vídeo.
//! Fonte: <https://developers.tiktok.com/doc/content-posting-api-reference-query-creator-info> (2026-10-13).

use serde::{Deserialize, Serialize};

use super::api::{map_api_error, CLIENT};
use super::secret::Secret;
use crate::error::{CommandError, CommandResult};

const CREATOR_INFO_URL: &str = "https://open.tiktokapis.com/v2/post/publish/creator_info/query/";
const MAX_TEXT_CHARS: usize = 100;
const MAX_AVATAR_URL_LENGTH: usize = 2048;
const KNOWN_PRIVACY_LEVELS: [&str; 4] = [
    "PUBLIC_TO_EVERYONE",
    "MUTUAL_FOLLOW_FRIENDS",
    "FOLLOWER_OF_CREATOR",
    "SELF_ONLY",
];

/// Dados públicos devolvidos ao frontend (nunca tokens).
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreatorInfo {
    nickname: String,
    username: Option<String>,
    avatar_url: Option<String>,
    privacy_level_options: Vec<String>,
    comment_disabled: bool,
    duet_disabled: bool,
    stitch_disabled: bool,
    max_video_post_duration_sec: Option<u32>,
}

#[derive(Deserialize)]
struct Response {
    data: Option<Data>,
    error: ErrorBody,
}

#[derive(Deserialize)]
struct Data {
    creator_avatar_url: Option<String>,
    creator_username: Option<String>,
    creator_nickname: Option<String>,
    #[serde(default)]
    privacy_level_options: Vec<String>,
    #[serde(default)]
    comment_disabled: bool,
    #[serde(default)]
    duet_disabled: bool,
    #[serde(default)]
    stitch_disabled: bool,
    max_video_post_duration_sec: Option<u32>,
}

#[derive(Deserialize)]
struct ErrorBody {
    code: String,
}

fn invalid() -> CommandError {
    CommandError::new("TIKTOK_ERROR", "Resposta inesperada do TikTok.")
}

fn map_error(code: &str) -> CommandError {
    match code {
        "spam_risk_too_many_posts" | "spam_risk_user_banned_from_posting" | "reached_active_user_cap" => {
            CommandError::new(
                "TIKTOK_CANNOT_POST",
                "O TikTok não permite novas publicações desta conta agora (limite diário ou restrição). Tente mais tarde.",
            )
        }
        "scope_not_authorized" => CommandError::new(
            "TIKTOK_PROFILE",
            "A conta não autorizou publicar vídeos. Conecte de novo e aceite a permissão de publicação.",
        ),
        other => map_api_error(other),
    }
}

fn clean_text(value: Option<String>) -> String {
    value
        .unwrap_or_default()
        .trim()
        .chars()
        .filter(|char| !char.is_control())
        .take(MAX_TEXT_CHARS)
        .collect()
}

fn parse(body: &str) -> CommandResult<CreatorInfo> {
    let parsed: Response = serde_json::from_str(body).map_err(|_| invalid())?;
    if parsed.error.code != "ok" {
        return Err(map_error(&parsed.error.code));
    }
    let data = parsed.data.ok_or_else(invalid)?;
    let privacy: Vec<String> = data
        .privacy_level_options
        .into_iter()
        .filter(|level| KNOWN_PRIVACY_LEVELS.contains(&level.as_str()))
        .collect();
    // Sem nenhuma opção de privacidade conhecida não há como cumprir "o usuário escolhe".
    if privacy.is_empty() {
        return Err(invalid());
    }
    let username = data.creator_username.filter(|value| {
        (1..=64).contains(&value.len())
            && value
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_'))
    });
    let avatar_url = data.creator_avatar_url.filter(|url| {
        url.len() <= MAX_AVATAR_URL_LENGTH
            && url::Url::parse(url).is_ok_and(|parsed| parsed.scheme() == "https")
    });
    let nickname = clean_text(data.creator_nickname);
    Ok(CreatorInfo {
        nickname: if nickname.is_empty() {
            username.clone().unwrap_or_default()
        } else {
            nickname
        },
        username,
        avatar_url,
        privacy_level_options: privacy,
        comment_disabled: data.comment_disabled,
        duet_disabled: data.duet_disabled,
        stitch_disabled: data.stitch_disabled,
        max_video_post_duration_sec: data
            .max_video_post_duration_sec
            .filter(|seconds| *seconds > 0),
    })
}

pub async fn fetch(access_token: &Secret) -> CommandResult<CreatorInfo> {
    let response = CLIENT
        .post(CREATOR_INFO_URL)
        .bearer_auth(access_token.expose())
        .header("Content-Type", "application/json; charset=UTF-8")
        .body("{}")
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
    parse(&body)
}

#[cfg(test)]
mod tests {
    use super::*;

    const OK: &str = r#"{"data":{"creator_avatar_url":"https://p16.tiktokcdn.com/a.jpg","creator_username":"yeeax",
        "creator_nickname":"yeaax","privacy_level_options":["FOLLOWER_OF_CREATOR","MUTUAL_FOLLOW_FRIENDS","SELF_ONLY"],
        "comment_disabled":false,"duet_disabled":true,"stitch_disabled":true,"max_video_post_duration_sec":600},
        "error":{"code":"ok","message":"","log_id":"L1"}}"#;

    #[test]
    fn le_o_creator_info() {
        let info = parse(OK).unwrap();
        assert_eq!(info.nickname, "yeaax");
        assert_eq!(info.username.as_deref(), Some("yeeax"));
        assert_eq!(
            info.privacy_level_options,
            ["FOLLOWER_OF_CREATOR", "MUTUAL_FOLLOW_FRIENDS", "SELF_ONLY"]
        );
        assert!(info.duet_disabled && info.stitch_disabled && !info.comment_disabled);
        assert_eq!(info.max_video_post_duration_sec, Some(600));
    }

    #[test]
    fn ignora_niveis_de_privacidade_desconhecidos_e_exige_ao_menos_um() {
        let unknown = OK.replace("\"FOLLOWER_OF_CREATOR\",", "\"NOVO_NIVEL\",");
        assert_eq!(
            parse(&unknown).unwrap().privacy_level_options,
            ["MUTUAL_FOLLOW_FRIENDS", "SELF_ONLY"]
        );
        let none = OK.replace(
            r#"["FOLLOWER_OF_CREATOR","MUTUAL_FOLLOW_FRIENDS","SELF_ONLY"]"#,
            "[]",
        );
        assert_eq!(parse(&none).unwrap_err().code, "TIKTOK_ERROR");
    }

    #[test]
    fn descarta_avatar_sem_https_e_username_invalido() {
        let weird = OK
            .replace("https://p16", "http://p16")
            .replace("\"yeeax\"", "\"nome com espaço\"");
        let info = parse(&weird).unwrap();
        assert_eq!(info.avatar_url, None);
        assert_eq!(info.username, None);
    }

    #[test]
    fn mapeia_os_erros_do_creator_info() {
        let error = |code: &str| {
            parse(&format!(
                r#"{{"data":{{}},"error":{{"code":"{code}","message":"x"}}}}"#
            ))
            .unwrap_err()
            .code
        };
        assert_eq!(error("spam_risk_too_many_posts"), "TIKTOK_CANNOT_POST");
        assert_eq!(
            error("spam_risk_user_banned_from_posting"),
            "TIKTOK_CANNOT_POST"
        );
        assert_eq!(error("reached_active_user_cap"), "TIKTOK_CANNOT_POST");
        assert_eq!(error("scope_not_authorized"), "TIKTOK_PROFILE");
        assert_eq!(error("access_token_invalid"), "TIKTOK_AUTH_EXPIRED");
        assert_eq!(error("rate_limit_exceeded"), "TIKTOK_RATE_LIMIT");
    }
}
