use std::path::Path;

use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::error::{CommandError, CommandResult};

/// Extensões aceitas na importação.
/// Manter em sincronia com `SUPPORTED_VIDEO_EXTENSIONS` em src/features/media/mediaRules.ts.
const SUPPORTED_VIDEO_EXTENSIONS: [&str; 3] = ["mp4", "mov", "webm"];

#[derive(Debug, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct MediaFileInfo {
    pub path: String,
    pub file_name: String,
    pub extension: String,
    pub size: u64,
}

/// Valida um arquivo de vídeo escolhido pelo usuário e devolve seus metadados básicos.
///
/// Também autoriza **somente este arquivo** no protocolo `asset:` para que o webview
/// consiga ler metadados de duração/resolução. A autorização não persiste entre execuções.
#[tauri::command]
pub async fn inspect_media_file(app: AppHandle, path: String) -> CommandResult<MediaFileInfo> {
    let info = inspect(Path::new(&path))?;

    app.asset_protocol_scope()
        .allow_file(&info.path)
        .map_err(|_| {
            CommandError::new(
                "SCOPE_ERROR",
                "Não foi possível autorizar a leitura do arquivo.",
            )
        })?;

    Ok(info)
}

fn inspect(path: &Path) -> CommandResult<MediaFileInfo> {
    if !path.is_absolute() {
        return Err(CommandError::new(
            "INVALID_PATH",
            "O caminho do arquivo precisa ser absoluto.",
        ));
    }

    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(str::to_ascii_lowercase)
        .ok_or_else(|| CommandError::new("UNSUPPORTED_FILE", "Arquivo sem extensão."))?;

    if !SUPPORTED_VIDEO_EXTENSIONS.contains(&extension.as_str()) {
        return Err(CommandError::new(
            "UNSUPPORTED_FILE",
            format!("Formato .{extension} não suportado. Use .mp4, .mov ou .webm."),
        ));
    }

    let metadata = std::fs::metadata(path).map_err(|_| {
        CommandError::new(
            "FILE_NOT_FOUND",
            "Arquivo não encontrado ou sem permissão de leitura.",
        )
    })?;

    if !metadata.is_file() {
        return Err(CommandError::new(
            "INVALID_PATH",
            "O caminho não aponta para um arquivo.",
        ));
    }

    if metadata.len() == 0 {
        return Err(CommandError::new("EMPTY_FILE", "O arquivo está vazio."));
    }

    let file_name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| CommandError::new("INVALID_PATH", "Nome de arquivo inválido."))?
        .to_owned();

    Ok(MediaFileInfo {
        path: path.to_string_lossy().into_owned(),
        file_name,
        extension,
        size: metadata.len(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_file(name: &str, contents: &[u8]) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join("social-manager-tests");
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join(name);
        fs::write(&path, contents).unwrap();
        path
    }

    #[test]
    fn accepts_supported_video() {
        let path = temp_file("clip.MP4", b"fake");
        let info = inspect(&path).unwrap();
        assert_eq!(info.extension, "mp4");
        assert_eq!(info.size, 4);
        assert_eq!(info.file_name, "clip.MP4");
    }

    #[test]
    fn rejects_unsupported_extension() {
        let path = temp_file("notes.txt", b"hello");
        assert_eq!(inspect(&path).unwrap_err().code, "UNSUPPORTED_FILE");
    }

    #[test]
    fn rejects_empty_file() {
        let path = temp_file("empty.webm", b"");
        assert_eq!(inspect(&path).unwrap_err().code, "EMPTY_FILE");
    }

    #[test]
    fn rejects_relative_path() {
        assert_eq!(
            inspect(Path::new("video.mp4")).unwrap_err().code,
            "INVALID_PATH"
        );
    }

    #[test]
    fn rejects_missing_file() {
        let path = std::env::temp_dir()
            .join("social-manager-tests")
            .join("missing.mov");
        assert_eq!(inspect(&path).unwrap_err().code, "FILE_NOT_FOUND");
    }
}
