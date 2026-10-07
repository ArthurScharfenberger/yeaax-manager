import { z } from 'zod';

import type { Repositories } from '@/db/repositories';
import type { Clock } from '@/lib/clock';
import { logger } from '@/lib/logger';
import { defineSetting, type SettingDefinition } from '@/lib/settings';

/** Configurações gerais. Configurações de features ficam junto delas (ex.: automação). */
export const WEEK_STARTS_ON_SETTING = defineSetting(
  'general.weekStartsOn',
  z.enum(['monday', 'sunday']),
  'monday',
);

interface SettingsServiceDeps {
  repositories: Pick<Repositories, 'settings'>;
  clock: Clock;
}

export function createSettingsService({ repositories, clock }: SettingsServiceDeps) {
  const { settings } = repositories;

  return {
    /** Lê e valida. Valores ausentes ou inválidos voltam ao padrão (com aviso no log). */
    async get<T>(definition: SettingDefinition<T>): Promise<T> {
      const raw = await settings.get(definition.key);
      if (raw === null) return definition.defaultValue;

      try {
        const parsed = definition.schema.safeParse(JSON.parse(raw));
        if (parsed.success) return parsed.data;
        logger.warn('Configuração inválida; usando padrão', { key: definition.key });
      } catch (error) {
        logger.warn('Configuração corrompida; usando padrão', { key: definition.key, error });
      }
      return definition.defaultValue;
    },

    async set<T>(definition: SettingDefinition<T>, value: T): Promise<T> {
      const parsed = definition.schema.parse(value);
      await settings.set(definition.key, JSON.stringify(parsed), clock.now().toISOString());
      return parsed;
    },

    async reset<T>(definition: SettingDefinition<T>): Promise<T> {
      await settings.delete(definition.key);
      return definition.defaultValue;
    },
  };
}

export type SettingsService = ReturnType<typeof createSettingsService>;
