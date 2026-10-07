import type { IntegrationStatus } from '@/lib/integrations';
import type { PlatformLimits } from '@/lib/platforms';
import type { Id, IsoDateString, Platform } from '@/types';

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
  publishVideo: boolean;
  /** A plataforma aceita agendamento nativo (senão o app agenda localmente). */
  nativeScheduling: boolean;
  analytics: boolean;
}

/** Referência a uma conta conectada, sem credenciais. */
export interface SocialAccountRef {
  channelId: Id;
  platform: Platform;
  username: string;
}

export interface SocialProfile {
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ConnectRequest {
  /** Usuário esperado (usado pelo mock; o OAuth real descobre o perfil sozinho). */
  usernameHint?: string;
  displayNameHint?: string;
}

/** Resultado da conexão. Não contém tokens — eles ficam no lado nativo. */
export interface ConnectResult {
  profile: SocialProfile;
}

export interface PublishRequest {
  account: SocialAccountRef;
  postId: Id;
  caption: string;
  media: {
    filePath: string;
    mimeType: string;
    durationSeconds: number | null;
  };
}

export type PublicationState = 'processing' | 'published' | 'failed';

export interface PublishResult {
  externalPostId: string;
  state: PublicationState;
}

export interface PublicationStatusResult {
  externalPostId: string;
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
