import type { IsoDateString } from '@/types';

import type { DbClient } from '../client';

interface SettingRow {
  key: string;
  value: string;
}

/**
 * Armazenamento chave/valor (valor em JSON). A validação dos valores fica no
 * `settingsService`, que conhece o schema de cada configuração.
 * Nunca guarde tokens ou segredos aqui (ver docs/SECURITY.md).
 */
export function createSettingsRepository(db: DbClient) {
  return {
    async get(key: string): Promise<string | null> {
      const rows = await db.select<SettingRow>(
        'SELECT key, value FROM app_settings WHERE key = ?',
        [key],
      );
      return rows[0]?.value ?? null;
    },

    async set(key: string, value: string, updatedAt: IsoDateString): Promise<void> {
      await db.execute(
        `INSERT INTO app_settings (key, value, updated_at) VALUES (?, ?, ?)
           ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [key, value, updatedAt],
      );
    },

    async delete(key: string): Promise<void> {
      await db.execute('DELETE FROM app_settings WHERE key = ?', [key]);
    },
  };
}

export type SettingsRepository = ReturnType<typeof createSettingsRepository>;
