import type { RuntimeMode } from '@/lib/runtime';
import type { TikTokPrivacyLevel } from '@/types';

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
  /**
   * TikTok — Login Kit Desktop + PKCE (DEC-027). O Rust abre a autorização no navegador, recebe o callback em
   * `127.0.0.1` e troca o code pelo backend. Devolve só dados públicos e um id de conexão **pendente**: nada é
   * gravado no cofre até `tiktokCommitConnection` (conexão em duas fases). Tokens nunca chegam aqui.
   */
  tiktokConnect(): Promise<TikTokPendingConnection>;
  /** Cancela o login em andamento (fecha o listener local). */
  tiktokCancelConnect(): Promise<void>;
  /** Grava no cofre as credenciais da conexão pendente para o canal já salvo no banco. */
  tiktokCommitConnection(connectionId: string, channelId: string): Promise<void>;
  /** Descarta a conexão pendente sem gravar nada. */
  tiktokDiscardConnection(connectionId: string): Promise<void>;
  /** Perfil atual da conta do canal (renova o token no Rust se preciso). */
  tiktokGetProfile(channelId: string): Promise<TikTokAccount>;
  /** Revoga (melhor esforço) e apaga as credenciais do canal. */
  tiktokDisconnect(channelId: string): Promise<void>;
  /** `creator_info` da conta do canal: o que ela pode publicar agora (privacidade, interações, duração). */
  tiktokCreatorInfo(channelId: string): Promise<TikTokCreatorInfo>;
  /** Abre no navegador do sistema uma política oficial do TikTok (lista fixa no Rust). */
  openTikTokPolicy(policy: TikTokPolicy): Promise<void>;
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

/** Dados públicos de uma conta do TikTok (nunca tokens). */
export interface TikTokAccount {
  openId: string;
  username: string | null;
  displayName: string;
  avatarUrl: string | null;
  scopes: string[];
}

export interface TikTokCreatorInfo {
  nickname: string;
  username: string | null;
  avatarUrl: string | null;
  privacyLevelOptions: TikTokPrivacyLevel[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxVideoPostDurationSec: number | null;
}

/** Políticas linkadas na declaração antes de publicar (Content Sharing Guidelines). */
export const TIKTOK_POLICIES = ['music_usage', 'branded_content'] as const;
export type TikTokPolicy = (typeof TIKTOK_POLICIES)[number];

export interface TikTokPendingConnection {
  /** Id opaco, de uso único, válido por 5 minutos dentro do processo do app. Não é credencial do TikTok. */
  connectionId: string;
  account: TikTokAccount;
}

export interface FfmpegStatus {
  available: boolean;
  version: string | null;
}
