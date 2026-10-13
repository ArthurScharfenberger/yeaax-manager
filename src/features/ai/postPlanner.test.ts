import { beforeEach, describe, expect, it } from 'vitest';

import type { Repositories } from '@/db/repositories';
import { createPostService } from '@/features/posts/postService';
import { createSettingsService } from '@/features/settings/settingsService';
import { createFixedClock } from '@/lib/clock';
import type { AIService, PostPlanDraft } from '@/services/ai';
import type { DesktopBridge } from '@/services/desktop/DesktopBridge';
import { buildChannel, buildMedia } from '@/test/factories';
import { createTestRepositories } from '@/test/testDb';

import { createPostPlanner, type PostPlanner } from './postPlanner';

const NOW = new Date(2026, 9, 7, 14, 0);

function fakeAi(draft: PostPlanDraft): AIService {
  return {
    describe: () =>
      Promise.resolve({ provider: 'openai', label: 'OpenAI · teste', simulated: false }),
    generateCaptions: () => Promise.resolve([]),
    planPost: () => Promise.resolve(draft),
    testConnection: () => Promise.resolve(),
  };
}

const desktop = { mode: 'desktop', toAssetUrl: () => null } as unknown as DesktopBridge;

describe('postPlanner', () => {
  let repositories: Repositories;

  function planner(draft: PostPlanDraft): PostPlanner {
    const clock = createFixedClock(NOW);
    return createPostPlanner({
      ai: fakeAi(draft),
      repositories,
      settings: createSettingsService({ repositories, clock }),
      posts: createPostService({ repositories, clock }),
      desktop,
      loadImage: () => Promise.resolve(null),
      clock,
    });
  }

  beforeEach(async () => {
    repositories = createTestRepositories();
    await repositories.channels.insert(buildChannel());
    await repositories.channels.insert(
      buildChannel({ id: 'channel-2', platform: 'instagram', username: 'yeaxx' }),
    );
    await repositories.media.insert(buildMedia());
  });

  it('monta o plano ignorando canais inexistentes e repetidos', async () => {
    const plan = await planner({
      summary: 'ok',
      language: 'en',
      posts: [
        { channelId: 'channel-2', caption: 'Sunset run', hashtags: ['civic', '#cars'] },
        { channelId: 'channel-2', caption: 'duplicado', hashtags: [] },
        { channelId: 'inventado', caption: 'x', hashtags: [] },
      ],
      schedule: { mode: 'datetime', datetime: '2026-10-08T19:00' },
    }).plan('media-1', 'Poste em inglês');

    expect(plan.posts.map((post) => post.channel.id)).toEqual(['channel-2']);
    expect(plan.posts[0]?.caption).toBe('Sunset run\n\n#civic #cars');
    expect(plan.scheduledAt).toEqual(new Date(2026, 9, 8, 19, 0));
    expect(plan.simulated).toBe(false);
  });

  it('tira do plano canais onde o vídeo já está agendado', async () => {
    const target = planner({
      summary: '',
      language: 'en',
      posts: [
        { channelId: 'channel-1', caption: 'A', hashtags: [] },
        { channelId: 'channel-2', caption: 'B', hashtags: [] },
      ],
      schedule: { mode: 'none', datetime: null },
    });
    await target.confirm({
      mediaId: 'media-1',
      instruction: 'x',
      posts: [{ channelId: 'channel-2', caption: 'B' }],
      scheduledAt: new Date(2026, 9, 8, 19, 0),
    });

    const plan = await target.plan('media-1', 'Poste em todos');
    expect(plan.posts.map((post) => post.channel.id)).toEqual(['channel-1']);
    expect(plan.scheduleNote).toContain('já está agendado');
  });

  it('falha com mensagem clara quando a IA não escolhe canal válido ou o pedido é vazio', async () => {
    const empty = planner({
      summary: '',
      language: 'pt-BR',
      posts: [],
      schedule: { mode: 'auto', datetime: null },
    });
    await expect(empty.plan('media-1', 'Poste')).rejects.toMatchObject({ code: 'AI_ERROR' });
    await expect(empty.plan('media-1', '   ')).rejects.toMatchObject({ code: 'VALIDATION' });
  });

  it('só cria posts na confirmação, com histórico de origem', async () => {
    const target = planner({
      summary: '',
      language: 'en',
      posts: [],
      schedule: { mode: 'auto', datetime: null },
    });
    expect(await repositories.posts.listDetailed()).toHaveLength(0);

    const result = await target.confirm({
      mediaId: 'media-1',
      instruction: 'Poste em inglês',
      posts: [{ channelId: 'channel-2', caption: 'Sunset run #civic' }],
      scheduledAt: new Date(2026, 9, 8, 19, 0),
    });

    expect(result.failed).toEqual([]);
    expect(result.created[0]).toMatchObject({ status: 'scheduled', channelId: 'channel-2' });
    const history = await repositories.postHistory.listByPost(result.created[0]!.id);
    const created = history.find((entry) => entry.event === 'created');
    expect(created?.message).toBe('Criado com IA a partir do pedido: "Poste em inglês"');
  });

  it('com horário, posts do TikTok vão para revisão (escolhas e consentimento no compositor)', async () => {
    const target = planner({
      summary: '',
      language: 'en',
      posts: [],
      schedule: { mode: 'auto', datetime: null },
    });
    const result = await target.confirm({
      mediaId: 'media-1',
      instruction: 'Poste em todos',
      posts: [
        { channelId: 'channel-1', caption: 'TikTok' },
        { channelId: 'channel-2', caption: 'Instagram' },
      ],
      scheduledAt: new Date(2026, 9, 8, 19, 0),
    });

    expect(result.failed).toEqual([]);
    expect(result.created.map((post) => [post.channelId, post.status])).toEqual([
      ['channel-1', 'review'],
      ['channel-2', 'scheduled'],
    ]);
  });
});
