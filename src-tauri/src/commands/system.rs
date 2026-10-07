use std::process::{Command, Stdio};

use serde::Serialize;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FfmpegStatus {
    pub available: bool,
    pub version: Option<String>,
}

/// Verifica se o FFmpeg está disponível no PATH executando `ffmpeg -version`.
///
/// Executa fora da thread principal. Nenhum argumento vem do frontend.
#[tauri::command]
pub async fn detect_ffmpeg() -> FfmpegStatus {
    tauri::async_runtime::spawn_blocking(probe_ffmpeg)
        .await
        .unwrap_or(FfmpegStatus {
            available: false,
            version: None,
        })
}

fn probe_ffmpeg() -> FfmpegStatus {
    let mut command = Command::new("ffmpeg");
    command
        .arg("-version")
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());

    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // Evita abrir uma janela de console ao executar o processo filho.
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    match command.output() {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            FfmpegStatus {
                available: true,
                version: stdout.lines().next().map(|line| line.trim().to_owned()),
            }
        }
        _ => FfmpegStatus {
            available: false,
            version: None,
        },
    }
}
