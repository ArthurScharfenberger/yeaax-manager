import type { Id } from '@/types';

/** Gera um id único (UUID v4) para novas entidades. */
export function createId(): Id {
  return crypto.randomUUID();
}
