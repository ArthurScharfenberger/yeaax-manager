import { describe, expect, it } from 'vitest';

import { createFixedClock } from '@/lib/clock';
import { createTestDbClient } from '@/test/testDb';

import { createDemoDataService } from './demoData';
import { createRepositories } from './repositories';

const NOW = new Date('2026-10-07T15:00:00.000Z');

function setup() {
  const db = createTestDbClient();
  const repositories = createRepositories(db);
  const demo = createDemoDataService({ db, repositories, clock: createFixedClock(NOW) });
  return { repositories, demo };
}

describe('demoData', () => {
  it('insere os dados uma única vez', async () => {
    const { repositories, demo } = setup();

    expect(await demo.seedIfNeeded()).toBe(true);
    expect(await demo.seedIfNeeded()).toBe(false);

    const channels = await repositories.channels.list();
    expect(channels.map((channel) => channel.username)).toEqual(
      expect.arrayContaining(['yeaxx', 'techfix.rs']),
    );
    expect(await repositories.media.count()).toBe(10);
    expect((await repositories.posts.listDetailed()).length).toBe(15);
  });

  it('gera agendamentos futuros e publicações passadas coerentes', async () => {
    const { repositories, demo } = setup();
    await demo.seedIfNeeded();

    const posts = await repositories.posts.listDetailed();
    for (const post of posts.filter((item) => item.status === 'scheduled')) {
      expect(new Date(post.scheduledAt!).getTime()).toBeGreaterThan(NOW.getTime());
    }
    for (const post of posts.filter((item) => item.status === 'published')) {
      expect(new Date(post.publishedAt!).getTime()).toBeLessThan(NOW.getTime());
    }
  });

  it('não insere dados de demonstração sobre dados reais', async () => {
    const { repositories, demo } = setup();
    await repositories.channels.insert({
      id: 'real-channel',
      platform: 'tiktok',
      username: 'meucanal',
      externalId: null,
      displayName: 'Meu canal',
      avatarUrl: null,
      status: 'connected',
      lastSyncedAt: null,
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    });

    expect(await demo.seedIfNeeded()).toBe(false);
    expect(await demo.hasDemoData()).toBe(false);
  });

  it('remove apenas os registros de demonstração', async () => {
    const { repositories, demo } = setup();
    await demo.seedIfNeeded();
    await repositories.tags.insert({
      id: 'real-tag',
      name: 'minha-tag',
      createdAt: NOW.toISOString(),
    });

    await demo.remove();

    expect(await demo.hasDemoData()).toBe(false);
    expect(await repositories.posts.listDetailed()).toEqual([]);
    expect((await repositories.tags.listWithUsage()).map((tag) => tag.name)).toEqual(['minha-tag']);
  });
});
