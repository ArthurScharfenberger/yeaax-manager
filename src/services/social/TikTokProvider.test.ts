import { describe, expect, it } from 'vitest';

import type { DesktopBridge, TikTokAccount } from '@/services/desktop/DesktopBridge';
import { createPreviewDesktopBridge } from '@/services/desktop/previewDesktopBridge';

import { createSocialProviders } from './index';
import { TikTokProvider } from './TikTokProvider';

const ACCOUNT: TikTokAccount = {
  openId: 'open-1',
  username: 'yeaxx',
  displayName: 'YEAXX Cars',
  avatarUrl: 'https://p16.tiktokcdn.com/a.jpg',
  scopes: ['user.info.basic', 'user.info.profile'],
};

function fakeDesktop(account: TikTokAccount = ACCOUNT) {
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
  };
  return { desktop, calls };
}

const REF = { channelId: 'channel-1', platform: 'tiktok' as const, username: 'yeaxx' };

describe('TikTokProvider', () => {
  it('connect devolve o perfil e uma sessão ligada à conexão pendente', async () => {
    const { desktop, calls } = fakeDesktop();
    const result = await new TikTokProvider(desktop).connect();

    expect(result.profile).toEqual({
      username: 'yeaxx',
      displayName: 'YEAXX Cars',
      avatarUrl: null,
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
    await expect(provider.publish()).rejects.toMatchObject({ code: 'NOT_AVAILABLE' });
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
