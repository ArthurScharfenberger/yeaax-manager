/**
 * Migrations SQL para os ambientes sem Tauri (preview no navegador e testes).
 *
 * A fonte da verdade são os arquivos em src-tauri/migrations/*.sql — os mesmos que o
 * Rust embute com `include_str!`. No app desktop quem aplica é o tauri-plugin-sql.
 */
const migrationFiles = import.meta.glob<string>('../../src-tauri/migrations/*.sql', {
  query: '?raw',
  import: 'default',
  eager: true,
});

export interface SqlMigration {
  version: number;
  name: string;
  sql: string;
}

function parseMigration(path: string, sql: string): SqlMigration {
  const fileName = path.split('/').pop() ?? path;
  const match = /^(\d+)_(.+)\.sql$/.exec(fileName);
  if (!match) throw new Error(`Nome de migration inválido: ${fileName}`);
  return { version: Number(match[1]), name: match[2] ?? fileName, sql };
}

export const SQL_MIGRATIONS: readonly SqlMigration[] = Object.entries(migrationFiles)
  .map(([path, sql]) => parseMigration(path, sql))
  .sort((a, b) => a.version - b.version);
