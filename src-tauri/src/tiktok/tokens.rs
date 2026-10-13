//! Tokens do TikTok no Gerenciador de Credenciais do Windows (DEC-027), um item por canal:
//! `tiktok_token:<channel_id>` com JSON `{ openId, scopes, accessToken, accessExpiresAt, refreshToken,
//! refreshExpiresAt }`. Nada daqui é devolvido ao webview nem registrado em log.
//!
//! Divergência documentada (SECURITY.md): o TikTok recomenda guardar o refresh token no servidor; aqui ele fica
//! no cofre do usuário porque o backend é sem estado.

use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};

use super::backend::{self, TokenSet};
use super::secret::Secret;
use crate::commands::secrets::{delete_tiktok_tokens, read_tiktok_tokens, write_tiktok_tokens};
use crate::error::{CommandError, CommandResult};

/// Renova o access token quando faltar menos que isto para expirar.
const REFRESH_MARGIN_SECONDS: u64 = 10 * 60;
/// O cofre do Windows limita o tamanho do item; tokens do TikTok ficam bem abaixo disto.
const MAX_STORED_BYTES: usize = 1200;

/// Serializa a renovação: com refresh token rotativo, duas renovações simultâneas invalidariam uma à outra.
static REFRESH_LOCK: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());

pub fn now_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .unwrap_or_default()
}

pub struct StoredTokens {
    pub open_id: String,
    pub scopes: Vec<String>,
    pub access_token: Secret,
    pub access_expires_at: u64,
    pub refresh_token: Secret,
    pub refresh_expires_at: u64,
}

impl std::fmt::Debug for StoredTokens {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("StoredTokens")
            .field("open_id", &self.open_id)
            .field("access_expires_at", &self.access_expires_at)
            .field("refresh_expires_at", &self.refresh_expires_at)
            .finish_non_exhaustive()
    }
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredJson {
    open_id: String,
    scopes: Vec<String>,
    access_token: String,
    access_expires_at: u64,
    refresh_token: String,
    refresh_expires_at: u64,
}

impl StoredTokens {
    pub fn from_token_set(tokens: TokenSet, now: u64) -> Self {
        Self {
            open_id: tokens.open_id,
            scopes: tokens.scopes,
            access_token: tokens.access_token,
            access_expires_at: now.saturating_add(tokens.expires_in),
            refresh_token: tokens.refresh_token,
            refresh_expires_at: now.saturating_add(tokens.refresh_expires_in),
        }
    }

    pub fn needs_refresh(&self, now: u64) -> bool {
        now.saturating_add(REFRESH_MARGIN_SECONDS) >= self.access_expires_at
    }

    pub fn refresh_expired(&self, now: u64) -> bool {
        now >= self.refresh_expires_at
    }

    fn to_json(&self) -> CommandResult<String> {
        let json = serde_json::to_string(&StoredJson {
            open_id: self.open_id.clone(),
            scopes: self.scopes.clone(),
            access_token: self.access_token.expose().to_owned(),
            access_expires_at: self.access_expires_at,
            refresh_token: self.refresh_token.expose().to_owned(),
            refresh_expires_at: self.refresh_expires_at,
        })
        .map_err(|_| store_format_error())?;
        if json.len() > MAX_STORED_BYTES {
            return Err(CommandError::new(
                "SECRET_STORE",
                "Credenciais do TikTok grandes demais para o cofre do Windows.",
            ));
        }
        Ok(json)
    }

    fn from_json(json: &str) -> CommandResult<Self> {
        let stored: StoredJson = serde_json::from_str(json).map_err(|_| store_format_error())?;
        Ok(Self {
            open_id: stored.open_id,
            scopes: stored.scopes,
            access_token: Secret::new(stored.access_token),
            access_expires_at: stored.access_expires_at,
            refresh_token: Secret::new(stored.refresh_token),
            refresh_expires_at: stored.refresh_expires_at,
        })
    }
}

fn store_format_error() -> CommandError {
    CommandError::new(
        "SECRET_STORE",
        "As credenciais do TikTok guardadas estão corrompidas. Conecte a conta novamente.",
    )
}

pub fn not_connected() -> CommandError {
    CommandError::new(
        "TIKTOK_NOT_CONNECTED",
        "Esta conta do TikTok não está conectada. Clique em Conectar.",
    )
}

pub fn load(channel_id: &str) -> CommandResult<Option<StoredTokens>> {
    read_tiktok_tokens(channel_id)?
        .map(|json| StoredTokens::from_json(&json))
        .transpose()
}

/// Grava os tokens do canal. A escrita no cofre substitui o item inteiro de uma vez.
pub fn save(channel_id: &str, tokens: &StoredTokens) -> CommandResult<()> {
    write_tiktok_tokens(channel_id, &tokens.to_json()?)
}

pub fn delete(channel_id: &str) -> CommandResult<()> {
    delete_tiktok_tokens(channel_id)
}

/// Access token válido do canal, renovando pelo backend quando necessário. O refresh token novo substitui o
/// anterior no cofre antes de qualquer outro uso.
pub async fn valid_access_token(channel_id: &str) -> CommandResult<StoredTokens> {
    let _guard = REFRESH_LOCK.lock().await;
    let stored = load(channel_id)?.ok_or_else(not_connected)?;
    let now = now_seconds();
    if !stored.needs_refresh(now) {
        return Ok(stored);
    }
    if stored.refresh_expired(now) {
        return Err(CommandError::new(
            "TIKTOK_AUTH_EXPIRED",
            "A autorização do TikTok expirou. Conecte a conta novamente.",
        ));
    }
    let renewed = backend::refresh(&stored.refresh_token).await?;
    if renewed.open_id != stored.open_id {
        return Err(CommandError::new(
            "TIKTOK_ERROR",
            "O TikTok devolveu credenciais de outra conta.",
        ));
    }
    let renewed = StoredTokens::from_token_set(renewed, now);
    save(channel_id, &renewed)?;
    Ok(renewed)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tokens(now: u64) -> StoredTokens {
        StoredTokens::from_token_set(
            TokenSet {
                open_id: "open-1".into(),
                scopes: vec!["user.info.basic".into()],
                access_token: Secret::new("act.SEGREDO"),
                expires_in: 86_400,
                refresh_token: Secret::new("rft.SEGREDO"),
                refresh_expires_in: 31_536_000,
            },
            now,
        )
    }

    #[test]
    fn calcula_expiracao_e_janela_de_renovacao() {
        let stored = tokens(1_000);
        assert_eq!(stored.access_expires_at, 87_400);
        assert!(!stored.needs_refresh(1_000));
        assert!(!stored.needs_refresh(87_400 - REFRESH_MARGIN_SECONDS - 1));
        assert!(stored.needs_refresh(87_400 - REFRESH_MARGIN_SECONDS));
        assert!(!stored.refresh_expired(1_000));
        assert!(stored.refresh_expired(1_000 + 31_536_000));
    }

    #[test]
    fn serializa_e_le_de_volta_sem_perder_dados() {
        let stored = tokens(1_000);
        let json = stored.to_json().unwrap();
        assert!(json.len() < MAX_STORED_BYTES);
        let back = StoredTokens::from_json(&json).unwrap();
        assert_eq!(back.open_id, "open-1");
        assert_eq!(back.refresh_token.expose(), "rft.SEGREDO");
        assert_eq!(back.refresh_expires_at, stored.refresh_expires_at);
        assert_eq!(
            StoredTokens::from_json("lixo").unwrap_err().code,
            "SECRET_STORE"
        );
    }

    #[test]
    fn debug_nao_mostra_tokens() {
        let printed = format!("{:?}", tokens(1_000));
        assert!(!printed.contains("SEGREDO"), "{printed}");
    }
}
