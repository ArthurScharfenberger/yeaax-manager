import { describe, expect, it } from 'vitest';

import { emptyTikTokOptions } from '@/features/posts/tiktokOptionsRules';
import { buildChannel } from '@/test/factories';
import { createTestDbClient, createTestRepositories } from '@/test/testDb';

import { createRepositories } from './index';
import type { Post } from '@/types';

const BASE = '2026-10-13T12:00:00.000Z';

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    channelId: 'channel-1',
    mediaId: null,
    caption: '',
    status: 'draft',
    scheduledAt: null,
    publishedAt: null,
    externalPostId: null,
    platformOptions: null,
    createdAt: BASE,
    updatedAt: BASE,
    ...overrides,
  };
}

describe('postRepository — platform_options (migration 0003)', () => {
  it('grava, lê e atualiza as opções do TikTok como JSON', async () => {
    const { channels, posts } = createTestRepositories();
    await channels.insert(buildChannel());
    const options = { ...emptyTikTokOptions(), privacyLevel: 'SELF_ONLY' as const };
    await posts.insert(post({ platformOptions: options }));

    expect((await posts.getById('post-1'))?.platformOptions).toEqual(options);
    expect((await posts.getDetailed('post-1'))?.platformOptions).toEqual(options);

    await posts.update('post-1', {
      platformOptions: { ...options, allowComment: true },
      updatedAt: BASE,
    });
    expect((await posts.getById('post-1'))?.platformOptions?.allowComment).toBe(true);

    await posts.update('post-1', { platformOptions: null, updatedAt: BASE });
    expect((await posts.getById('post-1'))?.platformOptions).toBeNull();

    // Patch sem `platformOptions` não mexe na coluna.
    await posts.update('post-1', { platformOptions: options, updatedAt: BASE });
    await posts.update('post-1', { caption: 'nova', updatedAt: BASE });
    expect((await posts.getById('post-1'))?.platformOptions).toEqual(options);
  });

  it('JSON inválido ou fora do schema é lido como `null`', async () => {
    const db = createTestDbClient();
    const { channels, posts } = createRepositories(db);
    await channels.insert(buildChannel());
    await posts.insert(post());
    for (const raw of [
      '{lixo',
      '{"platform":"tiktok","privacyLevel":"QUALQUER"}',
      '{"platform":"x"}',
    ]) {
      await db.execute('UPDATE posts SET platform_options = ? WHERE id = ?', [raw, 'post-1']);
      expect((await posts.getById('post-1'))?.platformOptions).toBeNull();
    }
  });
});
