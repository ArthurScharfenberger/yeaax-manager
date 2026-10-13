import { beforeEach, describe, expect, it } from 'vitest';

import type { Repositories } from '@/db/repositories';
import { emptyTikTokOptions } from '@/features/posts/tiktokOptionsRules';
import { createFixedClock } from '@/lib/clock';
import { AppError } from '@/lib/errors';
import {
  type CreatorInfo,
  MockSocialProvider,
  type ProviderCapabilities,
  type PublicationStatusResult,
  type PublishRequest,
  type PublishResult,
} from '@/services/social';
import { buildChannel, buildMedia } from '@/test/factories';
import { createTestRepositories } from '@/test/testDb';
import type { Post, TikTokPostOptions } from '@/types';

import { createPublishService, PUBLISH_GRACE_MINUTES, type PublishService } from './publishService';

const NOW = new Date('2026-10-13T12:00:00.000Z');
const minutes = (value: number) => new Date(NOW.getTime() + value * 60_000).toISOString();

/** TikTok falso: publica de verdade (capability), devolve publish_id e o status configurado. */
class FakeTikTok extends MockSocialProvider {
  override readonly capabilities: ProviderCapabilities = {
    publishVideo: true,
    nativeScheduling: false,
    analytics: false,
    officialLogin: true,
  };
  readonly published: PublishRequest[] = [];
  publishError: AppError | null = null;
  status: PublicationStatusResult['state'] = 'processing';
  creator: CreatorInfo = {
    nickname: 'yeaax',
    username: 'yeeax',
    avatarUrl: null,
    privacyOptions: ['FOLLOWER_OF_CREATOR', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'],
    commentDisabled: false,
    duetDisabled: true,
    stitchDisabled: true,
    maxDurationSeconds: 600,
  };

  constructor() {
    super({ platform: 'tiktok', latencyMs: 0 });
  }

  override getCreatorInfo(): Promise<CreatorInfo> {
    return Promise.resolve(this.creator);
  }

  override publish(request: PublishRequest): Promise<PublishResult> {
    if (this.publishError) return Promise.reject(this.publishError);
    this.published.push(request);
    request.onProgress?.({ stage: 'uploading', sent: 5, total: 10 });
    return Promise.resolve({ externalPostId: 'v_pub_1', state: 'processing' });
  }

  override getPublicationStatus(): Promise<PublicationStatusResult> {
    return Promise.resolve({
      externalPostId: 'v_pub_1',
      publicPostId: this.status === 'published' ? '7123' : null,
      state: this.status,
      publishedAt: this.status === 'published' ? NOW.toISOString() : null,
      errorMessage: this.status === 'failed' ? 'Duração não aceita.' : null,
    });
  }
}

const READY: TikTokPostOptions = {
  ...emptyTikTokOptions(),
  privacyLevel: 'SELF_ONLY',
  consentedAt: minutes(-60),
};

function post(overrides: Partial<Post> = {}): Post {
  return {
    id: 'post-1',
    channelId: 'channel-1',
    mediaId: 'media-1',
    caption: 'Olá #teste',
    status: 'draft',
    scheduledAt: null,
    publishedAt: null,
    externalPostId: null,
    platformOptions: READY,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  };
}

describe('publishService', () => {
  let repositories: Repositories;
  let tiktok: FakeTikTok;
  let service: PublishService;

  beforeEach(async () => {
    repositories = createTestRepositories();
    tiktok = new FakeTikTok();
    service = createPublishService({
      repositories,
      clock: createFixedClock(NOW),
      social: {
        tiktok,
        instagram: new MockSocialProvider({ platform: 'instagram', latencyMs: 0 }),
      },
    });
    await repositories.channels.insert(buildChannel({ externalId: 'open-1' }));
    await repositories.channels.insert(
      buildChannel({ id: 'channel-2', platform: 'instagram', username: 'yeaxx' }),
    );
    await repositories.media.insert(buildMedia({ duration: 30 }));
  });

  const events = async (id = 'post-1') =>
    (await repositories.postHistory.listByPost(id)).map((entry) => entry.event);

  it('publicar agora: registra o consentimento, envia com as escolhas e fica em processamento', async () => {
    await repositories.posts.insert(post({ platformOptions: { ...READY, consentedAt: null } }));
    const progress: unknown[] = [];

    const result = await service.publishNow('post-1', {
      consent: 'now',
      onProgress: (item) => progress.push(item),
    });

    expect(result).toMatchObject({ status: 'publishing', externalPostId: 'v_pub_1' });
    expect(result.platformOptions).toMatchObject({ consentedAt: NOW.toISOString() });
    expect(tiktok.published[0]).toMatchObject({
      caption: 'Olá #teste',
      media: { filePath: expect.any(String) as string, durationSeconds: 30 },
      options: { privacyLevel: 'SELF_ONLY' },
    });
    expect(progress).toEqual([{ stage: 'uploading', sent: 5, total: 10 }]);
    expect(await events()).toContain('publish_attempt');
  });

  it('acompanha o processamento até publicado (guarda o id público)', async () => {
    await repositories.posts.insert(post());
    await service.publishNow('post-1', { consent: 'now' });

    expect(await service.refreshStatus('post-1')).toBe('publishing');
    tiktok.status = 'published';
    expect(await service.refreshStatus('post-1')).toBe('published');
    expect(await repositories.posts.getById('post-1')).toMatchObject({
      status: 'published',
      externalPostId: '7123',
      publishedAt: NOW.toISOString(),
    });
    expect(await events()).toContain('published');
  });

  it('falha no processamento vira "Falhou" com o motivo', async () => {
    await repositories.posts.insert(post());
    await service.publishNow('post-1', { consent: 'now' });
    tiktok.status = 'failed';
    expect(await service.refreshStatus('post-1')).toBe('failed');
    const history = await repositories.postHistory.listByPost('post-1');
    expect(history.find((entry) => entry.event === 'failed')?.message).toBe('Duração não aceita.');
  });

  it('erro no envio marca "Falhou" e relança', async () => {
    await repositories.posts.insert(post());
    tiktok.publishError = new AppError('TIKTOK_CANNOT_POST', 'Conta precisa ser privada.');
    await expect(service.publishNow('post-1', { consent: 'now' })).rejects.toMatchObject({
      code: 'TIKTOK_CANNOT_POST',
    });
    expect((await repositories.posts.getById('post-1'))?.status).toBe('failed');
  });

  it('revalida as escolhas contra o creator_info antes de enviar', async () => {
    await repositories.posts.insert(
      post({ platformOptions: { ...READY, privacyLevel: 'PUBLIC_TO_EVERYONE' } }),
    );
    await expect(service.publishNow('post-1', { consent: 'now' })).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    expect(tiktok.published).toHaveLength(0);
    expect((await repositories.posts.getById('post-1'))?.status).toBe('draft');

    tiktok.creator = {
      ...tiktok.creator,
      privacyOptions: ['PUBLIC_TO_EVERYONE'],
      maxDurationSeconds: 10,
    };
    await expect(service.publishNow('post-1', { consent: 'now' })).rejects.toMatchObject({
      code: 'VALIDATION',
    });
  });

  it('exige canal conectado, vídeo e escolhas; recusa provider simulado e post já em envio', async () => {
    await repositories.posts.insert(post({ id: 'sem-video', mediaId: null }));
    await expect(service.publishNow('sem-video', { consent: 'now' })).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    await repositories.posts.insert(post({ id: 'sem-opcoes', platformOptions: null }));
    await expect(service.publishNow('sem-opcoes', { consent: 'now' })).rejects.toMatchObject({
      code: 'VALIDATION',
    });
    await repositories.posts.insert(post({ id: 'insta', channelId: 'channel-2' }));
    await expect(service.publishNow('insta', { consent: 'now' })).rejects.toMatchObject({
      code: 'NOT_AVAILABLE',
    });
    await repositories.posts.insert(post({ id: 'enviando', status: 'publishing' }));
    await expect(service.publishNow('enviando', { consent: 'now' })).rejects.toMatchObject({
      code: 'INVALID_TRANSITION',
    });
    await repositories.channels.update('channel-1', { status: 'expired', updatedAt: 'x' });
    await expect(service.publishNow('post-1', { consent: 'now' })).rejects.toBeInstanceOf(AppError);
  });

  it('agendador: publica só os vencidos dentro da tolerância, com o consentimento do agendamento', async () => {
    await repositories.posts.insert(
      post({ id: 'vencido', status: 'scheduled', scheduledAt: minutes(-2) }),
    );
    await repositories.posts.insert(
      post({
        id: 'atrasado',
        status: 'scheduled',
        scheduledAt: minutes(-(PUBLISH_GRACE_MINUTES + 5)),
      }),
    );
    await repositories.posts.insert(
      post({ id: 'futuro', status: 'scheduled', scheduledAt: minutes(30) }),
    );
    await repositories.posts.insert(
      post({ id: 'insta', channelId: 'channel-2', status: 'scheduled', scheduledAt: minutes(-1) }),
    );

    expect(await service.runScheduler()).toEqual({ started: 1, failed: 0, completed: 0 });
    expect((await repositories.posts.getById('vencido'))?.status).toBe('publishing');
    expect((await repositories.posts.getById('vencido'))?.platformOptions?.consentedAt).toBe(
      READY.consentedAt,
    );
    expect((await repositories.posts.getById('atrasado'))?.status).toBe('scheduled');
    expect((await repositories.posts.getById('futuro'))?.status).toBe('scheduled');
    expect((await repositories.posts.getById('insta'))?.status).toBe('scheduled');

    tiktok.status = 'published';
    expect(await service.runScheduler()).toEqual({ started: 0, failed: 0, completed: 1 });
    expect((await repositories.posts.getById('vencido'))?.status).toBe('published');
  });

  it('agendador: agendado sem consentimento ou inválido vira "Falhou" com motivo (não fica tentando)', async () => {
    await repositories.posts.insert(
      post({
        id: 'sem-consentimento',
        status: 'scheduled',
        scheduledAt: minutes(-1),
        platformOptions: { ...READY, consentedAt: null },
      }),
    );
    expect(await service.runScheduler()).toEqual({ started: 0, failed: 1, completed: 0 });
    expect((await repositories.posts.getById('sem-consentimento'))?.status).toBe('failed');
    expect(await events('sem-consentimento')).toContain('failed');
    expect(tiktok.published).toHaveLength(0);
  });
});
