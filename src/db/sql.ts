import type { z } from 'zod';

import { AppError } from '@/lib/errors';

import type { SqlValue } from './client';

/** `placeholders(3)` → `?, ?, ?` */
export function placeholders(count: number): string {
  return Array.from({ length: count }, () => '?').join(', ');
}

/** Escapa `%`, `_` e `\` para uso em `LIKE ... ESCAPE '\'`. */
export function toLikePattern(term: string): string {
  return `%${term.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/**
 * Monta `col = ?, col2 = ?` a partir de um patch parcial.
 * Os nomes de coluna vêm de um mapa fixo — nunca de entrada do usuário.
 */
export function buildSetClause<TPatch extends { [K in keyof TPatch]: SqlValue | undefined }>(
  patch: TPatch,
  columns: Record<keyof TPatch, string>,
): { clause: string; params: SqlValue[] } {
  const assignments: string[] = [];
  const params: SqlValue[] = [];

  for (const key of Object.keys(columns) as (keyof TPatch)[]) {
    const value = patch[key];
    if (value === undefined) continue;
    assignments.push(`${columns[key]} = ?`);
    params.push(value);
  }

  return { clause: assignments.join(', '), params };
}

/** Valida um enum lido do banco. Valores desconhecidos indicam dado corrompido ou migration faltando. */
export function parseEnum<T extends string>(
  schema: z.ZodType<T>,
  value: unknown,
  field: string,
): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new AppError('DATA_INTEGRITY', `Valor inesperado no banco (${field}).`, {
      details: { field, value },
    });
  }
  return result.data;
}
