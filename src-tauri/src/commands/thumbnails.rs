use std::path::PathBuf;

use tauri::ipc::{InvokeBody, Request};
use tauri::{AppHandle, Manager};

use crate::error::{CommandError, CommandResult};

/// Subpasta do diretório de dados do app. Precisa bater com o escopo do asset protocol
/// em tauri.conf.json (`$APPDATA/thumbnails/*`).
const THUMBNAILS_DIR: &str = "thumbnails";
const MAX_THUMBNAIL_BYTES: usize = 2 * 1024 * 1024;
const MAX_MEDIA_ID_LENGTH: usize = 64;
const JPEG_MAGIC: [u8; 3] = [0xFF, 0xD8, 0xFF];

/// Grava a miniatura (JPEG gerado no webview) de uma mídia e devolve o caminho absoluto.
///
/// Recebe os bytes como corpo binário do IPC e o id da mídia no header `media-id`.
/// O nome do arquivo é derivado apenas do id validado — nunca de um caminho vindo do webview.
#[tauri::command]
pub async fn save_thumbnail(app: AppHandle, request: Request<'_>) -> CommandResult<String> {
    let media_id = request
        .headers()
        .get("media-id")
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| CommandError::new("INVALID_INPUT", "Id da mídia ausente."))?;
    validate_media_id(media_id)?;

    let InvokeBody::Raw(bytes) = request.body() else {
        return Err(CommandError::new(
            "INVALID_INPUT",
            "A miniatura deve ser enviada como dados binários.",
        ));
    };
    validate_jpeg(bytes)?;

    let dir = thumbnails_dir(&app)?;
    std::fs::create_dir_all(&dir).map_err(|_| io_error())?;
    let path = dir.join(format!("{media_id}.jpg"));
    std::fs::write(&path, bytes).map_err(|_| io_error())?;

    Ok(path.to_string_lossy().into_owned())
}

/// Remove a miniatura de uma mídia (sem erro se ela não existir).
#[tauri::command]
pub async fn delete_thumbnail(app: AppHandle, media_id: String) -> CommandResult<()> {
    validate_media_id(&media_id)?;
    let path = thumbnails_dir(&app)?.join(format!("{media_id}.jpg"));
    match std::fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err(io_error()),
    }
}

fn thumbnails_dir(app: &AppHandle) -> CommandResult<PathBuf> {
    app.path()
        .app_data_dir()
        .map(|dir| dir.join(THUMBNAILS_DIR))
        .map_err(|_| CommandError::new("IO_ERROR", "Pasta de dados do app indisponível."))
}

fn io_error() -> CommandError {
    CommandError::new("IO_ERROR", "Não foi possível gravar a miniatura.")
}

/// Ids são UUIDs ou ids de demonstração (`demo-media-01`): só letras, números e hífen.
fn validate_media_id(media_id: &str) -> CommandResult<()> {
    let valid = !media_id.is_empty()
        && media_id.len() <= MAX_MEDIA_ID_LENGTH
        && media_id
            .chars()
            .all(|char| char.is_ascii_alphanumeric() || char == '-');
    if valid {
        Ok(())
    } else {
        Err(CommandError::new("INVALID_INPUT", "Id de mídia inválido."))
    }
}

fn validate_jpeg(bytes: &[u8]) -> CommandResult<()> {
    if bytes.len() > MAX_THUMBNAIL_BYTES {
        return Err(CommandError::new(
            "INVALID_INPUT",
            "Miniatura maior que o permitido.",
        ));
    }
    if !bytes.starts_with(&JPEG_MAGIC) {
        return Err(CommandError::new(
            "INVALID_INPUT",
            "A miniatura precisa ser um JPEG.",
        ));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_uuid_and_demo_ids() {
        assert!(validate_media_id("0e6c3ea6-51a8-437c-bbc3-ecb92c0fcd98").is_ok());
        assert!(validate_media_id("demo-media-01").is_ok());
    }

    #[test]
    fn rejects_ids_that_could_escape_the_folder() {
        for id in ["", "../evil", "a/b", "a\\b", "x.jpg", &"a".repeat(65)] {
            assert_eq!(
                validate_media_id(id).unwrap_err().code,
                "INVALID_INPUT",
                "{id}"
            );
        }
    }

    #[test]
    fn accepts_only_small_jpegs() {
        assert!(validate_jpeg(&[0xFF, 0xD8, 0xFF, 0xE0, 0x00]).is_ok());
        assert!(validate_jpeg(b"\x89PNG\r\n").is_err());
        assert!(validate_jpeg(&[]).is_err());

        let mut big = vec![0u8; MAX_THUMBNAIL_BYTES + 1];
        big[..3].copy_from_slice(&JPEG_MAGIC);
        assert!(validate_jpeg(&big).is_err());
    }
}
