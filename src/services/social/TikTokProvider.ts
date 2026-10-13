import { AppError } from '@/lib/errors';
import type { IntegrationStatus } from '@/lib/integrations';
import { PLATFORM_INFO, type PlatformLimits } from '@/lib/platforms';
import type { DesktopBridge } from '@/services/desktop/DesktopBridge';

import type {
  AnalyticsResult,
  ConnectResult,
  ProviderCapabilities,
  PublicationStatusResult,
  PublishResult,
  SocialAccountRef,
  SocialProfile,
  SocialProvider,
} from './SocialProvider';

const PUBLISH_NOT_READY = 'A publicação no TikTok ainda não foi implementada (etapa 6).';

/**
 * Integração real com o TikTok — Login Kit Desktop + PKCE (DEC-027).
 *
 * Status: IN_PROGRESS — conexão, perfil e desconexão reais; publicação ainda não. Todo o OAuth e as chamadas
 * autenticadas acontecem no Rust (`DesktopBridge.tiktok*`); este provider nunca vê tokens. No modo preview o
 * registro usa o `MockSocialProvider` no lugar desta classe.
 */
export class TikTokProvider implements SocialProvider {
  readonly platform = 'tiktok' as const;
  readonly integrationStatus: IntegrationStatus = 'IN_PROGRESS';
  readonly limits: PlatformLimits = PLATFORM_INFO.tiktok.limits;
  readonly capabilities: ProviderCapabilities = {
    publishVideo: false,
    nativeScheduling: false,
    analytics: false,
  };

  private readonly desktop: DesktopBridge;

  constructor(desktop: DesktopBridge) {
    this.desktop = desktop;
  }

  /** Abre a autorização oficial; as credenciais só são gravadas no `session.commit`. */
  async connect(): Promise<ConnectResult> {
    const { connectionId, account } = await this.desktop.tiktokConnect();
    if (!account.username) {
      await this.desktop.tiktokDiscardConnection(connectionId);
      throw new AppError(
        'TIKTOK_PROFILE',
        'O TikTok não informou o @ da conta. Conecte novamente e aceite a permissão de perfil.',
      );
    }
    return {
      profile: {
        username: account.username,
        displayName: account.displayName || account.username,
        // Imagens externas ficam bloqueadas pela CSP até a etapa 4 liberar o CDN do TikTok.
        avatarUrl: null,
      },
      session: {
        commit: (channelId) => this.desktop.tiktokCommitConnection(connectionId, channelId),
        discard: () => this.desktop.tiktokDiscardConnection(connectionId),
      },
    };
  }

  disconnect(account: SocialAccountRef): Promise<void> {
    return this.desktop.tiktokDisconnect(account.channelId);
  }

  async getProfile(account: SocialAccountRef): Promise<SocialProfile> {
    const profile = await this.desktop.tiktokGetProfile(account.channelId);
    return {
      username: profile.username ?? account.username,
      displayName: profile.displayName || account.username,
      avatarUrl: null,
    };
  }

  publish(): Promise<PublishResult> {
    return Promise.reject(new AppError('NOT_AVAILABLE', PUBLISH_NOT_READY));
  }

  getPublicationStatus(): Promise<PublicationStatusResult> {
    return Promise.reject(new AppError('NOT_AVAILABLE', PUBLISH_NOT_READY));
  }

  getAnalytics(): Promise<AnalyticsResult> {
    return Promise.resolve({
      available: false,
      reason: 'Analytics do TikTok ainda não conectado.',
    });
  }
}
