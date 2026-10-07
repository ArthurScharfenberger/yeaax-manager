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

fn entry(name: &str) -> CommandResult<Entry> {
    validate_name(name)?;
    STORE.as_ref().map_err(|_| store_error())?;
    Entry::new(SERVICE, name).map_err(|_| store_error())
}

/// Lê um segredo para uso interno do Rust. Nunca exponha o retorno ao webview.
pub fn read_secret(name: &str) -> CommandResult<Option<String>> {
    match entry(name)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(_) => Err(store_error()),
    }
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
    match entry(&name)?.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(_) => Err(store_error()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_known_secret_names() {
        assert!(validate_name(OPENAI_API_KEY).is_ok());
        assert_eq!(validate_name("qualquer").unwrap_err().code, "INVALID_INPUT");
    }

    #[test]
    fn trims_and_rejects_invalid_values() {
        assert_eq!(validate_value("  sk-abc123  ").unwrap(), "sk-abc123");
        assert!(validate_value("   ").is_err());
        assert!(validate_value("sk abc").is_err());
        assert!(validate_value(&"a".repeat(MAX_SECRET_LENGTH + 1)).is_err());
    }
}
