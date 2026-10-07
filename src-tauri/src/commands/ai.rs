use std::sync::LazyLock;
use std::time::Duration;

use serde_json::Value;

use super::secrets::{read_secret, OPENAI_API_KEY};
use crate::error::{CommandError, CommandResult};

const OPENAI_CHAT_URL: &str = "https://api.openai.com/v1/chat/completions";
const REQUEST_TIMEOUT: Duration = Duration::from_secs(90);
/// Pedido com uma miniatura JPEG em base64 fica bem abaixo disto.
const MAX_BODY_BYTES: usize = 4 * 1024 * 1024;
const MAX_ERROR_MESSAGE: usize = 300;

static CLIENT: LazyLock<reqwest::Client> = LazyLock::new(|| {
    reqwest::Client::builder()
        .timeout(REQUEST_TIMEOUT)
        .build()
        .unwrap_or_default()
});

/// Encaminha um pedido de Chat Completions à OpenAI anexando a chave guardada no
/// Gerenciador de Credenciais. O frontend monta o pedido (modelo, mensagens, schema), mas
/// nunca vê a chave — e este comando só fala com um endpoint fixo.
#[tauri::command]
pub async fn ai_chat_completion(body: Value) -> CommandResult<Value> {
    validate_body(&body)?;
    let api_key = read_secret(OPENAI_API_KEY)?.ok_or_else(|| {
        CommandError::new(
            "AI_NOT_CONFIGURED",
            "Configure a chave da OpenAI em Configurações → IA.",
        )
    })?;

    let response = CLIENT
        .post(OPENAI_CHAT_URL)
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
        .map_err(|error| {
            let message = if error.is_timeout() {
                "A OpenAI demorou demais para responder. Tente novamente."
            } else {
                "Não foi possível conectar à OpenAI. Verifique a internet."
            };
            CommandError::new("AI_UNAVAILABLE", message)
        })?;

    let status = response.status();
    let payload: Value = response
        .json()
        .await
        .map_err(|_| CommandError::new("AI_ERROR", "A OpenAI devolveu uma resposta inválida."))?;

    if status.is_success() {
        return Ok(payload);
    }
    Err(map_api_error(status.as_u16(), &payload))
}

fn validate_body(body: &Value) -> CommandResult<()> {
    let has_model = body
        .get("model")
        .and_then(Value::as_str)
        .is_some_and(|m| !m.is_empty());
    let has_messages = body
        .get("messages")
        .and_then(Value::as_array)
        .is_some_and(|messages| !messages.is_empty());
    if !has_model || !has_messages {
        return Err(CommandError::new(
            "INVALID_INPUT",
            "Pedido de IA sem modelo ou mensagens.",
        ));
    }
    if body.to_string().len() > MAX_BODY_BYTES {
        return Err(CommandError::new(
            "INVALID_INPUT",
            "Pedido de IA grande demais.",
        ));
    }
    Ok(())
}

fn map_api_error(status: u16, payload: &Value) -> CommandError {
    let detail: String = payload
        .pointer("/error/message")
        .and_then(Value::as_str)
        .unwrap_or("erro desconhecido")
        .chars()
        .take(MAX_ERROR_MESSAGE)
        .collect();

    match status {
        // Mensagem fixa: a resposta 401 pode ecoar parte da chave.
        401 => CommandError::new("AI_AUTH", "A chave da OpenAI é inválida ou foi revogada."),
        429 => CommandError::new(
            "AI_RATE_LIMIT",
            format!("Limite de uso ou créditos da OpenAI atingidos: {detail}"),
        ),
        _ => CommandError::new(
            "AI_ERROR",
            format!("A OpenAI recusou o pedido ({status}): {detail}"),
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn requires_model_and_messages() {
        assert!(validate_body(&json!({ "model": "m", "messages": [{ "role": "user" }] })).is_ok());
        assert!(validate_body(&json!({ "model": "m", "messages": [] })).is_err());
        assert!(validate_body(&json!({ "messages": [{ "role": "user" }] })).is_err());
    }

    #[test]
    fn never_echoes_auth_errors() {
        let payload = json!({ "error": { "message": "Incorrect API key provided: sk-proj-abc" } });
        let error = map_api_error(401, &payload);
        assert_eq!(error.code, "AI_AUTH");
        assert!(!error.message.contains("sk-"));
    }

    #[test]
    fn maps_rate_limit_and_other_errors() {
        let payload = json!({ "error": { "message": "You exceeded your current quota" } });
        assert_eq!(map_api_error(429, &payload).code, "AI_RATE_LIMIT");
        assert_eq!(map_api_error(400, &payload).code, "AI_ERROR");
    }
}
