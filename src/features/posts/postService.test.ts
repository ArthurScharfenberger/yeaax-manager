import { beforeEach, describe, expect, it } from 'vitest';

import type { Repositories } from '@/db/repositories';
import { createFixedClock } from '@/lib/clock';
import { AppError } from '@/lib/errors';
import { buildChannel, buildMedia } from '@/test/factories';
import { createTestRepositories } from '@/test/testDb';

import { createPostService, type PostInput, type PostService } from './postService';

const NOW = new Date('2026-10-07T12:00:00.000Z');
const FUTURE = '2026-10-07T22:30:00.000Z';
const PAST = '2026-10-07T09:00:00.000Z';

function input(overrides: Partial<PostInput> = {}): PostInput {
  return {
    channelId: 'channel-1',
    mediaId: 'media-1',
    caption: 'Civic Si no fim de tarde #civic',
    status: 'draft',
    scheduledAt: null,
    ...overrides,
  };
}

async function expectAppError(promise: Promise<unknown>, code: AppError['code']) {
  const error: unknown = await promise.catch((caught: unknown) => caught);
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe(code);
}

describe('postService', () => {
  let repositories: Repositories;
  let service: PostService;

  beforeEach(async () => {
    repositories = createTestRepositories();
    service = createPostService({ repositories, clock: createFixedClock(NOW) });
    await repositories.channels.insert(buildChannel());
    await repositories.channels.insert(
      buildChannel({ id: 'channel-2', platform: 'instagram', username: 'yeaxx' }),
    );
    await repositories.media.insert(buildMedia());
  });

  it('cria rascunho e registra histórico', async () => {
    const post = await service.create(input());

    expect(post.status).toBe('draft');
    const history = await service.getHistory(post.id);
    expect(history.map((entry) => entry.event)).toEqual(['created']);
  });

  it('agenda post no futuro e registra o agendamento', async () => {
    const post = await service.create(input({ status: 'scheduled', scheduledAt: FUTURE }));

    const detailed = await service.getDetailed(post.id);
    expect(detailed.status).toBe('scheduled');
    expect(detailed.channel.username).toBe('yeaxx');
    expect(detailed.media?.filename).toBe('civic.mp4');

    const events = (await service.getHistory(post.id)).map((entry) => entry.event);
    expect(events).toEqual(expect.arrayContaining(['created', 'scheduled']));
  });

  it('exige data futura para agendar', async () => {
    await expectAppError(service.create(input({ status: 'scheduled' })), 'VALIDATION');
    await expectAppError(
      service.create(input({ status: 'scheduled', scheduledAt: PAST })),
      'SCHEDULE_IN_PAST',
    );
  });

  it('impede agendar o mesmo vídeo duas vezes no mesmo canal', async () => {
    await service.create(input({ status: 'scheduled', scheduledAt: FUTURE }));

    await expectAppError(
      service.create(input({ status: 'scheduled', scheduledAt: '2026-10-08T10:00:00.000Z' })),
      'DUPLICATE_POST',
    );
    // Outro canal pode usar o mesmo vídeo.
    await expect(
      service.create(input({ channelId: 'channel-2', status: 'scheduled', scheduledAt: FUTURE })),
    ).resolves.toMatchObject({ status: 'scheduled' });
    // Rascunhos não bloqueiam.
    await expect(service.create(input())).resolves.toMatchObject({ status: 'draft' });
  });

  it('permite editar o próprio agendamento sem acusar duplicidade', async () => {
    const post = await service.create(input({ status: 'scheduled', scheduledAt: FUTURE }));
    const updated = await service.update(
      post.id,
      input({ status: 'scheduled', scheduledAt: '2026-10-08T10:00:00.000Z' }),
    );

    expect(updated.scheduledAt).toBe('2026-10-08T10:00:00.000Z');
    const events = (await service.getHistory(post.id)).map((entry) => entry.event);
    expect(events).toContain('rescheduled');
  });

  it('valida limites da plataforma na legenda', async () => {
    const hashtags = Array.from({ length: 31 }, (_, i) => `#t${i}`).join(' ');
    await expectAppError(
      service.create(input({ channelId: 'channel-2', caption: hashtags })),
      'VALIDATION',
    );
  });

  it('reagenda pelo calendário e bloqueia horários passados', async () => {
    const post = await service.create(input({ status: 'scheduled', scheduledAt: FUTURE }));

    const moved = await service.reschedule(post.id, new Date('2026-10-09T15:00:00.000Z'));
    expect(moved.scheduledAt).toBe('2026-10-09T15:00:00.000Z');

    await expectAppError(service.reschedule(post.id, new Date(PAST)), 'SCHEDULE_IN_PAST');
  });

  it('não permite editar ou excluir posts publicados', async () => {
    const post = await service.create(input({ status: 'scheduled', scheduledAt: FUTURE }));
    await repositories.posts.update(post.id, { status: 'published', updatedAt: NOW.toISOString() });

    await expectAppError(service.update(post.id, input()), 'NOT_EDITABLE');
    await expectAppError(service.remove(post.id), 'NOT_EDITABLE');
    await expectAppError(service.cancel(post.id), 'INVALID_TRANSITION');
  });

  it('duplica para outro canal como rascunho, mantendo vídeo, legenda e horário', async () => {
    const source = await service.create(input({ status: 'scheduled', scheduledAt: FUTURE }));

    const result = await service.duplicateToChannels(source.id, ['channel-1', 'channel-2']);

    expect(result.failed).toEqual([]);
    expect(result.created).toHaveLength(1); // o canal de origem é ignorado
    expect(result.created[0]).toMatchObject({
      channelId: 'channel-2',
      mediaId: 'media-1',
      caption: source.caption,
      status: 'draft',
      scheduledAt: FUTURE,
    });
    const [created] = await service.getHistory(result.created[0]!.id);
    expect(created?.message).toBe('Duplicado do post de @yeaxx (TikTok)');
  });

  it('reporta falhas por canal sem impedir as demais cópias', async () => {
    const hashtags = Array.from({ length: 31 }, (_, i) => `#t${i}`).join(' ');
    const source = await service.create(input({ caption: hashtags }));
    await repositories.channels.insert(
      buildChannel({ id: 'channel-3', username: 'techfix.rs', displayName: 'TechFix' }),
    );

    const result = await service.duplicateToChannels(source.id, [
      'channel-2', // Instagram: máx. 30 hashtags
      'channel-3',
      'inexistente',
    ]);

    expect(result.created.map((post) => post.channelId)).toEqual(['channel-3']);
    expect(result.failed.map((item) => item.channelId)).toEqual(['channel-2', 'inexistente']);
    expect(result.failed[0]?.message).toContain('30 hashtags');
  });

  it('cancela agendamentos e exclui somente depois', async () => {
    const post = await service.create(input({ status: 'scheduled', scheduledAt: FUTURE }));

    await expectAppError(service.remove(post.id), 'NOT_EDITABLE');
    await service.cancel(post.id);
    await service.remove(post.id);

    expect(await repositories.posts.getById(post.id)).toBeNull();
  });
});
