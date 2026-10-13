use std::collections::HashMap;
use std::sync::LazyLock;

use keyring_core::{Entry, Error as KeyringError};

use crate::error::{CommandError, CommandResult};

/// Nome do serviço no Gerenciador de Credenciais do Windows.
const SERVICE: &str = "com.socialmanager.desktop";
const MAX_SECRET_LENGTH: usize = 512;

pub const OPENAI_API_KEY: &str = "openai_api_key";

/// Únicos segredos que o webview pode gravar/consultar. Não existe comando para LER o
/// valor: segredos só são usados pelo próprio Rust (ex.: `ai_chat_completion`).
const ALLOWED_SECRETS: [&str; 1] = [OPENAI_API_KEY];

static STORE: LazyLock<Result<(), String>> = LazyLock::new(init_store);

fn init_store() -> Result<(), String> {
    #[cfg(windows)]
    {
        let store =
            windows_native_keyring_store::Store::new().map_err(|error| error.to_string())?;
        keyring_core::set_default_store(store);
        Ok(())
    }
    #[cfg(not(windows))]
    Err("cofre de credenciais suportado apenas no Windows nesta versão".into())
}

fn store_error() -> CommandError {
    CommandError::new(
        "SECRET_STORE",
        "O Gerenciador de Credenciais do Windows não está disponível.",
    )
}

fn validate_name(name: &str) -> CommandResult<()> {
    if ALLOWED_SECRETS.contains(&name) {
        Ok(())
    } else {
        Err(CommandError::new("INVALID_INPUT", "Segredo desconhecido."))
    }
}

/// Persistência `Local` (CRED_PERSIST_LOCAL_MACHINE): o item fica só neste computador. O padrão da biblioteca é
/// `Enterprise`, que acompanha perfis móveis de domínio para outras máquinas. Vale na próxima gravação de cada item.
const PERSISTENCE: &str = "Local";

fn raw_entry(name: &str) -> CommandResult<Entry> {
    STORE.as_ref().map_err(|_| store_error())?;
    let modifiers = HashMap::from([("persistence", PERSISTENCE)]);
    Entry::new_with_modifiers(SERVICE, name, &modifiers).map_err(|_| store_error())
}

fn entry(name: &str) -> CommandResult<Entry> {
    validate_name(name)?;
    raw_entry(name)
}

fn read_entry(entry: &Entry) -> CommandResult<Option<String>> {
    match entry.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(_) => Err(store_error()),
    }
}

fn delete_entry(entry: &Entry) -> CommandResult<()> {
    match entry.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(_) => Err(store_error()),
    }
}

/// Lê um segredo para uso interno do Rust. Nunca exponha o retorno ao webview.
pub fn read_secret(name: &str) -> CommandResult<Option<String>> {
    read_entry(&entry(name)?)
}

/// Prefixo dos itens de token do TikTok (um por canal). Esses itens **não** são acessíveis pelos comandos
/// `secret_*` do webview: só o módulo `tiktok::tokens` os lê e grava (DEC-027).
pub const TIKTOK_TOKEN_PREFIX: &str = "tiktok_token:";

fn tiktok_token_entry(channel_id: &str) -> CommandResult<Entry> {
    let valid = (1..=64).contains(&channel_id.len())
        && channel_id
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'-');
    if !valid {
        return Err(CommandError::new("INVALID_INPUT", "Canal inválido."));
    }
    raw_entry(&format!("{TIKTOK_TOKEN_PREFIX}{channel_id}"))
}

pub(crate) fn read_tiktok_tokens(channel_id: &str) -> CommandResult<Option<String>> {
    read_entry(&tiktok_token_entry(channel_id)?)
}

/// Grava (ou substitui, de forma atômica no cofre) os tokens do canal.
pub(crate) fn write_tiktok_tokens(channel_id: &str, value: &str) -> CommandResult<()> {
    tiktok_token_entry(channel_id)?
        .set_password(value)
        .map_err(|_| store_error())
}

pub(crate) fn delete_tiktok_tokens(channel_id: &str) -> CommandResult<()> {
    delete_entry(&tiktok_token_entry(channel_id)?)
}

fn validate_value(value: &str) -> CommandResult<&str> {
    let value = value.trim();
    if value.is_empty() || value.len() > MAX_SECRET_LENGTH || value.chars().any(char::is_whitespace)
    {
        return Err(CommandError::new(
            "INVALID_INPUT",
            "Valor de chave inválido.",
        ));
    }
    Ok(value)
}

#[tauri::command]
pub async fn secret_set(name: String, value: String) -> CommandResult<()> {
    let value = validate_value(&value)?;
    entry(&name)?.set_password(value).map_err(|_| store_error())
}

#[tauri::command]
pub async fn secret_has(name: String) -> CommandResult<bool> {
    Ok(read_secret(&name)?.is_some())
}

#[tauri::command]
pub async fn secret_delete(name: String) -> CommandResult<()> {
    delete_entry(&entry(&name)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_known_secret_names() {
        assert!(validate_name(OPENAI_API_KEY).is_ok());
        assert_eq!(validate_name("qualquer").unwrap_err().code, "INVALID_INPUT");
        // Tokens do TikTok nunca passam pelos comandos do webview.
        assert!(validate_name("tiktok_token:canal-1").is_err());
    }

    #[test]
    fn tiktok_token_entry_aceita_so_ids_de_canal() {
        for id in ["", "../x", "a b", "canal:1", &"a".repeat(65)] {
            assert_eq!(
                tiktok_token_entry(id).unwrap_err().code,
                "INVALID_INPUT",
                "{id}"
            );
        }
    }

    #[test]
    fn trims_and_rejects_invalid_values() {
        assert_eq!(validate_value("  sk-abc123  ").unwrap(), "sk-abc123");
        assert!(validate_value("   ").is_err());
        assert!(validate_value("sk abc").is_err());
        assert!(validate_value(&"a".repeat(MAX_SECRET_LENGTH + 1)).is_err());
    }
}
