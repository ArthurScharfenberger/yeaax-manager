//! PKCE e `state` do Login Kit Desktop do TikTok (DEC-027).
//!
//! Peculiaridade do TikTok: `code_challenge` é o SHA-256 do `code_verifier` codificado em **hexadecimal**
//! (minúsculo), e não em base64url como no RFC 7636. `code_challenge_method` é sempre `S256`.
//! Fonte: <https://developers.tiktok.com/doc/login-kit-desktop> (verificado em 2026-10-13).
//!
//! Valores aleatórios vêm do CSPRNG do sistema operacional (`getrandom`). Nada aqui é registrado em log.

use sha2::{Digest, Sha256};

/// 64 caracteres "unreserved" do RFC 7636: cada byte aleatório mapeado com `& 63` dá distribuição uniforme.
const ALPHABET: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/// Tamanho do `code_verifier` gerado (RFC 7636 aceita 43–128): 64 caracteres = 384 bits de entropia.
pub const VERIFIER_LENGTH: usize = 64;
/// Tamanho do `state` gerado: 43 caracteres = 258 bits de entropia.
pub const STATE_LENGTH: usize = 43;
pub const CHALLENGE_METHOD: &str = "S256";

fn random_token(length: usize) -> Result<String, getrandom::Error> {
    let mut bytes = vec![0u8; length];
    getrandom::fill(&mut bytes)?;
    Ok(bytes
        .iter()
        .map(|byte| char::from(ALPHABET[usize::from(byte & 63)]))
        .collect())
}

/// Novo `code_verifier` — um por tentativa de login, nunca reutilizado.
pub fn new_code_verifier() -> Result<String, getrandom::Error> {
    random_token(VERIFIER_LENGTH)
}

/// Novo `state` anti-CSRF — um por tentativa de login, de uso único.
pub fn new_state() -> Result<String, getrandom::Error> {
    random_token(STATE_LENGTH)
}

/// `code_challenge` no formato exigido pelo TikTok: SHA-256 do verifier em hexadecimal minúsculo.
pub fn code_challenge(verifier: &str) -> String {
    Sha256::digest(verifier.as_bytes())
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

/// RFC 7636 §4.1: 43–128 caracteres de `[A-Za-z0-9-._~]`.
pub fn is_valid_code_verifier(verifier: &str) -> bool {
    (43..=128).contains(&verifier.len())
        && verifier
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'.' | b'_' | b'~'))
}

/// Comparação em tempo constante (para o `state`), independente de onde os valores diferem.
pub fn constant_time_eq(left: &str, right: &str) -> bool {
    let (left, right) = (left.as_bytes(), right.as_bytes());
    if left.len() != right.len() {
        return false;
    }
    left.iter()
        .zip(right)
        .fold(0u8, |diff, (a, b)| diff | (a ^ b))
        == 0
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    #[test]
    fn verifier_tem_64_caracteres_unreserved() {
        let verifier = new_code_verifier().unwrap();
        assert_eq!(verifier.len(), VERIFIER_LENGTH);
        assert!(is_valid_code_verifier(&verifier));
    }

    #[test]
    fn verifier_e_state_sao_novos_a_cada_login() {
        let verifiers: HashSet<_> = (0..200).map(|_| new_code_verifier().unwrap()).collect();
        let states: HashSet<_> = (0..200).map(|_| new_state().unwrap()).collect();
        assert_eq!(verifiers.len(), 200);
        assert_eq!(states.len(), 200);
        assert!(states.iter().all(|state| state.len() == STATE_LENGTH));
    }

    #[test]
    fn challenge_e_sha256_em_hex_minusculo_nao_base64url() {
        // Vetor do RFC 7636, Apêndice B. Em base64url seria "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
        // o TikTok exige o mesmo digest em hexadecimal.
        let challenge = code_challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk");
        assert_eq!(
            challenge,
            "13d31e961a1ad8ec2f16b10c4c982e0876a878ad6df144566ee1894acb70f9c3"
        );
        assert_ne!(challenge, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
        assert_eq!(CHALLENGE_METHOD, "S256");
    }

    #[test]
    fn challenge_sempre_tem_64_digitos_hex() {
        let challenge = code_challenge(&new_code_verifier().unwrap());
        assert_eq!(challenge.len(), 64);
        assert!(challenge
            .bytes()
            .all(|byte| byte.is_ascii_digit() || (b'a'..=b'f').contains(&byte)));
    }

    #[test]
    fn valida_tamanho_e_caracteres_do_verifier() {
        assert!(is_valid_code_verifier(&"a".repeat(43)));
        assert!(is_valid_code_verifier(&"a".repeat(128)));
        assert!(is_valid_code_verifier(
            "abcdefghijklmnopqrstuvwxyz-._~ABCDEFGHIJKLMNOP0123"
        ));
        assert!(!is_valid_code_verifier(&"a".repeat(42)));
        assert!(!is_valid_code_verifier(&"a".repeat(129)));
        assert!(!is_valid_code_verifier(&format!("{}+", "a".repeat(42))));
        assert!(!is_valid_code_verifier(&format!("{}é", "a".repeat(42))));
    }

    #[test]
    fn compara_state_em_tempo_constante() {
        assert!(constant_time_eq("abc", "abc"));
        assert!(!constant_time_eq("abc", "abd"));
        assert!(!constant_time_eq("abc", "abcd"));
        assert!(!constant_time_eq("", "a"));
    }
}
