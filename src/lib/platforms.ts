import type { Platform } from '@/types';

export interface PlatformLimits {
  /** Tamanho máximo da legenda (unidades UTF-16, como a API do TikTok conta). */
  captionMaxLength: number;
  /** Máximo de hashtags por post (`null` = sem limite documentado). */
  maxHashtags: number | null;
  /** Máximo de menções `@` por post (`null` = sem limite documentado). */
  maxMentions: number | null;
}

export interface PlatformInfo {
  id: Platform;
  label: string;
  /** Monograma usado no `PlatformMark`. */
  monogram: string;
  limits: PlatformLimits;
}

/**
 * Informações e limites por plataforma.
 * Limites verificados na documentação oficial em 2026-10-07 — fontes em docs/API_NOTES.md.
 */
export const PLATFORM_INFO: Record<Platform, PlatformInfo> = {
  tiktok: {
    id: 'tiktok',
    label: 'TikTok',
    monogram: 'TT',
    // Content Posting API: `title` até 2200 runas UTF-16.
    limits: { captionMaxLength: 2200, maxHashtags: null, maxMentions: null },
  },
  instagram: {
    id: 'instagram',
    label: 'Instagram',
    monogram: 'IG',
    // IG User Media: "Maximum 2200 characters, 30 hashtags, and 20 @ tags."
    limits: { captionMaxLength: 2200, maxHashtags: 30, maxMentions: 20 },
  },
};

export function getPlatformLabel(platform: Platform): string {
  return PLATFORM_INFO[platform].label;
}
