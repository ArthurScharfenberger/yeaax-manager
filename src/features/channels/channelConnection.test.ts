import { beforeEach, describe, expect, it } from 'vitest';

import type { Repositories } from '@/db/repositories';
import { createFixedClock } from '@/lib/clock';
import { AppError } from '@/lib/errors';
import { type ConnectResult, MockSocialProvider } from '@/services/social';
import { createTestRepositories } from '@/test/testDb';

import { type ChannelService, createChannelService } from './channelService';

const NOW = new Date('2026-10-13T12:00:00.000Z');

/** Provider que simula o TikTok real: credenciais pendentes até `commit` (DEC-027). */
class TwoPhaseProvider extends MockSocialProvider {
  username = 'yeaxx';
  failCommit = false;
  readonly committed: string[] = [];
  discarded = 0;

  constructor() {
    super({ platform: 'tiktok', latencyMs: 0 });
  }

  override connect(): Promise<ConnectResult> {
    return Promise.resolve({
      profile: { username: this.username, displayName: 'YEAXX Cars', avatarUrl: null },
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
}

describe('conexão em duas fases (TikTok real)', () => {
  let repositories: Repositories;
  let provider: TwoPhaseProvider;
  let service: ChannelService;

  beforeEach(() => {
    repositories = createTestRepositories();
    provider = new TwoPhaseProvider();
    service = createChannelService({
      repositories,
      clock: createFixedClock(NOW),
      social: {
        tiktok: provider,
        instagram: new MockSocialProvider({ platform: 'instagram', latencyMs: 0 }),
      },
    });
  });

  it('grava o canal e só então confirma as credenciais para o id dele', async () => {
    const channel = await service.connectNew({
      platform: 'tiktok',
      username: 'yeaxx',
      displayName: '',
    });
    expect(provider.committed).toEqual([channel.id]);
    expect(provider.discarded).toBe(0);
    expect(await repositories.channels.getById(channel.id)).toMatchObject({ status: 'connected' });
  });

  it('usa o @ real da conta autorizada', async () => {
    provider.username = 'yeaxx.oficial';
    const channel = await service.connectNew({
      platform: 'tiktok',
      username: 'yeaxx',
      displayName: '',
    });
    expect(channel.username).toBe('yeaxx.oficial');
  });

  it('falha no cofre remove o canal recém-criado e descarta a conexão', async () => {
    provider.failCommit = true;
    await expect(
      service.connectNew({ platform: 'tiktok', username: 'yeaxx', displayName: '' }),
    ).rejects.toMatchObject({ code: 'SECRET_STORE' });
    expect(await repositories.channels.list()).toEqual([]);
    expect(provider.discarded).toBe(1);
  });

  it('conta autorizada já cadastrada: nada é gravado e a conexão é descartada', async () => {
    provider.username = 'yeaxx';
    await service.connectNew({ platform: 'tiktok', username: 'yeaxx', displayName: '' });
    provider.username = 'yeaxx';
    await expect(
      service.connectNew({ platform: 'tiktok', username: 'outra', displayName: '' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await repositories.channels.list()).toHaveLength(1);
    expect(provider.committed).toHaveLength(1);
    expect(provider.discarded).toBe(1);
  });

  it('reconectar com outra conta não altera o canal', async () => {
    const channel = await service.connectNew({
      platform: 'tiktok',
      username: 'yeaxx',
      displayName: '',
    });
    await service.disconnect(channel.id);
    provider.username = 'techfix.rs';

    await expect(service.connect(channel.id)).rejects.toMatchObject({ code: 'CONFLICT' });
    expect(await repositories.channels.getById(channel.id)).toMatchObject({
      username: 'yeaxx',
      status: 'disconnected',
    });
    expect(provider.committed).toEqual([channel.id]);
    expect(provider.discarded).toBe(1);
  });

  it('falha no cofre ao reconectar restaura o status anterior', async () => {
    const channel = await service.connectNew({
      platform: 'tiktok',
      username: 'yeaxx',
      displayName: 'YEAXX',
    });
    await service.disconnect(channel.id);
    const before = await repositories.channels.getById(channel.id);
    provider.failCommit = true;

    await expect(service.connect(channel.id)).rejects.toMatchObject({ code: 'SECRET_STORE' });
    expect(await repositories.channels.getById(channel.id)).toEqual(before);
    expect(provider.discarded).toBe(1);
  });
});
