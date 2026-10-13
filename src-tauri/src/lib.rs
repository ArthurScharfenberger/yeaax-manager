//! Núcleo desktop do Yeaax Manager (nome exibido; identificador `com.socialmanager.desktop` — DEC-025).
//!
//! O Rust fica restrito a responsabilidades de sistema: banco SQLite (plugin SQL +
//! migrations), diálogos nativos, inspeção de arquivos locais, detecção de ferramentas
//! externas, cofre de credenciais e chamadas autenticadas à OpenAI (a chave nunca vai
//! ao webview). Regras de negócio vivem no TypeScript — ver docs/ARCHITECTURE.md.

mod commands;
mod error;
mod migrations;
mod tiktok;

use tauri_plugin_log::{log::LevelFilter, RotationStrategy, Target, TargetKind};

/// Tamanho máximo de cada arquivo de log antes de rotacionar (5 MB).
const MAX_LOG_FILE_BYTES: u128 = 5 * 1024 * 1024;
/// Arquivos antigos mantidos após a rotação.
const KEPT_LOG_FILES: usize = 5;

/// Logs em `%LOCALAPPDATA%\com.socialmanager.desktop\logs\social-manager.log` (pasta de log do app).
/// O frontend já envia as mensagens com dados sensíveis redigidos (src/lib/logger.ts).
fn log_plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
    let level = if cfg!(debug_assertions) {
        LevelFilter::Debug
    } else {
        LevelFilter::Info
    };
    tauri_plugin_log::Builder::new()
        .clear_targets()
        .target(Target::new(TargetKind::LogDir {
            file_name: Some("social-manager".into()),
        }))
        .target(Target::new(TargetKind::Stdout))
        .level(level)
        .max_file_size(MAX_LOG_FILE_BYTES)
        .rotation_strategy(RotationStrategy::KeepSome(KEPT_LOG_FILES))
        .build()
}

pub fn run() {
    tauri::Builder::default()
        .plugin(log_plugin())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(migrations::DATABASE_URL, migrations::all())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            commands::media::inspect_media_file,
            commands::system::detect_ffmpeg,
            commands::thumbnails::save_thumbnail,
            commands::thumbnails::delete_thumbnail,
            commands::secrets::secret_set,
            commands::secrets::secret_has,
            commands::secrets::secret_delete,
            commands::ai::ai_chat_completion,
            commands::tiktok::tiktok_connect,
            commands::tiktok::tiktok_cancel_connect,
            commands::tiktok::tiktok_commit_connection,
            commands::tiktok::tiktok_discard_connection,
            commands::tiktok::tiktok_get_profile,
            commands::tiktok::tiktok_disconnect,
        ])
        .run(tauri::generate_context!())
        .expect("falha ao iniciar o Yeaax Manager");
}
