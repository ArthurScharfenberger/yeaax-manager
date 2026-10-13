import { beforeEach, describe, expect, it } from 'vitest';

import type { Repositories } from '@/db/repositories';
import { createFixedClock } from '@/lib/clock';
import { AppError } from '@/lib/errors';
import { MockSocialProvider } from '@/services/social';
import { createTestRepositories } from '@/test/testDb';

import { type ChannelService, createChannelService } from './channelService';

const NOW = new Date('2026-10-07T12:00:00.000Z');

describe('channelService', () => {
  let repositories: Repositories;
  let service: ChannelService;

  beforeEach(() => {
    repositories = createTestRepositories();
    service = createChannelService({
      repositories,
      clock: createFixedClock(NOW),
      social: {
        tiktok: new MockSocialProvider({ platform: 'tiktok', latencyMs: 0 }),
        instagram: new MockSocialProvider({ platform: 'instagram', latencyMs: 0 }),
      },
    });
  });

  it('conecta um canal novo removendo o @ do usuário', async () => {
    const channel = await service.connectNew({
      platform: 'tiktok',
      username: '@techfix.rs',
      displayName: 'TechFix',
    });

    expect(channel).toMatchObject({
      username: 'techfix.rs',
      displayName: 'TechFix',
      status: 'connected',
      lastSyncedAt: NOW.toISOString(),
    });
  });

  it('rejeita usuário inválido ou duplicado na mesma plataforma', async () => {
    await expect(
      service.connectNew({ platform: 'tiktok', username: 'nome com espaço', displayName: '' }),
    ).rejects.toThrow();

    await service.connectNew({ platform: 'tiktok', username: 'yeaxx', displayName: '' });
    await expect(
      service.connectNew({ platform: 'tiktok', username: 'YEAXX', displayName: '' }),
    ).rejects.toBeInstanceOf(AppError);
    // Mesma conta em outra plataforma é permitida.
    await expect(
      service.connectNew({ platform: 'instagram', username: 'yeaxx', displayName: '' }),
    ).resolves.toMatchObject({ platform: 'instagram' });
  });

  it('desconecta e reconecta', async () => {
    const channel = await service.connectNew({
      platform: 'instagram',
      username: 'yeaxx',
      displayName: 'YEAXX Cars',
    });

    await service.disconnect(channel.id);
    expect((await repositories.channels.getById(channel.id))?.status).toBe('disconnected');

    await service.connect(channel.id);
    expect((await repositories.channels.getById(channel.id))?.status).toBe('connected');
  });

  it('não remove canal com posts', async () => {
    const channel = await service.connectNew({
      platform: 'tiktok',
      username: 'yeaxx',
      displayName: '',
    });
    await repositories.posts.insert({
      id: 'post-1',
      channelId: channel.id,
      mediaId: null,
      caption: '',
      status: 'draft',
      scheduledAt: null,
      publishedAt: null,
      externalPostId: null,
      platformOptions: null,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });

    await expect(service.remove(channel.id)).rejects.toMatchObject({ code: 'CHANNEL_HAS_POSTS' });
  });
});
