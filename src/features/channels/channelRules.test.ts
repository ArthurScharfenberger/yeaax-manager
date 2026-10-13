import { describe, expect, it } from 'vitest';

import { buildChannel } from '@/test/factories';

import { isSameAccount, profilePatch } from './channelRules';

const profile = {
  externalId: 'open-1',
  username: 'yeaxx',
  displayName: 'YEAXX',
  avatarUrl: null,
};

describe('isSameAccount', () => {
  it('compara pelo open_id quando os dois lados o têm, mesmo com @ diferente', () => {
    expect(isSameAccount({ externalId: 'open-1', username: 'antigo' }, profile)).toBe(true);
    expect(isSameAccount({ externalId: 'open-2', username: 'yeaxx' }, profile)).toBe(false);
  });

  it('sem open_id, compara o @ sem diferenciar maiúsculas', () => {
    expect(isSameAccount({ externalId: null, username: 'YEAXX' }, profile)).toBe(true);
    expect(isSameAccount({ externalId: null, username: 'outro' }, profile)).toBe(false);
    expect(
      isSameAccount({ externalId: 'open-1', username: 'yeaxx' }, { ...profile, externalId: null }),
    ).toBe(true);
  });
});

describe('profilePatch', () => {
  it('mantém o que a plataforma não informou', () => {
    const channel = buildChannel({ externalId: 'open-1', displayName: 'Antigo' });
    expect(
      profilePatch(channel, { externalId: null, username: '', displayName: '', avatarUrl: null }),
    ).toEqual({ username: 'yeaxx', externalId: 'open-1', displayName: 'Antigo', avatarUrl: null });
  });
});
