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
  /** Grava a miniatura JPEG da mídia na pasta do app e devolve o caminho absoluto. */
  saveThumbnail(mediaId: string, jpeg: Uint8Array): Promise<string>;
  /** Remove a miniatura da mídia, se existir. */
  deleteThumbnail(mediaId: string): Promise<void>;
  /** Grava um segredo no Gerenciador de Credenciais do Windows. Não existe leitura do valor. */
  setSecret(name: SecretName, value: string): Promise<void>;
  hasSecret(name: SecretName): Promise<boolean>;
  deleteSecret(name: SecretName): Promise<void>;
  /**
   * Envia um pedido de Chat Completions à OpenAI pelo lado Rust, que anexa a chave do cofre.
   * Devolve a resposta crua (não confiável: valide com Zod).
   */
  aiChatCompletion(body: Record<string, unknown>): Promise<unknown>;
  /** Pasta onde o banco local é salvo (`null` no modo preview). */
  getDataDirectory(): Promise<string | null>;
  /** Pasta dos arquivos de log (`null` no modo preview). */
  getLogDirectory(): Promise<string | null>;
  /**
   * URL para exibir um arquivo local no webview. Funciona para a pasta de miniaturas do app
   * e para arquivos autorizados na sessão atual via `inspectMediaFile` (DEC-016).
   */
  toAssetUrl(path: string): string | null;
}

/** Segredos aceitos pelo cofre (lista fixa também no Rust: commands/secrets.rs). */
export const SECRET_NAMES = { openaiApiKey: 'openai_api_key' } as const;
export type SecretName = (typeof SECRET_NAMES)[keyof typeof SECRET_NAMES];

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
