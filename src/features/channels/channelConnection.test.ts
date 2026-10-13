import { beforeEach, describe, expect, it } from 'vitest';

import type { Repositories } from '@/db/repositories';
import { createFixedClock } from '@/lib/clock';
import { AppError } from '@/lib/errors';
import {
  type ConnectResult,
  MockSocialProvider,
  type ProviderCapabilities,
  type SocialProfile,
} from '@/services/social';
import { buildChannel } from '@/test/factories';
import { createTestRepositories } from '@/test/testDb';

import { type ChannelService, createChannelService } from './channelService';

const NOW = new Date('2026-10-13T12:00:00.000Z');

/** Provider que simula o TikTok real: login oficial, open_id e credenciais pendentes até `commit` (DEC-027). */
class OfficialProvider extends MockSocialProvider {
  override readonly capabilities: ProviderCapabilities = {
    publishVideo: false,
    nativeScheduling: false,
    analytics: false,
    officialLogin: true,
  };
  username = 'yeaxx';
  openId: string | null = 'open-1';
  failCommit = false;
  profileError: AppError | null = null;
  readonly committed: string[] = [];
  readonly disconnected: string[] = [];
  discarded = 0;
  cancelled = 0;

  constructor() {
    super({ platform: 'tiktok', latencyMs: 0 });
  }

  private profile(): SocialProfile {
    return {
      externalId: this.openId,
      username: this.username,
      displayName: 'YEAXX Cars',
      avatarUrl: 'https://p16.tiktokcdn.com/a.jpg',
    };
  }

  override connect(): Promise<ConnectResult> {
    return Promise.resolve({
      profile: this.profile(),
      session: {
        commit: (channelId) => {
          if (this.failCommit) {
            return Promise.reject(new AppError('SECRET_STORE', 'Cofre indisponível.'));
          }
          this.committed.push(channelId);
          return Promise.resolve();
        },
        discard: () => {
          this.discarded += 1;
          return Promise.resolve();
        },
      },
    });
  }

  cancelConnect(): Promise<void> {
    this.cancelled += 1;
    return Promise.resolve();
  }

  override getProfile(): Promise<SocialProfile> {
    return this.profileError ? Promise.reject(this.profileError) : Promise.resolve(this.profile());
  }

  override disconnect(account: { channelId: string }): Promise<void> {
    this.disconnected.push(account.channelId);
    return Promise.resolve();
  }
}

describe('conexão de contas com login oficial', () => {
  let repositories: Repositories;
  let provider: OfficialProvider;
  let service: ChannelService;

  beforeEach(() => {
    repositories = createTestRepositories();
    provider = new OfficialProvider();
    service = createChannelService({
      repositories,
      clock: createFixedClock(NOW),
      social: {
        tiktok: provider,
        instagram: new MockSocialProvider({ platform: 'instagram', latencyMs: 0 }),
      },
    });
  });

  it('cria o canal com @, open_id e avatar reais e só então confirma as credenciais', async () => {
    const { channel, created } = await service.connectAccount('tiktok');
    expect(created).toBe(true);
    expect(channel).toMatchObject({
      username: 'yeaxx',
      externalId: 'open-1',
      avatarUrl: 'https://p16.tiktokcdn.com/a.jpg',
      status: 'connected',
    });
    expect(provider.committed).toEqual([channel.id]);
    expect(provider.discarded).toBe(0);
  });

  it('mesma conta de novo reconecta o canal existente em vez de duplicar (pelo open_id)', async () => {
    const first = await service.connectAccount('tiktok');
    await service.disconnect(first.channel.id);
    provider.username = 'yeaxx.novo'; // o @ mudou no TikTok; o open_id não

    const again = await service.connectAccount('tiktok');
    expect(again.created).toBe(false);
    expect(again.channel).toMatchObject({
      id: first.channel.id,
      username: 'yeaxx.novo',
      status: 'connected',
    });
    expect(await repositories.channels.list()).toHaveLength(1);
    expect(provider.committed).toEqual([first.channel.id, first.channel.id]);
  });

  it('canal antigo sem open_id é reconhecido pelo @ e recebe o open_id', async () => {
    await repositories.channels.insert(
      buildChannel({ id: 'legacy', username: 'yeaxx', externalId: null, status: 'disconnected' }),
    );
    const { channel, created } = await service.connectAccount('tiktok');
    expect(created).toBe(false);
    expect(channel).toMatchObject({ id: 'legacy', externalId: 'open-1', status: 'connected' });
  });

  it('falha no cofre remove o canal recém-criado e descarta a conexão', async () => {
    provider.failCommit = true;
    await expect(service.connectAccount('tiktok')).rejects.toMatchObject({ code: 'SECRET_STORE' });
    expect(await repositories.channels.list()).toEqual([]);
    expect(provider.discarded).toBe(1);
  });

  it('falha no cofre ao reconectar restaura o canal como estava', async () => {
    const { channel } = await service.connectAccount('tiktok');
    await service.disconnect(channel.id);
    const before = await repositories.channels.getById(channel.id);
    provider.failCommit = true;
    provider.username = 'outro.nome';

    await expect(service.connect(channel.id)).rejects.toMatchObject({ code: 'SECRET_STORE' });
    expect(await repositories.channels.getById(channel.id)).toEqual(before);
    expect(provider.discarded).toBe(1);
  });

  it('reconectar o canal com outra conta é recusado e nada muda', async () => {
    const { channel } = await service.connectAccount('tiktok');
    await service.disconnect(channel.id);
    provider.openId = 'open-2';
    provider.username = 'techfix.rs';

    await expect(service.connect(channel.id)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await repositories.channels.getById(channel.id)).toMatchObject({
      username: 'yeaxx',
      externalId: 'open-1',
      status: 'disconnected',
    });
    expect(provider.discarded).toBe(1);
  });

  it('cancelar delega ao provider', async () => {
    await service.cancelConnect('tiktok');
    expect(provider.cancelled).toBe(1);
  });

  it('remover o canal apaga a credencial do cofre antes', async () => {
    const { channel } = await service.connectAccount('tiktok');
    await service.remove(channel.id);
    expect(provider.disconnected).toEqual([channel.id]);
    expect(await repositories.channels.list()).toEqual([]);
  });
});

describe('verificação das contas ao abrir o app', () => {
  let repositories: Repositories;
  let provider: OfficialProvider;
  let service: ChannelService;

  beforeEach(() => {
    repositories = createTestRepositories();
    provider = new OfficialProvider();
    service = createChannelService({
      repositories,
      clock: createFixedClock(NOW),
      social: {
        tiktok: provider,
        instagram: new MockSocialProvider({ platform: 'instagram', latencyMs: 0 }),
      },
    });
  });

  it('atualiza o perfil das contas conectadas e preenche o open_id que faltava', async () => {
    await repositories.channels.insert(
      buildChannel({ id: 'c1', username: 'yeaxx', externalId: null, displayName: 'Antigo' }),
    );
    await repositories.channels.insert(
      buildChannel({ id: 'c2', platform: 'instagram', username: 'yeaxx' }),
    );

    expect(await service.verifyConnections()).toEqual({ checked: 1, expired: 0, skipped: 0 });
    expect(await repositories.channels.getById('c1')).toMatchObject({
      externalId: 'open-1',
      displayName: 'YEAXX Cars',
      status: 'connected',
      lastSyncedAt: NOW.toISOString(),
    });
  });

  it('credencial expirada ou ausente vira "Sessão expirada"', async () => {
    await repositories.channels.insert(buildChannel({ id: 'c1', externalId: 'open-1' }));
    provider.profileError = new AppError('TIKTOK_AUTH_EXPIRED', 'Expirou.');

    expect(await service.verifyConnections()).toEqual({ checked: 1, expired: 1, skipped: 0 });
    expect((await repositories.channels.getById('c1'))?.status).toBe('expired');
  });

  it('sem internet o status não muda', async () => {
    await repositories.channels.insert(buildChannel({ id: 'c1', externalId: 'open-1' }));
    provider.profileError = new AppError('TIKTOK_UNAVAILABLE', 'Sem internet.');

    expect(await service.verifyConnections()).toEqual({ checked: 1, expired: 0, skipped: 1 });
    expect((await repositories.channels.getById('c1'))?.status).toBe('connected');
  });

  it('sincronizar com credencial revogada marca o canal e relança o erro', async () => {
    await repositories.channels.insert(buildChannel({ id: 'c1', externalId: 'open-1' }));
    provider.profileError = new AppError('TIKTOK_NOT_CONNECTED', 'Sem credencial.');

    await expect(service.sync('c1')).rejects.toMatchObject({ code: 'TIKTOK_NOT_CONNECTED' });
    expect((await repositories.channels.getById('c1'))?.status).toBe('expired');
  });

  it('ignora canais desconectados ou já expirados', async () => {
    await repositories.channels.insert(buildChannel({ id: 'c1', status: 'disconnected' }));
    await repositories.channels.insert(
      buildChannel({ id: 'c2', username: 'outro', status: 'expired' }),
    );
    expect(await service.verifyConnections()).toEqual({ checked: 0, expired: 0, skipped: 0 });
  });
});
