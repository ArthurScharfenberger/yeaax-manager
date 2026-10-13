import type { Platform, TikTokPostOptions, TikTokPrivacyLevel } from '@/types';

/**
 * Regras das diretrizes de publicação do TikTok (Content Sharing Guidelines — docs/API_NOTES.md, DEC-029).
 * Puras: usadas pelo compositor (botões e avisos) e pelo `postService` (bloqueia agendar sem as escolhas).
 */

/**
 * Plataformas que exigem escolhas e consentimento **por post** antes de agendar (diretrizes do TikTok). Posts
 * criados automaticamente (IA, duplicar) para elas ficam em revisão até o usuário completar o compositor.
 */
export function requiresPostOptions(platform: Platform): boolean {
  return platform === 'tiktok';
}

/** O que a conta permite agora (`creator_info`). Ausente → só as regras que não dependem da conta. */
export interface TikTokCreatorConstraints {
  privacyOptions: readonly TikTokPrivacyLevel[];
  commentDisabled: boolean;
  duetDisabled: boolean;
  stitchDisabled: boolean;
  maxDurationSeconds: number | null;
}

/** Nada pré-selecionado: privacidade sem padrão, interações e divulgação comercial desligadas. */
export function emptyTikTokOptions(): TikTokPostOptions {
  return {
    platform: 'tiktok',
    privacyLevel: null,
    allowComment: false,
    allowDuet: false,
    allowStitch: false,
    commercialContent: false,
    yourBrand: false,
    brandedContent: false,
    consentedAt: null,
  };
}

export const TIKTOK_OPTION_ISSUES = [
  'PRIVACY_REQUIRED',
  'PRIVACY_NOT_AVAILABLE',
  'COMMERCIAL_TYPE_REQUIRED',
  'BRANDED_CONTENT_PRIVATE',
  'COMMENT_DISABLED',
  'DUET_DISABLED',
  'STITCH_DISABLED',
  'DURATION_EXCEEDED',
] as const;
export type TikTokOptionIssue = (typeof TIKTOK_OPTION_ISSUES)[number];

export const TIKTOK_OPTION_ISSUE_MESSAGES: Record<TikTokOptionIssue, string> = {
  PRIVACY_REQUIRED: 'Escolha quem pode ver o vídeo no TikTok.',
  PRIVACY_NOT_AVAILABLE: 'Essa privacidade não está disponível para esta conta do TikTok.',
  COMMERCIAL_TYPE_REQUIRED:
    'Indique se o conteúdo promove você, um terceiro ou ambos (Sua marca / Conteúdo de marca).',
  BRANDED_CONTENT_PRIVATE: 'Conteúdo de marca não pode ser privado (“Somente eu”).',
  COMMENT_DISABLED: 'Comentários estão desativados nas configurações da sua conta do TikTok.',
  DUET_DISABLED: 'Dueto está desativado nas configurações da sua conta do TikTok.',
  STITCH_DISABLED: 'Stitch está desativado nas configurações da sua conta do TikTok.',
  DURATION_EXCEEDED: 'O vídeo é mais longo do que esta conta do TikTok permite publicar.',
};

/** Problemas que impedem agendar/publicar. Lista vazia = pronto. */
export function tiktokOptionIssues(
  options: TikTokPostOptions,
  creator: TikTokCreatorConstraints | null = null,
  durationSeconds: number | null = null,
): TikTokOptionIssue[] {
  const issues: TikTokOptionIssue[] = [];
  if (!options.privacyLevel) issues.push('PRIVACY_REQUIRED');
  else if (creator && !creator.privacyOptions.includes(options.privacyLevel)) {
    issues.push('PRIVACY_NOT_AVAILABLE');
  }
  if (options.commercialContent && !options.yourBrand && !options.brandedContent) {
    issues.push('COMMERCIAL_TYPE_REQUIRED');
  }
  if (options.commercialContent && options.brandedContent && options.privacyLevel === 'SELF_ONLY') {
    issues.push('BRANDED_CONTENT_PRIVATE');
  }
  if (creator) {
    if (options.allowComment && creator.commentDisabled) issues.push('COMMENT_DISABLED');
    if (options.allowDuet && creator.duetDisabled) issues.push('DUET_DISABLED');
    if (options.allowStitch && creator.stitchDisabled) issues.push('STITCH_DISABLED');
    if (
      creator.maxDurationSeconds !== null &&
      durationSeconds !== null &&
      durationSeconds > creator.maxDurationSeconds
    ) {
      issues.push('DURATION_EXCEEDED');
    }
  }
  return issues;
}

/** Rótulo que o TikTok aplica ao vídeo conforme a divulgação comercial (`null` = sem rótulo). */
export function commercialLabel(
  options: Pick<TikTokPostOptions, 'commercialContent' | 'yourBrand' | 'brandedContent'>,
): 'promotional' | 'paid_partnership' | null {
  if (!options.commercialContent) return null;
  if (options.brandedContent) return 'paid_partnership';
  return options.yourBrand ? 'promotional' : null;
}

/** Declaração exibida antes do botão de publicar: só música, ou política de conteúdo de marca + música. */
export function requiredDeclaration(
  options: Pick<TikTokPostOptions, 'commercialContent' | 'brandedContent'>,
): 'music' | 'branded_and_music' {
  return options.commercialContent && options.brandedContent ? 'branded_and_music' : 'music';
}

/**
 * Opções coerentes para gravar: sem divulgação comercial, os tipos ficam desmarcados; o consentimento só vale
 * para o agendamento confirmado agora (`consentedAt`), senão é limpo.
 */
export function normalizeTikTokOptions(
  options: TikTokPostOptions,
  consentedAt: string | null,
): TikTokPostOptions {
  return {
    ...options,
    yourBrand: options.commercialContent && options.yourBrand,
    brandedContent: options.commercialContent && options.brandedContent,
    consentedAt,
  };
}
