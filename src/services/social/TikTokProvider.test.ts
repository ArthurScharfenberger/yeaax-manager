import { describe, expect, it } from 'vitest';

import type {
  DesktopBridge,
  TikTokAccount,
  TikTokPublishStatus,
} from '@/services/desktop/DesktopBridge';
import { emptyTikTokOptions } from '@/features/posts/tiktokOptionsRules';
import { createPreviewDesktopBridge } from '@/services/desktop/previewDesktopBridge';

import { createSocialProviders } from './index';
import { failReasonMessage, safeAvatarUrl, TikTokProvider } from './TikTokProvider';

const ACCOUNT: TikTokAccount = {
  openId: 'open-1',
  username: 'yeaxx',
  displayName: 'YEAXX Cars',
  avatarUrl: 'https://p16.tiktokcdn.com/a.jpg',
  scopes: ['user.info.basic', 'user.info.profile'],
};

function fakeDesktop(
  account: TikTokAccount = ACCOUNT,
  status: TikTokPublishStatus = { status: 'PUBLISH_COMPLETE', failReason: null, postIds: [] },
) {
  const calls: string[] = [];
  const desktop: DesktopBridge = {
    ...createPreviewDesktopBridge(),
    mode: 'desktop',
    tiktokConnect: () => {
      calls.push('connect');
      return Promise.resolve({ connectionId: 'pending-1', account });
    },
    tiktokCommitConnection: (connectionId, channelId) => {
      calls.push(`commit:${connectionId}:${channelId}`);
      return Promise.resolve();
    },
    tiktokDiscardConnection: (connectionId) => {
      calls.push(`discard:${connectionId}`);
      return Promise.resolve();
    },
    tiktokGetProfile: (channelId) => {
      calls.push(`profile:${channelId}`);
      return Promise.resolve(account);
    },
    tiktokDisconnect: (channelId) => {
      calls.push(`disconnect:${channelId}`);
      return Promise.resolve();
    },
    tiktokPublish: (channelId, request, onProgress) => {
      calls.push(`publish:${channelId}:${request.privacyLevel}:${String(request.brandedContent)}`);
      onProgress({ stage: 'uploading', sent: 10, total: 10 });
      return Promise.resolve({ publishId: 'v_pub_1' });
    },
    tiktokPublishStatus: (channelId, publishId) => {
      calls.push(`status:${channelId}:${publishId}`);
      return Promise.resolve(status);
    },
    tiktokCreatorInfo: (channelId) => {
      calls.push(`creator:${channelId}`);
      return Promise.resolve({
        nickname: 'yeaax',
        username: 'yeeax',
        avatarUrl: 'https://evil.example/a.jpg',
        privacyLevelOptions: ['FOLLOWER_OF_CREATOR', 'SELF_ONLY'],
        commentDisabled: false,
        duetDisabled: true,
        stitchDisabled: true,
        maxVideoPostDurationSec: 600,
      });
    },
  };
  return { desktop, calls };
}

const REF = { channelId: 'channel-1', platform: 'tiktok' as const, username: 'yeaxx' };

describe('TikTokProvider', () => {
  it('connect devolve o perfil e uma sessão ligada à conexão pendente', async () => {
    const { desktop, calls } = fakeDesktop();
    const result = await new TikTokProvider(desktop).connect();

    expect(result.profile).toEqual({
      externalId: 'open-1',
      username: 'yeaxx',
      displayName: 'YEAXX Cars',
      avatarUrl: 'https://p16.tiktokcdn.com/a.jpg',
    });
    await result.session?.commit('channel-1');
    await result.session?.discard();
    expect(calls).toEqual(['connect', 'commit:pending-1:channel-1', 'discard:pending-1']);
  });

  it('sem @ (permissão de perfil negada) descarta a conexão e falha', async () => {
    const { desktop, calls } = fakeDesktop({ ...ACCOUNT, username: null });
    await expect(new TikTokProvider(desktop).connect()).rejects.toMatchObject({
      code: 'TIKTOK_PROFILE',
    });
    expect(calls).toEqual(['connect', 'discard:pending-1']);
  });

  it('perfil, desconexão e publicação usam o id do canal', async () => {
    const { desktop, calls } = fakeDesktop();
    const provider = new TikTokProvider(desktop);
    await expect(provider.getProfile(REF)).resolves.toMatchObject({ username: 'yeaxx' });
    await provider.disconnect(REF);
    expect(calls).toEqual(['profile:channel-1', 'disconnect:channel-1']);
  });
});

describe('TikTokProvider — publicação', () => {
  const request = (options: ReturnType<typeof emptyTikTokOptions> | null) => ({
    account: REF,
    postId: 'post-1',
    caption: 'Olá',
    media: { filePath: 'C:\v.mp4', mimeType: 'video/mp4', durationSeconds: 10 },
    options,
  });

  it('envia com as escolhas do post e devolve o publish_id', async () => {
    const { desktop, calls } = fakeDesktop();
    const progress: unknown[] = [];
    const result = await new TikTokProvider(desktop).publish({
      ...request({
        ...emptyTikTokOptions(),
        privacyLevel: 'SELF_ONLY',
        brandedContent: true, // ignorado sem divulgação comercial ligada
      }),
      onProgress: (item) => progress.push(item),
    });
    expect(result).toEqual({ externalPostId: 'v_pub_1', state: 'processing' });
    expect(calls).toEqual(['publish:channel-1:SELF_ONLY:false']);
    expect(progress).toEqual([{ stage: 'uploading', sent: 10, total: 10 }]);
  });

  it('recusa publicar sem privacidade escolhida', async () => {
    const { desktop } = fakeDesktop();
    await expect(
      new TikTokProvider(desktop).publish(request(emptyTikTokOptions())),
    ).rejects.toMatchObject({ code: 'VALIDATION' });
    await expect(new TikTokProvider(desktop).publish(request(null))).rejects.toMatchObject({
      code: 'VALIDATION',
    });
  });

  it('traduz o status e o motivo da falha', async () => {
    const done = fakeDesktop(ACCOUNT, {
      status: 'PUBLISH_COMPLETE',
      failReason: null,
      postIds: ['7123'],
    });
    expect(
      await new TikTokProvider(done.desktop).getPublicationStatus(REF, 'v_pub_1'),
    ).toMatchObject({
      externalPostId: 'v_pub_1',
      publicPostId: '7123',
      state: 'published',
    });
    const failed = fakeDesktop(ACCOUNT, {
      status: 'FAILED',
      failReason: 'duration_check_failed',
      postIds: [],
    });
    expect(
      await new TikTokProvider(failed.desktop).getPublicationStatus(REF, 'v_pub_1'),
    ).toMatchObject({ state: 'failed', errorMessage: failReasonMessage('duration_check_failed') });
    const processing = fakeDesktop(ACCOUNT, {
      status: 'PROCESSING_UPLOAD',
      failReason: null,
      postIds: [],
    });
    expect(
      (await new TikTokProvider(processing.desktop).getPublicationStatus(REF, 'v_pub_1')).state,
    ).toBe('processing');
    expect(failReasonMessage('desconhecido')).toBe('O TikTok não publicou o vídeo.');
  });
});

describe('TikTokProvider.getCreatorInfo', () => {
  it('converte o creator_info e descarta avatar fora dos CDNs do TikTok', async () => {
    const { desktop, calls } = fakeDesktop();
    expect(await new TikTokProvider(desktop).getCreatorInfo(REF)).toEqual({
      nickname: 'yeaax',
      username: 'yeeax',
      avatarUrl: null,
      privacyOptions: ['FOLLOWER_OF_CREATOR', 'SELF_ONLY'],
      commentDisabled: false,
      duetDisabled: true,
      stitchDisabled: true,
      maxDurationSeconds: 600,
    });
    expect(calls).toEqual(['creator:channel-1']);
  });
});

describe('createSocialProviders', () => {
  it('usa o TikTok real no desktop e o simulado no preview', () => {
    expect(createSocialProviders(fakeDesktop().desktop).tiktok).toBeInstanceOf(TikTokProvider);
    const preview = createSocialProviders(createPreviewDesktopBridge());
    expect(preview.tiktok).not.toBeInstanceOf(TikTokProvider);
    expect(preview.tiktok.integrationStatus).toBe('MOCK');
  });
});

describe('safeAvatarUrl', () => {
  it('aceita só https dos CDNs do TikTok liberados na CSP', () => {
    expect(safeAvatarUrl('https://p16-sign-va.tiktokcdn.com/a.jpg?x=1')).not.toBeNull();
    expect(safeAvatarUrl('https://p19.tiktokcdn-us.com/a.jpg')).not.toBeNull();
    expect(safeAvatarUrl('http://p16.tiktokcdn.com/a.jpg')).toBeNull();
    expect(safeAvatarUrl('https://tiktokcdn.com.evil.example/a.jpg')).toBeNull();
    expect(safeAvatarUrl('https://eviltiktokcdn.com/a.jpg')).toBeNull();
    expect(safeAvatarUrl('lixo')).toBeNull();
    expect(safeAvatarUrl(null)).toBeNull();
  });
});
