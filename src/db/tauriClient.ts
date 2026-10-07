import Database from '@tauri-apps/plugin-sql';

import type { DbClient } from './client';

/**
 * Precisa ser idêntica a `DATABASE_URL` em src-tauri/src/migrations.rs.
 * As migrations são aplicadas pelo plugin (lado Rust) ao carregar o banco.
 */
export const DATABASE_URL = 'sqlite:social-manager.db';

export const DATABASE_FILENAME = 'social-manager.db';

export async function createTauriDbClient(): Promise<DbClient> {
  const database = await Database.load(DATABASE_URL);

  return {
    select: <TRow extends object>(sql: string, params: readonly unknown[] = []) =>
      database.select<TRow[]>(sql, [...params]),
    async execute(sql, params = []) {
      const result = await database.execute(sql, [...params]);
      return { rowsAffected: result.rowsAffected };
    },
  };
}
