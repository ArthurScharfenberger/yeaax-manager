import { describe, expect, it } from 'vitest';

import type { TikTokPostOptions } from '@/types';

import {
  commercialLabel,
  emptyTikTokOptions,
  normalizeTikTokOptions,
  requiredDeclaration,
  requiresPostOptions,
  type TikTokCreatorConstraints,
  tiktokOptionIssues,
} from './tiktokOptionsRules';

const CREATOR: TikTokCreatorConstraints = {
  privacyOptions: ['FOLLOWER_OF_CREATOR', 'MUTUAL_FOLLOW_FRIENDS', 'SELF_ONLY'],
  commentDisabled: false,
  duetDisabled: true,
  stitchDisabled: true,
  maxDurationSeconds: 60,
};

function options(patch: Partial<TikTokPostOptions> = {}): TikTokPostOptions {
  return { ...emptyTikTokOptions(), privacyLevel: 'SELF_ONLY', ...patch };
}

describe('emptyTikTokOptions', () => {
  it('não vem nada pré-selecionado (diretrizes do TikTok)', () => {
    expect(emptyTikTokOptions()).toEqual({
      platform: 'tiktok',
      privacyLevel: null,
      allowComment: false,
      allowDuet: false,
      allowStitch: false,
      commercialContent: false,
      yourBrand: false,
      brandedContent: false,
      consentedAt: null,
    });
  });
});

describe('tiktokOptionIssues', () => {
  it('exige escolher a privacidade', () => {
    expect(tiktokOptionIssues(emptyTikTokOptions())).toEqual(['PRIVACY_REQUIRED']);
    expect(tiktokOptionIssues(options())).toEqual([]);
  });

  it('a privacidade precisa estar entre as opções da conta', () => {
    expect(tiktokOptionIssues(options({ privacyLevel: 'PUBLIC_TO_EVERYONE' }), CREATOR)).toEqual([
      'PRIVACY_NOT_AVAILABLE',
    ]);
  });

  it('divulgação comercial exige escolher o tipo; conteúdo de marca não pode ser privado', () => {
    expect(tiktokOptionIssues(options({ commercialContent: true }))).toEqual([
      'COMMERCIAL_TYPE_REQUIRED',
    ]);
    expect(tiktokOptionIssues(options({ commercialContent: true, brandedContent: true }))).toEqual([
      'BRANDED_CONTENT_PRIVATE',
    ]);
    expect(
      tiktokOptionIssues(
        options({ privacyLevel: 'FOLLOWER_OF_CREATOR', commercialContent: true, yourBrand: true }),
      ),
    ).toEqual([]);
  });

  it('respeita interações bloqueadas pela conta e a duração máxima', () => {
    expect(
      tiktokOptionIssues(
        options({ allowComment: true, allowDuet: true, allowStitch: true }),
        CREATOR,
      ),
    ).toEqual(['DUET_DISABLED', 'STITCH_DISABLED']);
    expect(tiktokOptionIssues(options(), CREATOR, 61)).toEqual(['DURATION_EXCEEDED']);
    expect(tiktokOptionIssues(options(), CREATOR, 60)).toEqual([]);
    expect(tiktokOptionIssues(options(), CREATOR, null)).toEqual([]);
  });
});

describe('rótulos e declarações', () => {
  it('rótulo conforme a divulgação comercial', () => {
    expect(commercialLabel(options())).toBeNull();
    expect(commercialLabel(options({ commercialContent: true }))).toBeNull();
    expect(commercialLabel(options({ commercialContent: true, yourBrand: true }))).toBe(
      'promotional',
    );
    expect(commercialLabel(options({ commercialContent: true, brandedContent: true }))).toBe(
      'paid_partnership',
    );
    expect(
      commercialLabel(options({ commercialContent: true, yourBrand: true, brandedContent: true })),
    ).toBe('paid_partnership');
    // Tipos marcados sem a divulgação ligada não contam.
    expect(commercialLabel(options({ brandedContent: true }))).toBeNull();
  });

  it('declaração de música, ou de conteúdo de marca + música', () => {
    expect(requiredDeclaration(options())).toBe('music');
    expect(requiredDeclaration(options({ commercialContent: true, yourBrand: true }))).toBe(
      'music',
    );
    expect(requiredDeclaration(options({ commercialContent: true, brandedContent: true }))).toBe(
      'branded_and_music',
    );
  });
});

describe('normalizeTikTokOptions', () => {
  it('limpa tipos sem divulgação comercial e grava o consentimento informado', () => {
    expect(
      normalizeTikTokOptions(
        options({ yourBrand: true, brandedContent: true }),
        '2026-10-13T12:00:00.000Z',
      ),
    ).toMatchObject({
      yourBrand: false,
      brandedContent: false,
      consentedAt: '2026-10-13T12:00:00.000Z',
    });
  });
});

describe('requiresPostOptions', () => {
  it('só o TikTok exige escolhas por post', () => {
    expect(requiresPostOptions('tiktok')).toBe(true);
    expect(requiresPostOptions('instagram')).toBe(false);
  });
});
