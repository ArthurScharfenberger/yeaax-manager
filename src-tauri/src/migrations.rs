use tauri_plugin_sql::{Migration, MigrationKind};

/// URL do banco local. Precisa ser idêntica a `DATABASE_URL` em src/db/tauriClient.ts.
///
/// O plugin resolve o caminho relativo ao diretório de configuração do app
/// (no Windows: `%APPDATA%\com.socialmanager.desktop\social-manager.db`).
pub const DATABASE_URL: &str = "sqlite:social-manager.db";

/// Migrations em ordem de versão. Os arquivos .sql também são lidos pelos testes e
/// pelo modo preview do frontend (src/db/migrations.ts), então ficam em `migrations/`.
///
/// Regra: nunca edite uma migration já distribuída — adicione uma nova versão.
pub fn all() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "initial_schema",
            sql: include_str!("../migrations/0001_initial_schema.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "channel_external_id",
            sql: include_str!("../migrations/0002_channel_external_id.sql"),
            kind: MigrationKind::Up,
        },
    ]
}
