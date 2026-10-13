import type { IntegrationStatus } from '@/lib/integrations';
import type { PlatformLimits } from '@/lib/platforms';
import type { Id, IsoDateString, Platform, PlatformOptions, TikTokPrivacyLevel } from '@/types';

/**
 * Contrato comum para integrações com redes sociais.
 *
 * O restante do app conhece apenas esta interface — nunca detalhes das APIs do
 * TikTok/Instagram. Regras para implementações reais (ver docs/INTEGRATIONS.md e
 * docs/SECURITY.md):
 *  - apenas APIs oficiais; nada de scraping, automação de navegador ou endpoints não oficiais;
 *  - tokens e client secrets nunca chegam ao frontend: OAuth e chamadas autenticadas
 *    ficarão no lado Rust, com tokens no Credential Manager do sistema;
 *  - toda resposta externa é não confiável e deve ser validada (Zod) antes de uso.
 */
export interface SocialProvider {
  readonly platform: Platform;
  readonly integrationStatus: IntegrationStatus;
  readonly limits: PlatformLimits;
  readonly capabilities: ProviderCapabilities;

  /** Inicia o fluxo de autorização e devolve o perfil autenticado. */
  connect(request: ConnectRequest): Promise<ConnectResult>;
  /** Cancela uma autorização em andamento (só providers com login oficial). */
  cancelConnect?(): Promise<void>;
  /**
   * TikTok: o que a conta permite publicar agora (`creator_info`). Consultado sempre que o compositor abre, como
   * exigem as diretrizes. Ausente nas plataformas sem essa exigência.
   */
  getCreatorInfo?(account: SocialAccountRef): Promise<CreatorInfo>;
  /** Revoga/descarta a autorização local da conta. */
  disconnect(account: SocialAccountRef): Promise<void>;
  getProfile(account: SocialAccountRef): Promise<SocialProfile>;
  publish(request: PublishRequest): Promise<PublishResult>;
  getPublicationStatus(
    account: SocialAccountRef,
    externalPostId: string,
  ): Promise<PublicationStatusResult>;
  getAnalytics(account: SocialAccountRef, range: AnalyticsRange): Promise<AnalyticsResult>;
}

export interface ProviderCapabilities {
  /** Publica de verdade na plataforma (providers simulados: `false` — nunca marcam posts como publicados). */
  publishVideo: boolean;
  /** A plataforma aceita agendamento nativo (senão o app agenda localmente). */
  nativeScheduling: boolean;
  analytics: boolean;
  /**
   * Conexão pelo login oficial da plataforma (abre o navegador; a conta vem da plataforma, não do que o usuário
   * digita). `false` nos providers simulados.
   */
  officialLogin: boolean;
}

/** Referência a uma conta conectada, sem credenciais. */
export interface SocialAccountRef {
  channelId: Id;
  platform: Platform;
  username: string;
}

export interface SocialProfile {
  /** Id estável da conta na plataforma (open_id do TikTok); `null` nos providers simulados. */
  externalId: string | null;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

/** Dados públicos da conta para publicar no TikTok (nunca tokens). */
export interface CreatorInfo {
  nickname: string;
  username: string | null;
  avatarUrl: string | null;
  privacyOptions: TikTokPrivacyLevel[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxDurationSeconds: number | null;
}

export interface ConnectRequest {
  /** Usuário esperado (usado pelo mock; o OAuth real descobre o perfil sozinho). */
  usernameHint?: string;
  displayNameHint?: string;
}

/** Resultado da conexão. Não contém tokens — eles ficam no lado nativo. */
export interface ConnectResult {
  profile: SocialProfile;
  /**
   * Presente quando as credenciais ainda não foram gravadas (TikTok real — DEC-027). Quem chamou deve gravar o
   * canal no banco e então `commit(channelId)`; se algo falhar, desfazer o banco e `discard()`. Assim a conexão
   * nunca fica pela metade.
   */
  session?: ConnectionSession;
}

export interface ConnectionSession {
  commit(channelId: Id): Promise<void>;
  discard(): Promise<void>;
}

export interface PublishRequest {
  account: SocialAccountRef;
  postId: Id;
  caption: string;
  /** Escolhas da plataforma já validadas e consentidas (TikTok: privacidade, interações, divulgação). */
  options: PlatformOptions | null;
  onProgress?: (progress: PublishProgress) => void;
  media: {
    filePath: string;
    mimeType: string;
    durationSeconds: number | null;
  };
}

export type PublicationState = 'processing' | 'published' | 'failed';

/** Andamento do envio do vídeo (mostrado na interface). */
export type PublishProgress =
  | { stage: 'preparing' }
  | { stage: 'uploading'; sent: number; total: number }
  | { stage: 'processing' };

export interface PublishResult {
  externalPostId: string;
  state: PublicationState;
}

export interface PublicationStatusResult {
  externalPostId: string;
  /** Id público do post na plataforma, quando ela informa (TikTok: só posts públicos aprovados). */
  publicPostId?: string | null;
  state: PublicationState;
  publishedAt: IsoDateString | null;
  errorMessage: string | null;
}

export interface AnalyticsRange {
  from: IsoDateString;
  to: IsoDateString;
}

export type AnalyticsResult =
  | { available: false; reason: string }
  | {
      available: true;
      metrics: { views: number; likes: number; comments: number; shares: number };
    };
