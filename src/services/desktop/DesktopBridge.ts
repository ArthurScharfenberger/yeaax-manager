import type { RuntimeMode } from '@/lib/runtime';

/**
 * Recursos do sistema operacional usados pelo app (diálogos, arquivos, ferramentas).
 * Isola o Tauri do restante do código: features dependem desta interface, nunca de
 * `@tauri-apps/*` diretamente.
 */
export interface DesktopBridge {
  readonly mode: RuntimeMode;

  /** Abre o seletor nativo de vídeos. Retorna caminhos absolutos (vazio se cancelado). */
  pickVideoFiles(): Promise<string[]>;
  /** Valida o arquivo no lado nativo e devolve metadados básicos. */
  inspectMediaFile(path: string): Promise<MediaFileInfo>;
  detectFfmpeg(): Promise<FfmpegStatus>;
  /** Pasta onde o banco local é salvo (`null` no modo preview). */
  getDataDirectory(): Promise<string | null>;
  /**
   * URL para exibir um arquivo local no webview. Só funciona para arquivos autorizados
   * (via `inspectMediaFile`) na sessão atual.
   */
  toAssetUrl(path: string): string | null;
}

export interface MediaFileInfo {
  path: string;
  fileName: string;
  extension: string;
  size: number;
}

export interface FfmpegStatus {
  available: boolean;
  version: string | null;
}
