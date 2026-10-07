/** Prefixo de id de todos os registros de demonstração (ver src/db/demoData.ts). */
export const DEMO_ID_PREFIX = 'demo-';

/** Prefixo dos caminhos fictícios das mídias de demonstração (não existem em disco). */
export const DEMO_MEDIA_PATH_PREFIX = 'demo://';

export function isDemoMediaPath(path: string): boolean {
  return path.startsWith(DEMO_MEDIA_PATH_PREFIX);
}
