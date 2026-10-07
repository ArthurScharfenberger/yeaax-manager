/**
 * Gerador local de hashtags a partir de texto livre (sem IA).
 * Usado pelo `MockAIProvider` e reaproveitável como fallback offline.
 */

const MIN_WORD_LENGTH = 4;
const MAX_HASHTAG_LENGTH = 30;

const STOP_WORDS = new Set(
  `
  para com como que uma umas uns dos das nos nas pelo pela mais muito muita esse essa este
  esta isso isto aqui onde quando seu sua seus suas meu minha sobre entre depois antes ainda
  também porque você vocês eles elas fazer feito tudo todo toda cada mesmo mesma qual quais
  será foram está estão vídeo video
  with this that from your have what when where which about into just like more very they
  them then than will
  `
    .trim()
    .split(/\s+/),
);

/** Remove acentos e caracteres não permitidos: `Mecânica Rápida` → `mecanicarapida`. */
export function normalizeHashtag(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, MAX_HASHTAG_LENGTH);
}

/** Hashtags já presentes no texto, normalizadas e sem duplicatas. */
export function findHashtags(text: string): string[] {
  const matches = text.match(/#[\p{L}\p{N}_]+/gu) ?? [];
  return unique(matches.map((tag) => normalizeHashtag(tag.slice(1))).filter(Boolean)).map(
    (tag) => `#${tag}`,
  );
}

/** Extrai até `limit` hashtags relevantes de uma descrição. */
export function extractHashtags(text: string, limit = 8): string[] {
  const existing = findHashtags(text);
  const words = text
    .replace(/#[\p{L}\p{N}_]+/gu, ' ')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= MIN_WORD_LENGTH && !STOP_WORDS.has(word.toLowerCase()))
    .map(normalizeHashtag)
    .filter((word) => word.length >= MIN_WORD_LENGTH && !/^\d+$/.test(word))
    .map((word) => `#${word}`);

  return unique([...existing, ...words]).slice(0, limit);
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
