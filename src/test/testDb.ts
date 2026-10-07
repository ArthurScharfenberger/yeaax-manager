import { DatabaseSync } from 'node:sqlite';

import { type DbClient, withErrorMapping } from '@/db/client';
import { SQL_MIGRATIONS } from '@/db/migrations';
import { createRepositories, type Repositories } from '@/db/repositories';

/**
 * Banco SQLite real em memória (node:sqlite) com as mesmas migrations do app.
 * Permite testar repositórios e serviços sem Tauri.
 */
export function createTestDbClient(): DbClient {
  const db = new DatabaseSync(':memory:', { enableForeignKeyConstraints: true });
  for (const migration of SQL_MIGRATIONS) {
    db.exec(migration.sql);
  }

  return withErrorMapping({
    select: <TRow extends object>(sql: string, params: readonly (string | number | null)[] = []) =>
      Promise.resolve(db.prepare(sql).all(...params) as TRow[]),
    execute(sql, params = []) {
      const result = db.prepare(sql).run(...params);
      return Promise.resolve({ rowsAffected: Number(result.changes) });
    },
  });
}

export function createTestRepositories(): Repositories {
  return createRepositories(createTestDbClient());
}
