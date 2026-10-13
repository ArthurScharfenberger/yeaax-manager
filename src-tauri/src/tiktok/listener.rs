//! Listener HTTP local do Login Kit Desktop (DEC-027).
//!
//! - Bind **só** em `127.0.0.1`, porta escolhida pelo sistema (`:0`) — aberto antes do navegador, e a mesma
//!   porta vai no `redirect_uri` da autorização e da troca do code.
//! - `wait` consome o listener: ao voltar (sucesso, erro válido do TikTok, timeout ou cancelamento) o socket é
//!   fechado e nenhuma conexão nova é aceita.
//! - Requisições inválidas (caminho errado, `state` errado, favicon…) recebem erro e não encerram a espera, até
//!   o limite de tentativas ou o timeout.

use std::net::{Ipv4Addr, SocketAddr};
use std::time::Duration;

use tauri_plugin_log::log;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::oneshot;
use tokio::time::Instant;

use super::loopback::{
    parse_callback, redirect_uri, CallbackOutcome, CallbackRejection, MAX_REQUEST_HEAD_BYTES,
};
use super::secret::Secret;
use crate::error::{CommandError, CommandResult};

/// Tempo máximo para o usuário concluir a autorização no navegador.
pub const LOGIN_TIMEOUT: Duration = Duration::from_secs(5 * 60);
const READ_TIMEOUT: Duration = Duration::from_secs(10);
/// Depois de tantas requisições inválidas a espera é abortada (algo estranho está batendo na porta).
const MAX_REJECTED_REQUESTS: usize = 50;

pub struct CallbackListener {
    listener: TcpListener,
    port: u16,
}

fn listener_error() -> CommandError {
    CommandError::new(
        "TIKTOK_ERROR",
        "Não foi possível abrir a porta local para receber a autorização.",
    )
}

impl CallbackListener {
    pub async fn bind() -> CommandResult<Self> {
        let listener = TcpListener::bind(SocketAddr::from((Ipv4Addr::LOCALHOST, 0)))
            .await
            .map_err(|_| listener_error())?;
        let port = listener.local_addr().map_err(|_| listener_error())?.port();
        Ok(Self { listener, port })
    }

    pub fn port(&self) -> u16 {
        self.port
    }

    /// Redirect URI com a porta deste listener (usada na autorização e na troca do code).
    pub fn redirect_uri(&self) -> String {
        redirect_uri(self.port)
    }

    /// Espera o callback do TikTok. Consome o listener: ao retornar, a porta está fechada.
    pub async fn wait(
        self,
        expected_state: &Secret,
        limit: Duration,
        mut cancel: oneshot::Receiver<()>,
    ) -> CommandResult<CallbackOutcome> {
        let deadline = Instant::now() + limit;
        let mut rejected = 0;
        loop {
            let accepted = tokio::select! {
                result = self.listener.accept() => result,
                () = tokio::time::sleep_until(deadline) => return Err(timeout_error()),
                _ = &mut cancel => return Err(cancelled_error()),
            };
            let Ok((mut stream, _)) = accepted else {
                continue;
            };
            let remaining = deadline.saturating_duration_since(Instant::now());
            if let Some(head) = read_head(&mut stream, remaining.min(READ_TIMEOUT)).await {
                match parse_callback(&head, self.port, expected_state.expose()) {
                    Ok(outcome) => {
                        respond(&mut stream, 200, page_for(&outcome)).await;
                        return Ok(outcome);
                    }
                    Err(rejection) => {
                        log::warn!("tiktok: requisição local recusada ({rejection:?})");
                        respond(&mut stream, status_for(&rejection), REJECTED_PAGE).await;
                    }
                }
            }
            rejected += 1;
            if rejected >= MAX_REJECTED_REQUESTS {
                return Err(CommandError::new(
                    "TIKTOK_ERROR",
                    "Muitas requisições inválidas na porta local. Tente conectar novamente.",
                ));
            }
        }
    }
}

fn timeout_error() -> CommandError {
    CommandError::new(
        "TIKTOK_LOGIN_TIMEOUT",
        "A autorização no TikTok não foi concluída em 5 minutos. Tente novamente.",
    )
}

fn cancelled_error() -> CommandError {
    CommandError::new("TIKTOK_LOGIN_CANCELLED", "Conexão com o TikTok cancelada.")
}

/// Lê a linha de requisição + cabeçalhos (até `\r\n\r\n`), com limite de tamanho e de tempo.
async fn read_head(stream: &mut TcpStream, limit: Duration) -> Option<String> {
    let read = async {
        let mut buffer = Vec::with_capacity(1024);
        let mut chunk = [0u8; 1024];
        while !buffer.windows(4).any(|window| window == b"\r\n\r\n") {
            let count = stream.read(&mut chunk).await.ok()?;
            if count == 0 {
                return None;
            }
            buffer.extend_from_slice(&chunk[..count]);
            if buffer.len() > MAX_REQUEST_HEAD_BYTES {
                // Deixa o parser responder "TooLarge".
                break;
            }
        }
        String::from_utf8(buffer).ok()
    };
    tokio::time::timeout(limit, read).await.ok().flatten()
}

const SUCCESS_PAGE: &str = "Autorização recebida. Volte ao Yeaax Manager para concluir a conexão — esta aba pode ser fechada.";
const DENIED_PAGE: &str =
    "A autorização não foi concluída no TikTok. Volte ao Yeaax Manager para tentar novamente.";
const REJECTED_PAGE: &str = "Requisição inválida.";

fn page_for(outcome: &CallbackOutcome) -> &'static str {
    match outcome {
        CallbackOutcome::Authorized { .. } => SUCCESS_PAGE,
        CallbackOutcome::Denied { .. } => DENIED_PAGE,
    }
}

fn status_for(rejection: &CallbackRejection) -> u16 {
    match rejection {
        CallbackRejection::WrongPath => 404,
        CallbackRejection::NotGet => 405,
        CallbackRejection::TooLarge => 431,
        _ => 400,
    }
}

/// Resposta mínima, sem recursos externos e sem refletir nada da requisição.
async fn respond(stream: &mut TcpStream, status: u16, message: &str) {
    let reason = match status {
        200 => "OK",
        404 => "Not Found",
        405 => "Method Not Allowed",
        431 => "Request Header Fields Too Large",
        _ => "Bad Request",
    };
    let body = format!(
        "<!doctype html><html lang=\"pt-BR\"><head><meta charset=\"utf-8\"><title>Yeaax Manager</title></head>\
         <body><h1>Yeaax Manager</h1><p>{message}</p></body></html>"
    );
    let response = format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: {}\r\n\
         Cache-Control: no-store\r\nContent-Security-Policy: default-src 'none'\r\n\
         Referrer-Policy: no-referrer\r\nConnection: close\r\n\r\n{body}",
        body.len()
    );
    let _ = stream.write_all(response.as_bytes()).await;
    let _ = stream.shutdown().await;
}

#[cfg(test)]
mod tests {
    use super::*;

    const STATE: &str = "Zx9-_abcdefghijklmnopqrstuvwxyzABCDEFGHIJKL";

    async fn send(port: u16, target: &str) -> String {
        let mut stream = TcpStream::connect((Ipv4Addr::LOCALHOST, port))
            .await
            .unwrap();
        let request = format!("GET {target} HTTP/1.1\r\nHost: 127.0.0.1:{port}\r\n\r\n");
        stream.write_all(request.as_bytes()).await.unwrap();
        let mut response = String::new();
        stream.read_to_string(&mut response).await.unwrap();
        response
    }

    async fn is_closed(port: u16) -> bool {
        TcpStream::connect((Ipv4Addr::LOCALHOST, port))
            .await
            .is_err()
    }

    #[tokio::test]
    async fn escuta_so_em_127_0_0_1_com_porta_do_sistema() {
        let listener = CallbackListener::bind().await.unwrap();
        let address = listener.listener.local_addr().unwrap();
        assert_eq!(address.ip(), Ipv4Addr::LOCALHOST);
        assert!(listener.port() >= 1024);
        assert_eq!(
            listener.redirect_uri(),
            format!("http://127.0.0.1:{}/tiktok/callback", listener.port())
        );
    }

    #[tokio::test]
    async fn ignora_requisicoes_invalidas_e_fecha_apos_o_callback_valido() {
        let listener = CallbackListener::bind().await.unwrap();
        let port = listener.port();
        let (_cancel, receiver) = oneshot::channel();
        let state = Secret::new(STATE);
        let waiting = tokio::spawn(async move {
            listener
                .wait(&state, Duration::from_secs(10), receiver)
                .await
        });

        assert!(send(port, "/favicon.ico").await.starts_with("HTTP/1.1 404"));
        let wrong_state = send(port, "/tiktok/callback?code=abc&state=outro").await;
        assert!(wrong_state.starts_with("HTTP/1.1 400"));
        let ok = send(port, &format!("/tiktok/callback?code=abc&state={STATE}")).await;
        assert!(ok.starts_with("HTTP/1.1 200"));
        assert!(!ok.contains("abc"), "a resposta não reflete o code");

        let outcome = waiting.await.unwrap().unwrap();
        assert_eq!(
            outcome,
            CallbackOutcome::Authorized {
                code: "abc".into(),
                scopes: vec![]
            }
        );
        assert!(is_closed(port).await, "a porta fecha após o sucesso");
    }

    #[tokio::test]
    async fn erro_valido_do_tiktok_encerra_a_espera() {
        let listener = CallbackListener::bind().await.unwrap();
        let port = listener.port();
        let (_cancel, receiver) = oneshot::channel();
        let state = Secret::new(STATE);
        let waiting = tokio::spawn(async move {
            listener
                .wait(&state, Duration::from_secs(10), receiver)
                .await
        });
        send(
            port,
            &format!("/tiktok/callback?error=access_denied&state={STATE}"),
        )
        .await;
        assert_eq!(
            waiting.await.unwrap().unwrap(),
            CallbackOutcome::Denied {
                error: "access_denied".into()
            }
        );
        assert!(is_closed(port).await);
    }

    #[tokio::test]
    async fn timeout_encerra_e_fecha_a_porta() {
        let listener = CallbackListener::bind().await.unwrap();
        let port = listener.port();
        let (_cancel, receiver) = oneshot::channel();
        let result = listener
            .wait(&Secret::new(STATE), Duration::from_millis(100), receiver)
            .await;
        assert_eq!(result.unwrap_err().code, "TIKTOK_LOGIN_TIMEOUT");
        assert!(is_closed(port).await);
    }

    #[tokio::test]
    async fn cancelamento_encerra_e_fecha_a_porta() {
        let listener = CallbackListener::bind().await.unwrap();
        let port = listener.port();
        let (cancel, receiver) = oneshot::channel();
        cancel.send(()).unwrap();
        let result = listener
            .wait(&Secret::new(STATE), Duration::from_secs(10), receiver)
            .await;
        assert_eq!(result.unwrap_err().code, "TIKTOK_LOGIN_CANCELLED");
        assert!(is_closed(port).await);
    }
}
