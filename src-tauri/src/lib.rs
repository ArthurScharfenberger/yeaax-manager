//! Núcleo desktop do Social Manager.
//!
//! O Rust fica restrito a responsabilidades de sistema: banco SQLite (plugin SQL +
//! migrations), diálogos nativos, inspeção de arquivos locais e detecção de ferramentas
//! externas. Regras de negócio vivem no TypeScript — ver docs/ARCHITECTURE.md.

mod commands;
mod error;
mod migrations;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(migrations::DATABASE_URL, migrations::all())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            commands::media::inspect_media_file,
            commands::system::detect_ffmpeg,
        ])
        .run(tauri::generate_context!())
        .expect("falha ao iniciar o Social Manager");
}
