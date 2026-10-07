import type { Platform } from '@/types';

export interface PlatformLimits {
  /** Tamanho máximo da legenda em caracteres. */
  captionMaxLength: number;
  /** Máximo de hashtags por post (`null` = sem limite documentado). */
  maxHashtags: number | null;
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
 * Os limites devem ser revisados contra a documentação oficial ao implementar a
 * integração real — ver docs/API_NOTES.md.
 */
export const PLATFORM_INFO: Record<Platform, PlatformInfo> = {
  tiktok: {
    id: 'tiktok',
    label: 'TikTok',
    monogram: 'TT',
    limits: { captionMaxLength: 2200, maxHashtags: null },
  },
  instagram: {
    id: 'instagram',
    label: 'Instagram',
    monogram: 'IG',
    limits: { captionMaxLength: 2200, maxHashtags: 30 },
  },
};

export function getPlatformLabel(platform: Platform): string {
  return PLATFORM_INFO[platform].label;
}
