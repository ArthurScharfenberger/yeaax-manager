use serde::Serialize;

/// Erro serializável devolvido pelos comandos ao frontend.
///
/// O frontend converte `{ code, message }` em `AppError` (src/lib/errors.ts).
/// Nunca inclua tokens, segredos ou conteúdo de arquivos na mensagem.
#[derive(Debug, Serialize)]
pub struct CommandError {
    pub code: &'static str,
    pub message: String,
}

impl CommandError {
    pub fn new(code: &'static str, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
        }
    }
}

pub type CommandResult<T> = Result<T, CommandError>;
