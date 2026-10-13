//! Validação da requisição recebida pelo listener loopback do Login Kit Desktop (DEC-027).
//!
//! O TikTok redireciona o navegador para `http://127.0.0.1:<porta>/tiktok/callback?code=…&scopes=…&state=…`
//! (ou `?error=…&error_description=…&state=…`). Aqui só existe lógica pura sobre o cabeçalho HTTP já lido;
//! o listener (bind em `127.0.0.1`, porta escolhida pelo sistema, timeout, uso único) usa estas funções.
//! Code e state nunca são registrados em log.

use super::pkce::constant_time_eq;

pub const LOOPBACK_HOST: &str = "127.0.0.1";
pub const CALLBACK_PATH: &str = "/tiktok/callback";
// No portal do TikTok fica cadastrado `http://127.0.0.1:*/tiktok/callback` (porta curinga).
/// Tamanho máximo aceito para a linha de requisição + cabeçalhos.
pub const MAX_REQUEST_HEAD_BYTES: usize = 8 * 1024;
const MAX_CODE_LENGTH: usize = 1024;

/// Redirect URI usada na autorização e repetida na troca do code (o TikTok exige que sejam iguais).
pub fn redirect_uri(port: u16) -> String {
    format!("http://{LOOPBACK_HOST}:{port}{CALLBACK_PATH}")
}

/// Resultado de um callback com `state` válido.
#[derive(Debug, PartialEq, Eq)]
pub enum CallbackOutcome {
    /// O usuário autorizou: `code` já decodificado (uma vez) e escopos concedidos.
    Authorized { code: String, scopes: Vec<String> },
    /// O usuário negou ou o TikTok devolveu erro (código normalizado; a descrição é descartada).
    Denied { error: String },
}

/// Requisições recusadas. O listener responde com erro e continua esperando o callback legítimo até o timeout.
#[derive(Debug, PartialEq, Eq)]
pub enum CallbackRejection {
    TooLarge,
    Malformed,
    NotGet,
    WrongPath,
    WrongHost,
    StateMismatch,
    MissingCode,
}

fn is_opaque_value(value: &str) -> bool {
    !value.is_empty() && value.bytes().all(|byte| (0x21..=0x7e).contains(&byte))
}

fn normalize_error(value: &str) -> String {
    let valid = (1..=64).contains(&value.len())
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'_' | b'.' | b'-'));
    if valid {
        value.to_owned()
    } else {
        "unknown_error".to_owned()
    }
}

fn parse_scopes(value: Option<&str>) -> Vec<String> {
    value
        .unwrap_or_default()
        .split(',')
        .map(str::trim)
        .filter(|scope| {
            !scope.is_empty()
                && scope
                    .bytes()
                    .all(|byte| byte.is_ascii_lowercase() || byte.is_ascii_digit() || byte == b'.')
        })
        .map(str::to_owned)
        .collect()
}

/// Valida o cabeçalho HTTP recebido e extrai o resultado do callback.
///
/// Regras: só `GET`, alvo exatamente `/tiktok/callback` (forma de origem, sem barra final), `Host` igual a
/// `127.0.0.1:<porta>` (bloqueia DNS rebinding), parâmetros sem repetição, `state` presente e igual ao
/// esperado (tempo constante) **antes** de olhar `code`/`error`.
pub fn parse_callback(
    request_head: &str,
    port: u16,
    expected_state: &str,
) -> Result<CallbackOutcome, CallbackRejection> {
    if request_head.len() > MAX_REQUEST_HEAD_BYTES {
        return Err(CallbackRejection::TooLarge);
    }
    let mut lines = request_head.split("\r\n");
    let mut request_line = lines.next().unwrap_or_default().split(' ');
    let (method, target, version) = match (
        request_line.next(),
        request_line.next(),
        request_line.next(),
        request_line.next(),
    ) {
        (Some(method), Some(target), Some(version), None) => (method, target, version),
        _ => return Err(CallbackRejection::Malformed),
    };
    if !version.starts_with("HTTP/1.") {
        return Err(CallbackRejection::Malformed);
    }
    if method != "GET" {
        return Err(CallbackRejection::NotGet);
    }

    let (path, query) = target.split_once('?').unwrap_or((target, ""));
    if path != CALLBACK_PATH || query.contains('#') {
        return Err(CallbackRejection::WrongPath);
    }

    let expected_host = format!("{LOOPBACK_HOST}:{port}");
    let mut hosts = lines
        .take_while(|line| !line.is_empty())
        .filter_map(|line| line.split_once(':'))
        .filter(|(name, _)| name.trim().eq_ignore_ascii_case("host"))
        .map(|(_, value)| value.trim());
    match (hosts.next(), hosts.next()) {
        (Some(host), None) if host == expected_host => {}
        _ => return Err(CallbackRejection::WrongHost),
    }

    let mut code = None;
    let mut state = None;
    let mut error = None;
    let mut scopes = None;
    for (key, value) in url::form_urlencoded::parse(query.as_bytes()) {
        let slot = match key.as_ref() {
            "code" => &mut code,
            "state" => &mut state,
            "error" => &mut error,
            "scopes" => &mut scopes,
            _ => continue,
        };
        // Parâmetro repetido é tratado como requisição forjada.
        if slot.replace(value.into_owned()).is_some() {
            return Err(CallbackRejection::Malformed);
        }
    }

    match state {
        Some(state) if constant_time_eq(&state, expected_state) => {}
        _ => return Err(CallbackRejection::StateMismatch),
    }
    if let Some(error) = error {
        return Ok(CallbackOutcome::Denied {
            error: normalize_error(&error),
        });
    }
    match code {
        Some(code) if code.len() <= MAX_CODE_LENGTH && is_opaque_value(&code) => {
            Ok(CallbackOutcome::Authorized {
                code,
                scopes: parse_scopes(scopes.as_deref()),
            })
        }
        _ => Err(CallbackRejection::MissingCode),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const PORT: u16 = 53682;
    const STATE: &str = "Zx9-_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL";

    fn request(target: &str) -> String {
        format!("GET {target} HTTP/1.1\r\nHost: 127.0.0.1:{PORT}\r\nUser-Agent: test\r\n\r\n")
    }

    fn callback(query: &str) -> Result<CallbackOutcome, CallbackRejection> {
        parse_callback(&request(&format!("/tiktok/callback?{query}")), PORT, STATE)
    }

    #[test]
    fn redirect_uri_usa_loopback_e_caminho_fixo() {
        assert_eq!(redirect_uri(PORT), "http://127.0.0.1:53682/tiktok/callback");
    }

    #[test]
    fn aceita_callback_autorizado_e_decodifica_o_code_uma_vez() {
        let outcome = callback(&format!(
            "code=abc%2A%21123%2525&scopes=user.info.basic%2Cvideo.publish&state={STATE}"
        ));
        assert_eq!(
            outcome,
            Ok(CallbackOutcome::Authorized {
                code: "abc*!123%25".into(),
                scopes: vec!["user.info.basic".into(), "video.publish".into()],
            })
        );
    }

    #[test]
    fn negacao_do_usuario_vira_denied_sem_descricao() {
        let outcome = callback(&format!(
            "error=access_denied&error_description=%3Cscript%3E&state={STATE}"
        ));
        assert_eq!(
            outcome,
            Ok(CallbackOutcome::Denied {
                error: "access_denied".into()
            })
        );
        let weird = callback(&format!("error=%3Cb%3E&state={STATE}"));
        assert_eq!(
            weird,
            Ok(CallbackOutcome::Denied {
                error: "unknown_error".into()
            })
        );
    }

    #[test]
    fn exige_state_igual_antes_de_olhar_code_ou_erro() {
        assert_eq!(callback("code=abc"), Err(CallbackRejection::StateMismatch));
        assert_eq!(
            callback("code=abc&state=outro"),
            Err(CallbackRejection::StateMismatch)
        );
        assert_eq!(
            callback("error=access_denied"),
            Err(CallbackRejection::StateMismatch)
        );
        let almost = format!("code=abc&state={}", &STATE[..STATE.len() - 1]);
        assert_eq!(callback(&almost), Err(CallbackRejection::StateMismatch));
    }

    #[test]
    fn recusa_parametros_repetidos() {
        assert_eq!(
            callback(&format!("code=a&code=b&state={STATE}")),
            Err(CallbackRejection::Malformed)
        );
        assert_eq!(
            callback(&format!("code=a&state={STATE}&state={STATE}")),
            Err(CallbackRejection::Malformed)
        );
    }

    #[test]
    fn recusa_code_ausente_vazio_ou_com_espaco() {
        for query in [
            format!("state={STATE}"),
            format!("code=&state={STATE}"),
            format!("code=a%20b&state={STATE}"),
            format!("code={}&state={STATE}", "a".repeat(1025)),
        ] {
            assert_eq!(
                callback(&query),
                Err(CallbackRejection::MissingCode),
                "{query}"
            );
        }
    }

    #[test]
    fn aceita_somente_o_caminho_esperado() {
        let query = format!("?code=a&state={STATE}");
        for target in [
            format!("/tiktok/callback/{query}"),
            format!("/callback{query}"),
            format!("/tiktok/callback/../callback{query}"),
            format!("/TIKTOK/CALLBACK{query}"),
            format!("http://127.0.0.1:{PORT}/tiktok/callback{query}"),
            "/".to_owned(),
            "/favicon.ico".to_owned(),
        ] {
            assert_eq!(
                parse_callback(&request(&target), PORT, STATE),
                Err(CallbackRejection::WrongPath),
                "{target}"
            );
        }
    }

    #[test]
    fn aceita_somente_get() {
        let head = format!(
            "POST /tiktok/callback?code=a&state={STATE} HTTP/1.1\r\nHost: 127.0.0.1:{PORT}\r\n\r\n"
        );
        assert_eq!(
            parse_callback(&head, PORT, STATE),
            Err(CallbackRejection::NotGet)
        );
    }

    #[test]
    fn exige_host_loopback_com_a_porta_do_listener() {
        let target = format!("/tiktok/callback?code=a&state={STATE}");
        for host in [
            "localhost:53682".to_owned(),
            "127.0.0.1:1234".to_owned(),
            "127.0.0.1".to_owned(),
            "evil.example".to_owned(),
        ] {
            let head = format!("GET {target} HTTP/1.1\r\nHost: {host}\r\n\r\n");
            assert_eq!(
                parse_callback(&head, PORT, STATE),
                Err(CallbackRejection::WrongHost),
                "{host}"
            );
        }
        let missing = format!("GET {target} HTTP/1.1\r\nAccept: */*\r\n\r\n");
        assert_eq!(
            parse_callback(&missing, PORT, STATE),
            Err(CallbackRejection::WrongHost)
        );
        let duplicated = format!(
            "GET {target} HTTP/1.1\r\nHost: 127.0.0.1:{PORT}\r\nHost: evil.example\r\n\r\n"
        );
        assert_eq!(
            parse_callback(&duplicated, PORT, STATE),
            Err(CallbackRejection::WrongHost)
        );
    }

    #[test]
    fn recusa_requisicoes_malformadas_ou_grandes() {
        assert_eq!(
            parse_callback("lixo", PORT, STATE),
            Err(CallbackRejection::Malformed)
        );
        assert_eq!(
            parse_callback("GET /tiktok/callback HTTP/2\r\n\r\n", PORT, STATE),
            Err(CallbackRejection::Malformed)
        );
        let huge = format!(
            "GET /tiktok/callback?x={} HTTP/1.1\r\n\r\n",
            "a".repeat(9000)
        );
        assert_eq!(
            parse_callback(&huge, PORT, STATE),
            Err(CallbackRejection::TooLarge)
        );
    }
}
