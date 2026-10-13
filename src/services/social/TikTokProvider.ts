import { AppError } from '@/lib/errors';
import type { IntegrationStatus } from '@/lib/integrations';
import { PLATFORM_INFO, type PlatformLimits } from '@/lib/platforms';
import type {
  DesktopBridge,
  TikTokAccount,
  TikTokPublishStatus,
} from '@/services/desktop/DesktopBridge';

import type {
  AnalyticsResult,
  ConnectResult,
  CreatorInfo,
  ProviderCapabilities,
  PublicationState,
  PublicationStatusResult,
  PublishRequest,
  PublishResult,
  SocialAccountRef,
  SocialProfile,
  SocialProvider,
} from './SocialProvider';

/** Motivos de falha do `status/fetch` traduzidos (docs/API_NOTES.md). */
const FAIL_REASON_MESSAGES: Record<string, string> = {
  file_format_check_failed:
    'O TikTok não aceitou o formato do arquivo. Use MP4 (H.264) se possível.',
  duration_check_failed: 'A duração do vídeo não é aceita pelo TikTok para esta conta.',
  frame_rate_check_failed: 'A taxa de quadros do vídeo não é aceita (use entre 23 e 60 fps).',
  picture_size_check_failed: 'A resolução do vídeo não é aceita (entre 360 e 4096 px).',
  internal: 'Erro interno do TikTok. Tente publicar de novo.',
  publish_cancelled: 'A publicação foi cancelada.',
  auth_removed: 'O acesso do app à conta foi removido no TikTok. Conecte a conta de novo.',
  spam_risk_too_many_posts: 'A conta atingiu o limite diário de publicações do TikTok.',
  spam_risk_user_banned_from_posting: 'O TikTok impediu esta conta de publicar.',
  spam_risk_text: 'O TikTok recusou o texto da legenda.',
  spam_risk: 'O TikTok recusou a publicação por risco de spam.',
};

export function failReasonMessage(reason: string | null): string {
  return (reason && FAIL_REASON_MESSAGES[reason]) ?? 'O TikTok não publicou o vídeo.';
}

/** Converte o status do TikTok no estado do app. */
export function toPublicationState(status: TikTokPublishStatus['status']): PublicationState {
  if (status === 'PUBLISH_COMPLETE') return 'published';
  if (status === 'FAILED') return 'failed';
  return 'processing';
}

/**
 * Avatares só dos CDNs do TikTok — os mesmos liberados no `img-src` da CSP (src-tauri/tauri.conf.json, DEC-028).
 * Outra origem vira `null` (iniciais), em vez de uma imagem bloqueada.
 */
const AVATAR_HOST = /(^|\.)tiktokcdn(-us)?\.com$/;

export function safeAvatarUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && AVATAR_HOST.test(parsed.hostname) ? url : null;
  } catch {
    return null;
  }
}

function toProfile(account: TikTokAccount, fallbackUsername: string): SocialProfile {
  const username = account.username ?? fallbackUsername;
  return {
    externalId: account.openId,
    username,
    displayName: account.displayName || username,
    avatarUrl: safeAvatarUrl(account.avatarUrl),
  };
}

/**
 * Integração real com o TikTok — Login Kit Desktop + PKCE (DEC-027).
 *
 * Status: IN_PROGRESS — conexão, perfil, `creator_info` e publicação (Direct Post) reais. Todo o OAuth e as chamadas
 * autenticadas acontecem no Rust (`DesktopBridge.tiktok*`); este provider nunca vê tokens. No modo preview o
 * registro usa o `MockSocialProvider` no lugar desta classe.
 */
export class TikTokProvider implements SocialProvider {
  readonly platform = 'tiktok' as const;
  readonly integrationStatus: IntegrationStatus = 'IN_PROGRESS';
  readonly limits: PlatformLimits = PLATFORM_INFO.tiktok.limits;
  readonly capabilities: ProviderCapabilities = {
    publishVideo: true,
    nativeScheduling: false,
    analytics: false,
    officialLogin: true,
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
      profile: toProfile(account, account.username),
      session: {
        commit: (channelId) => this.desktop.tiktokCommitConnection(connectionId, channelId),
        discard: () => this.desktop.tiktokDiscardConnection(connectionId),
      },
    };
  }

  cancelConnect(): Promise<void> {
    return this.desktop.tiktokCancelConnect();
  }

  disconnect(account: SocialAccountRef): Promise<void> {
    return this.desktop.tiktokDisconnect(account.channelId);
  }

  async getCreatorInfo(account: SocialAccountRef): Promise<CreatorInfo> {
    const info = await this.desktop.tiktokCreatorInfo(account.channelId);
    return {
      nickname: info.nickname,
      username: info.username,
      avatarUrl: safeAvatarUrl(info.avatarUrl),
      privacyOptions: info.privacyLevelOptions,
      commentDisabled: info.commentDisabled,
      duetDisabled: info.duetDisabled,
      stitchDisabled: info.stitchDisabled,
      maxDurationSeconds: info.maxVideoPostDurationSec,
    };
  }

  async getProfile(account: SocialAccountRef): Promise<SocialProfile> {
    return toProfile(await this.desktop.tiktokGetProfile(account.channelId), account.username);
  }

  /** Envia o vídeo (Direct Post). As escolhas já foram validadas e consentidas pelo publicador. */
  async publish(request: PublishRequest): Promise<PublishResult> {
    const options = request.options?.platform === 'tiktok' ? request.options : null;
    if (!options?.privacyLevel) {
      throw new AppError(
        'VALIDATION',
        'Defina a privacidade e as opções do TikTok antes de publicar.',
      );
    }
    const { publishId } = await this.desktop.tiktokPublish(
      request.account.channelId,
      {
        filePath: request.media.filePath,
        caption: request.caption,
        privacyLevel: options.privacyLevel,
        allowComment: options.allowComment,
        allowDuet: options.allowDuet,
        allowStitch: options.allowStitch,
        yourBrand: options.commercialContent && options.yourBrand,
        brandedContent: options.commercialContent && options.brandedContent,
      },
      (progress) => request.onProgress?.(progress),
    );
    return { externalPostId: publishId, state: 'processing' };
  }

  async getPublicationStatus(
    account: SocialAccountRef,
    externalPostId: string,
  ): Promise<PublicationStatusResult> {
    const result = await this.desktop.tiktokPublishStatus(account.channelId, externalPostId);
    const state = toPublicationState(result.status);
    return {
      // Mantém o publish_id: o id público só existe para posts públicos aprovados na moderação.
      externalPostId,
      publicPostId: result.postIds[0] ?? null,
      state,
      publishedAt: state === 'published' ? new Date().toISOString() : null,
      errorMessage: state === 'failed' ? failReasonMessage(result.failReason) : null,
    };
  }

  getAnalytics(): Promise<AnalyticsResult> {
    return Promise.resolve({
      available: false,
      reason: 'Analytics do TikTok ainda não conectado.',
    });
  }
}
