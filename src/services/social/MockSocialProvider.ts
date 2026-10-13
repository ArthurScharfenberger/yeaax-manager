import type { IntegrationStatus } from '@/lib/integrations';
import { PLATFORM_INFO, type PlatformLimits } from '@/lib/platforms';
import type { Platform } from '@/types';

import type {
  AnalyticsResult,
  ConnectRequest,
  ConnectResult,
  ProviderCapabilities,
  PublicationStatusResult,
  PublishRequest,
  PublishResult,
  SocialAccountRef,
  SocialProfile,
  SocialProvider,
} from './SocialProvider';

const DEFAULT_LATENCY_MS = 350;

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Implementação simulada e determinística de `SocialProvider`.
 * Não faz nenhuma chamada de rede. Serve para desenvolver a UI e os fluxos locais.
 */
export class MockSocialProvider implements SocialProvider {
  readonly platform: Platform;
  readonly integrationStatus: IntegrationStatus = 'MOCK';
  readonly limits: PlatformLimits;
  readonly capabilities: ProviderCapabilities = {
    publishVideo: true,
    nativeScheduling: false,
    analytics: false,
    officialLogin: false,
  };

  private readonly latencyMs: number;

  constructor(options: { platform: Platform; latencyMs?: number }) {
    this.platform = options.platform;
    this.limits = PLATFORM_INFO[options.platform].limits;
    this.latencyMs = options.latencyMs ?? DEFAULT_LATENCY_MS;
  }

  async connect(request: ConnectRequest): Promise<ConnectResult> {
    await wait(this.latencyMs);
    const username = request.usernameHint?.trim() || `${this.platform}_user`;
    return {
      profile: {
        externalId: null,
        username,
        displayName: request.displayNameHint?.trim() || username,
        avatarUrl: null,
      },
    };
  }

  async disconnect(_account: SocialAccountRef): Promise<void> {
    await wait(this.latencyMs);
  }

  async getProfile(account: SocialAccountRef): Promise<SocialProfile> {
    await wait(this.latencyMs);
    return {
      externalId: null,
      username: account.username,
      displayName: account.username,
      avatarUrl: null,
    };
  }

  async publish(request: PublishRequest): Promise<PublishResult> {
    await wait(this.latencyMs);
    return { externalPostId: `mock_${this.platform}_${request.postId}`, state: 'published' };
  }

  async getPublicationStatus(
    _account: SocialAccountRef,
    externalPostId: string,
  ): Promise<PublicationStatusResult> {
    await wait(this.latencyMs);
    return {
      externalPostId,
      state: 'published',
      publishedAt: new Date().toISOString(),
      errorMessage: null,
    };
  }

  async getAnalytics(): Promise<AnalyticsResult> {
    await wait(this.latencyMs);
    return { available: false, reason: 'Integração simulada: analytics ainda não conectado.' };
  }
}
