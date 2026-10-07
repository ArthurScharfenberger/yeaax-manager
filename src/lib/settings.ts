import type { z } from 'zod';

/**
 * Definição tipada de uma configuração persistida em `app_settings`.
 * Cada feature declara as suas próximas ao código que as usa.
 */
export interface SettingDefinition<T> {
  key: string;
  schema: z.ZodType<T>;
  defaultValue: T;
}

export function defineSetting<T>(
  key: string,
  schema: z.ZodType<T>,
  defaultValue: T,
): SettingDefinition<T> {
  return { key, schema, defaultValue };
}
