import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

import type { DbClient } from './client';
import { SQL_MIGRATIONS } from './migrations';

/**
 * Banco SQLite em memória (WASM) para o modo preview no navegador (`npm run dev`).
 * Os dados somem ao recarregar a página — serve para desenvolver a UI sem o Tauri.
 * Carregado apenas em desenvolvimento (ver src/app/bootstrap.ts).
 */
export async function createPreviewDbClient(): Promise<DbClient> {
  const sqlite3 = await sqlite3InitModule();
  const db = new sqlite3.oo1.DB(':memory:', 'c');

  db.exec('PRAGMA foreign_keys = ON;');
  for (const migration of SQL_MIGRATIONS) {
    db.exec(migration.sql);
  }

  return {
    select: <TRow extends object>(sql: string, params: readonly (string | number | null)[] = []) =>
      Promise.resolve(
        db.exec({
          sql,
          ...(params.length > 0 ? { bind: [...params] } : {}),
          rowMode: 'object',
          returnValue: 'resultRows',
        }) as unknown as TRow[],
      ),
    execute(sql, params = []) {
      db.exec({ sql, ...(params.length > 0 ? { bind: [...params] } : {}) });
      return Promise.resolve({ rowsAffected: db.changes() });
    },
  };
}
