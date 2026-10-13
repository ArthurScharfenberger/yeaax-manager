//! Envelope para valores sensíveis (tokens, code, verifier, state).
//!
//! Não implementa `Display` nem `Serialize`, e o `Debug` só mostra `[redacted]`: um `{:?}` acidental em log ou
//! erro nunca vaza o valor. Para usar o valor é preciso chamar `expose()` explicitamente.

#[derive(Clone, PartialEq, Eq)]
pub struct Secret(String);

impl Secret {
    pub fn new(value: impl Into<String>) -> Self {
        Self(value.into())
    }

    pub fn expose(&self) -> &str {
        &self.0
    }
}

impl std::fmt::Debug for Secret {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("Secret([redacted])")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn debug_nunca_mostra_o_valor() {
        let secret = Secret::new("act.SEGREDO");
        assert_eq!(format!("{secret:?}"), "Secret([redacted])");
        assert_eq!(secret.expose(), "act.SEGREDO");
    }
}
