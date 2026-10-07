import { AppError, isAppError } from '@/lib/errors';

/**
 * Contrato mínimo de acesso ao SQLite. Todos os repositórios dependem apenas disto.
 *
 * Implementações:
 *  - `tauriClient.ts`   → app desktop (tauri-plugin-sql, arquivo local);
 *  - `previewClient.ts` → navegador em desenvolvimento (SQLite WASM em memória);
 *  - `src/test/testDb.ts` → testes (node:sqlite em memória).
 *
 * Regras:
 *  - Use apenas placeholders posicionais `?` (compatíveis com os três drivers).
 *  - Não há transações entre chamadas: o plugin do Tauri usa um pool de conexões (DEC-008).
 */
export type SqlValue = string | number | null;

export interface ExecuteResult {
  rowsAffected: number;
}

export interface DbClient {
  // O tipo da linha é declarado por quem consulta; o driver não tem como validá-lo.
  select<TRow extends object>(sql: string, params?: readonly SqlValue[]): Promise<TRow[]>;
  execute(sql: string, params?: readonly SqlValue[]): Promise<ExecuteResult>;
}

function describeDriverError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return 'erro desconhecido do driver';
}

/** Traduz erros crus dos drivers SQLite em `AppError` com mensagem amigável. */
export function toDatabaseError(error: unknown): AppError {
  if (isAppError(error)) return error;
  const detail = describeDriverError(error);

  if (detail.includes('UNIQUE constraint failed')) {
    return new AppError('CONFLICT', 'Já existe um registro com estes dados.', { cause: error });
  }
  if (detail.includes('FOREIGN KEY constraint failed')) {
    return new AppError('CONFLICT', 'O registro está vinculado a outros dados.', { cause: error });
  }
  return new AppError('DATABASE', 'Falha ao acessar o banco de dados local.', { cause: error });
}

/** Envolve um cliente para padronizar erros, independentemente do driver. */
export function withErrorMapping(client: DbClient): DbClient {
  return {
    async select<TRow extends object>(sql: string, params?: readonly SqlValue[]) {
      try {
        return await client.select<TRow>(sql, params);
      } catch (error) {
        throw toDatabaseError(error);
      }
    },
    async execute(sql, params) {
      try {
        return await client.execute(sql, params);
      } catch (error) {
        throw toDatabaseError(error);
      }
    },
  };
}
