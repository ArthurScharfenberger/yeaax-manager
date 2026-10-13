import { describe, expect, it } from 'vitest';

import { buildChannel } from '@/test/factories';
import { createTestRepositories } from '@/test/testDb';

describe('channelRepository — external_id (migration 0002)', () => {
  it('grava, lê e encontra o canal pelo id da plataforma', async () => {
    const { channels } = createTestRepositories();
    await channels.insert(buildChannel({ id: 'c1', externalId: 'open-1' }));

    expect((await channels.getById('c1'))?.externalId).toBe('open-1');
    expect((await channels.findByExternalId('tiktok', 'open-1'))?.id).toBe('c1');
    expect(await channels.findByExternalId('instagram', 'open-1')).toBeNull();

    await channels.update('c1', { externalId: 'open-9', username: 'novo', updatedAt: 'x' });
    expect(await channels.getById('c1')).toMatchObject({ externalId: 'open-9', username: 'novo' });
  });

  it('impede a mesma conta duas vezes na mesma plataforma, mas aceita vários nulos', async () => {
    const { channels } = createTestRepositories();
    await channels.insert(buildChannel({ id: 'c1', username: 'a', externalId: 'open-1' }));
    await expect(
      channels.insert(buildChannel({ id: 'c2', username: 'b', externalId: 'open-1' })),
    ).rejects.toThrow();

    await channels.insert(buildChannel({ id: 'c3', username: 'c', externalId: null }));
    await channels.insert(buildChannel({ id: 'c4', username: 'd', externalId: null }));
    await channels.insert(
      buildChannel({ id: 'c5', platform: 'instagram', username: 'a', externalId: 'open-1' }),
    );
    expect(await channels.list()).toHaveLength(4);
  });
});
