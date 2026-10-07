import { isTauri } from '@tauri-apps/api/core';

/**
 * - `desktop`: rodando dentro do Tauri (SQLite em arquivo, diálogos nativos).
 * - `preview`: rodando no navegador via `npm run dev` (SQLite WASM em memória + dados de demonstração).
 */
export type RuntimeMode = 'desktop' | 'preview';

export function detectRuntimeMode(): RuntimeMode {
  return isTauri() ? 'desktop' : 'preview';
}

export const APP_NAME = 'Social Manager';
export const APP_VERSION = __APP_VERSION__;
