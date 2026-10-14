//! Publicação direta (Direct Post) com `FILE_UPLOAD` — Content Posting API (DEC-030).
//!
//! Fluxo: `init` (metadados + plano de partes) → `PUT` sequencial de cada parte no `upload_url` (vale 1 hora) →
//! o TikTok processa; o andamento é consultado em `status/fetch`. O vídeo vai **direto do disco para o TikTok**:
//! nunca passa pelo backend nem é carregado inteiro na memória (no máximo uma parte por vez).
//! Fontes (2026-10-13): Direct Post reference, Media Transfer Guide, Get Post Status.

use std::io::SeekFrom;
use std::path::Path;
use std::time::Duration;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tokio::io::{AsyncReadExt, AsyncSeekExt};

use super::api::{map_api_error, CLIENT};
use super::secret::Secret;
use crate::error::{CommandError, CommandResult};

const INIT_URL: &str = "https://open.tiktokapis.com/v2/post/publish/video/init/";
const STATUS_URL: &str = "https://open.tiktokapis.com/v2/post/publish/status/fetch/";

/// Arquivos até este tamanho vão numa parte só (o TikTok exige parte única abaixo de 5 MB e aceita até 64 MB).
pub const SINGLE_UPLOAD_MAX_BYTES: u64 = 64_000_000;
/// Tamanho das partes acima disso (5–64 MB); a última absorve o resto e fica abaixo de 64 MB (limite: 128 MB).
pub const CHUNK_BYTES: u64 = 32_000_000;
/// Limite do TikTok para vídeos.
pub const MAX_VIDEO_BYTES: u64 = 4 * 1024 * 1024 * 1024;
const MAX_CAPTION_UTF16: usize = 2200;
const UPLOAD_TIMEOUT: Duration = Duration::from_secs(300);
const CHUNK_RETRIES: u32 = 3;

/// Escolhas do usuário vindas do compositor (já validadas no TypeScript; revalidadas aqui).
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostRequest {
    pub file_path: String,
    pub caption: String,
    pub privacy_level: String,
    pub allow_comment: bool,
    pub allow_duet: bool,
    pub allow_stitch: bool,
    pub your_brand: bool,
    pub branded_content: bool,
}

/// Uma parte do upload: bytes `[start, end]` (inclusivo, como no `Content-Range`).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Chunk {
    pub start: u64,
    pub end: u64,
}

#[derive(Debug, PartialEq, Eq)]
pub struct ChunkPlan {
    pub chunk_size: u64,
    pub chunks: Vec<Chunk>,
}

/// Plano de partes segundo o Media Transfer Guide: `total = floor(tamanho / parte)`, a última parte absorve o
/// resto; arquivos pequenos vão inteiros.
pub fn plan_chunks(video_size: u64) -> CommandResult<ChunkPlan> {
    if video_size == 0 {
        return Err(CommandError::new("EMPTY_FILE", "O arquivo está vazio."));
    }
    if video_size > MAX_VIDEO_BYTES {
        return Err(CommandError::new(
            "TIKTOK_VIDEO_INVALID",
            "O vídeo passa de 4 GB, o limite do TikTok.",
        ));
    }
    if video_size <= SINGLE_UPLOAD_MAX_BYTES {
        return Ok(ChunkPlan {
            chunk_size: video_size,
            chunks: vec![Chunk {
                start: 0,
                end: video_size - 1,
            }],
        });
    }
    let total = video_size / CHUNK_BYTES;
    let chunks = (0..total)
        .map(|index| {
            let start = index * CHUNK_BYTES;
            let end = if index + 1 == total {
                video_size - 1
            } else {
                start + CHUNK_BYTES - 1
            };
            Chunk { start, end }
        })
        .collect();
    Ok(ChunkPlan {
        chunk_size: CHUNK_BYTES,
        chunks,
    })
}

const KNOWN_PRIVACY_LEVELS: [&str; 4] = [
    "PUBLIC_TO_EVERYONE",
    "MUTUAL_FOLLOW_FRIENDS",
    "FOLLOWER_OF_CREATOR",
    "SELF_ONLY",
];

/// Validações locais das escolhas (as que dependem da conta são feitas com o `creator_info` no comando).
pub fn validate_request(request: &PostRequest) -> CommandResult<()> {
    let invalid = |message: &str| CommandError::new("INVALID_INPUT", message.to_owned());
    if !KNOWN_PRIVACY_LEVELS.contains(&request.privacy_level.as_str()) {
        return Err(invalid("Privacidade do TikTok inválida."));
    }
    if request.caption.encode_utf16().count() > MAX_CAPTION_UTF16 {
        return Err(invalid(
            "A legenda passa do limite do TikTok (2200 caracteres).",
        ));
    }
    if request.branded_content && request.privacy_level == "SELF_ONLY" {
        return Err(invalid("Conteúdo de marca não pode ser privado."));
    }
    Ok(())
}

/// MIME do `Content-Type` do upload pela extensão já validada.
pub fn mime_type(extension: &str) -> &'static str {
    match extension {
        "mov" => "video/quicktime",
        "webm" => "video/webm",
        _ => "video/mp4",
    }
}

#[derive(Deserialize)]
struct ApiResponse {
    data: Option<Value>,
    error: ApiError,
}

#[derive(Deserialize)]
struct ApiError {
    code: String,
}

fn unexpected() -> CommandError {
    CommandError::new("TIKTOK_ERROR", "Resposta inesperada do TikTok.")
}

fn unavailable() -> CommandError {
    CommandError::new(
        "TIKTOK_UNAVAILABLE",
        "Não foi possível falar com o TikTok. Verifique a internet.",
    )
}

/// Erros específicos da publicação; o resto segue o mapeamento comum.
fn map_publish_error(code: &str) -> CommandError {
    match code {
        "unaudited_client_can_only_post_to_private_accounts" => CommandError::new(
            "TIKTOK_CANNOT_POST",
            "Enquanto o app não for auditado pelo TikTok, só é possível publicar em contas privadas: deixe a conta privada no TikTok e use “Somente eu”.",
        ),
        "privacy_level_option_mismatch" => CommandError::new(
            "TIKTOK_CANNOT_POST",
            "A privacidade escolhida não está disponível para esta conta agora. Abra o post e escolha de novo.",
        ),
        "spam_risk_too_many_posts" | "spam_risk_user_banned_from_posting" | "reached_active_user_cap" => {
            CommandError::new(
                "TIKTOK_CANNOT_POST",
                "O TikTok não permite novas publicações desta conta agora (limite diário ou restrição). Tente mais tarde.",
            )
        }
        "invalid_param" => CommandError::new(
            "TIKTOK_VIDEO_INVALID",
            "O TikTok recusou os dados do post (vídeo ou legenda). Confira o arquivo e tente de novo.",
        ),
        other => map_api_error(other),
    }
}

async fn post_json(url: &str, token: &Secret, body: &Value) -> CommandResult<Value> {
    let response = CLIENT
        .post(url)
        .bearer_auth(token.expose())
        .header("Content-Type", "application/json; charset=UTF-8")
        .json(body)
        .send()
        .await
        .map_err(|_| unavailable())?;
    let text = response.text().await.map_err(|_| unavailable())?;
    let parsed: ApiResponse = serde_json::from_str(&text).map_err(|_| unexpected())?;
    if parsed.error.code != "ok" {
        return Err(map_publish_error(&parsed.error.code));
    }
    parsed.data.ok_or_else(unexpected)
}

/// Corpo do `init` (Direct Post + FILE_UPLOAD).
pub fn init_body(request: &PostRequest, video_size: u64, plan: &ChunkPlan) -> Value {
    json!({
        "post_info": {
            "title": request.caption,
            "privacy_level": request.privacy_level,
            "disable_comment": !request.allow_comment,
            "disable_duet": !request.allow_duet,
            "disable_stitch": !request.allow_stitch,
            "brand_content_toggle": request.branded_content,
            "brand_organic_toggle": request.your_brand,
        },
        "source_info": {
            "source": "FILE_UPLOAD",
            "video_size": video_size,
            "chunk_size": plan.chunk_size,
            "total_chunk_count": plan.chunks.len(),
        }
    })
}

pub struct InitResult {
    pub publish_id: String,
    pub upload_url: String,
}

fn parse_init(data: &Value) -> CommandResult<InitResult> {
    let publish_id = data
        .get("publish_id")
        .and_then(Value::as_str)
        .filter(|id| {
            (1..=64).contains(&id.len()) && id.bytes().all(|byte| (0x21..=0x7e).contains(&byte))
        })
        .ok_or_else(unexpected)?;
    let upload_url = data
        .get("upload_url")
        .and_then(Value::as_str)
        .filter(|url| url::Url::parse(url).is_ok_and(|parsed| parsed.scheme() == "https"))
        .ok_or_else(unexpected)?;
    Ok(InitResult {
        publish_id: publish_id.to_owned(),
        upload_url: upload_url.to_owned(),
    })
}

pub async fn init(
    token: &Secret,
    request: &PostRequest,
    video_size: u64,
    plan: &ChunkPlan,
) -> CommandResult<InitResult> {
    let data = post_json(INIT_URL, token, &init_body(request, video_size, plan)).await?;
    parse_init(&data)
}

fn upload_error(status: u16) -> CommandError {
    match status {
        403 => CommandError::new(
            "TIKTOK_UPLOAD_FAILED",
            "O link de envio do TikTok expirou (1 hora). Tente publicar de novo.",
        ),
        _ => CommandError::new(
            "TIKTOK_UPLOAD_FAILED",
            format!("O TikTok recusou uma parte do vídeo ({status}). Tente publicar de novo."),
        ),
    }
}

/// Envia as partes em sequência, lendo uma por vez do disco. `on_chunk` recebe os bytes já enviados.
pub async fn upload(
    upload_url: &str,
    file_path: &Path,
    extension: &str,
    video_size: u64,
    plan: &ChunkPlan,
    mut on_chunk: impl FnMut(u64),
) -> CommandResult<()> {
    let io_error = || CommandError::new("IO_ERROR", "Não foi possível ler o arquivo do vídeo.");
    let mut file = tokio::fs::File::open(file_path)
        .await
        .map_err(|_| io_error())?;
    for (index, chunk) in plan.chunks.iter().enumerate() {
        let length = usize::try_from(chunk.end - chunk.start + 1).map_err(|_| io_error())?;
        let mut buffer = vec![0u8; length];
        file.seek(SeekFrom::Start(chunk.start))
            .await
            .map_err(|_| io_error())?;
        file.read_exact(&mut buffer).await.map_err(|_| io_error())?;
        let is_last = index + 1 == plan.chunks.len();

        let mut attempt = 0;
        loop {
            attempt += 1;
            let response = CLIENT
                .put(upload_url)
                .timeout(UPLOAD_TIMEOUT)
                .header("Content-Type", mime_type(extension))
                .header(
                    "Content-Range",
                    format!("bytes {}-{}/{}", chunk.start, chunk.end, video_size),
                )
                .body(buffer.clone())
                .send()
                .await;
            let status = match response {
                Ok(response) => response.status().as_u16(),
                Err(_) if attempt < CHUNK_RETRIES => continue,
                Err(_) => return Err(unavailable()),
            };
            match status {
                201 | 200 if is_last => break,
                206 if !is_last => break,
                // 201 antes da última parte não é esperado; 206 na última indica bytes faltando.
                500..=599 if attempt < CHUNK_RETRIES => {
                    tokio::time::sleep(Duration::from_secs(2 * u64::from(attempt))).await;
                }
                other => return Err(upload_error(other)),
            }
        }
        on_chunk(chunk.end + 1);
    }
    Ok(())
}

/// Situação do post no TikTok, devolvida ao frontend.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublishStatus {
    pub status: String,
    pub fail_reason: Option<String>,
    /// Ids públicos (como texto: são int64). Só vêm para posts públicos aprovados na moderação.
    pub post_ids: Vec<String>,
}

const KNOWN_STATUSES: [&str; 5] = [
    "PROCESSING_UPLOAD",
    "PROCESSING_DOWNLOAD",
    "SEND_TO_USER_INBOX",
    "PUBLISH_COMPLETE",
    "FAILED",
];

fn parse_status(data: &Value) -> CommandResult<PublishStatus> {
    let status = data
        .get("status")
        .and_then(Value::as_str)
        .filter(|status| KNOWN_STATUSES.contains(status))
        .ok_or_else(unexpected)?;
    let fail_reason = data
        .get("fail_reason")
        .and_then(Value::as_str)
        .filter(|reason| {
            !reason.is_empty()
                && reason.len() <= 64
                && reason
                    .bytes()
                    .all(|byte| byte.is_ascii_lowercase() || byte == b'_')
        })
        .map(str::to_owned);
    let post_ids = data
        .get("publicaly_available_post_id")
        .and_then(Value::as_array)
        .map(|ids| {
            ids.iter()
                .filter_map(|id| match id {
                    Value::Number(number) => Some(number.to_string()),
                    Value::String(text) if text.bytes().all(|byte| byte.is_ascii_digit()) => {
                        Some(text.clone())
                    }
                    _ => None,
                })
                .collect()
        })
        .unwrap_or_default();
    Ok(PublishStatus {
        status: status.to_owned(),
        fail_reason,
        post_ids,
    })
}

pub async fn fetch_status(token: &Secret, publish_id: &str) -> CommandResult<PublishStatus> {
    let data = post_json(STATUS_URL, token, &json!({ "publish_id": publish_id })).await?;
    parse_status(&data)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request() -> PostRequest {
        PostRequest {
            file_path: "C:\\v.mp4".into(),
            caption: "Olá #teste".into(),
            privacy_level: "SELF_ONLY".into(),
            allow_comment: true,
            allow_duet: false,
            allow_stitch: false,
            your_brand: false,
            branded_content: false,
        }
    }

    #[test]
    fn arquivo_ate_64_mb_vai_inteiro() {
        assert_eq!(
            plan_chunks(4_194_304).unwrap(),
            ChunkPlan {
                chunk_size: 4_194_304,
                chunks: vec![Chunk {
                    start: 0,
                    end: 4_194_303
                }],
            }
        );
        assert_eq!(
            plan_chunks(SINGLE_UPLOAD_MAX_BYTES).unwrap().chunks.len(),
            1
        );
        assert!(plan_chunks(0).is_err());
    }

    #[test]
    fn arquivo_grande_usa_floor_e_a_ultima_parte_absorve_o_resto() {
        let size = 3 * CHUNK_BYTES + 123;
        let plan = plan_chunks(size).unwrap();
        assert_eq!(plan.chunk_size, CHUNK_BYTES);
        assert_eq!(plan.chunks.len(), 3);
        assert_eq!(
            plan.chunks[2],
            Chunk {
                start: 2 * CHUNK_BYTES,
                end: size - 1
            }
        );
        // Partes contíguas, sem buracos nem sobreposição.
        for pair in plan.chunks.windows(2) {
            assert_eq!(pair[0].end + 1, pair[1].start);
        }
        // Última parte: entre 32 MB e 64 MB (o TikTok aceita até 128 MB).
        let last = plan.chunks[2].end - plan.chunks[2].start + 1;
        assert!((CHUNK_BYTES..2 * CHUNK_BYTES).contains(&last));
    }

    #[test]
    fn respeita_os_limites_do_tiktok() {
        let plan = plan_chunks(SINGLE_UPLOAD_MAX_BYTES + 1).unwrap();
        assert_eq!(plan.chunks.len(), 2);
        assert!(plan_chunks(MAX_VIDEO_BYTES + 1).is_err());
        assert!(plan_chunks(MAX_VIDEO_BYTES).unwrap().chunks.len() <= 1000);
    }

    #[test]
    fn monta_o_init_com_as_escolhas_do_usuario() {
        let plan = plan_chunks(10).unwrap();
        let body = init_body(&request(), 10, &plan);
        assert_eq!(body["post_info"]["privacy_level"], "SELF_ONLY");
        assert_eq!(body["post_info"]["disable_comment"], false);
        assert_eq!(body["post_info"]["disable_duet"], true);
        assert_eq!(body["post_info"]["brand_content_toggle"], false);
        assert_eq!(body["source_info"]["source"], "FILE_UPLOAD");
        assert_eq!(body["source_info"]["total_chunk_count"], 1);
    }

    #[test]
    fn valida_as_escolhas() {
        assert!(validate_request(&request()).is_ok());
        let mut bad = request();
        bad.privacy_level = "QUALQUER".into();
        assert!(validate_request(&bad).is_err());
        let mut branded_private = request();
        branded_private.branded_content = true;
        assert!(validate_request(&branded_private).is_err());
        let mut long = request();
        long.caption = "a".repeat(2201);
        assert!(validate_request(&long).is_err());
    }

    #[test]
    fn le_init_e_status() {
        let init = parse_init(
            &json!({"publish_id":"v_pub_1","upload_url":"https://open-upload.tiktokapis.com/x"}),
        )
        .unwrap();
        assert_eq!(init.publish_id, "v_pub_1");
        assert!(parse_init(&json!({"publish_id":"v","upload_url":"http://inseguro"})).is_err());

        let status = parse_status(&json!({
            "status":"PUBLISH_COMPLETE","publicaly_available_post_id":[7_123_456_789_012_345_678_u64]
        }))
        .unwrap();
        assert_eq!(status.post_ids, ["7123456789012345678"]);
        let failed =
            parse_status(&json!({"status":"FAILED","fail_reason":"duration_check_failed"}))
                .unwrap();
        assert_eq!(failed.fail_reason.as_deref(), Some("duration_check_failed"));
        assert!(parse_status(&json!({"status":"OUTRO"})).is_err());
    }

    #[test]
    fn mapeia_erros_da_publicacao() {
        assert_eq!(
            map_publish_error("unaudited_client_can_only_post_to_private_accounts").code,
            "TIKTOK_CANNOT_POST"
        );
        assert_eq!(
            map_publish_error("privacy_level_option_mismatch").code,
            "TIKTOK_CANNOT_POST"
        );
        assert_eq!(
            map_publish_error("invalid_param").code,
            "TIKTOK_VIDEO_INVALID"
        );
        assert_eq!(
            map_publish_error("access_token_invalid").code,
            "TIKTOK_AUTH_EXPIRED"
        );
        assert_eq!(mime_type("mov"), "video/quicktime");
    }
}
