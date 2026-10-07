import { toLocalDateTimeValue } from '@/utils/date';

import type { CaptionLanguage, PostPlanDraft, PostPlanRequest } from './AIProvider';
import { extractHashtags, normalizeHashtag } from './hashtags';

/**
 * Interpretador local por regras para "Postar com IA" quando não há chave da OpenAI.
 * Entende idioma, plataformas, canais citados e horários simples ("amanhã às 19h").
 * É propositalmente limitado: serve para o fluxo funcionar offline, não substitui a IA.
 */

const LANGUAGE_RULES: [RegExp, CaptionLanguage][] = [
  [/ingl[eê]s|english/i, 'en'],
  [/espanhol|spanish|español/i, 'es'],
];

const CLOSINGS: Record<CaptionLanguage, string> = {
  'pt-BR': 'O que vocês acharam? Comenta aí! 👇',
  en: 'What do you think? Let us know in the comments! 👇',
  es: '¿Qué opinan? ¡Déjenlo en los comentarios! 👇',
};

const LANGUAGE_NAMES: Record<CaptionLanguage, string> = {
  'pt-BR': 'português',
  en: 'inglês',
  es: 'espanhol',
};

function detectLanguage(instruction: string): CaptionLanguage {
  return LANGUAGE_RULES.find(([pattern]) => pattern.test(instruction))?.[1] ?? 'pt-BR';
}

function detectSchedule(instruction: string, now: Date): PostPlanDraft['schedule'] {
  if (/\bagora\b|imediata|\bnow\b|right away/i.test(instruction)) {
    return { mode: 'now', datetime: null };
  }

  const time = /(?:às|as|at)?\s*\b([01]?\d|2[0-3])\s*(?:h|:)\s*([0-5]\d)?\b/i.exec(instruction);
  const tomorrow = /amanh[ãa]|tomorrow/i.test(instruction);
  if (!time && !tomorrow) return { mode: 'auto', datetime: null };
  if (!time) return { mode: 'auto', datetime: null };

  const date = new Date(now);
  date.setHours(Number(time[1]), Number(time[2] ?? 0), 0, 0);
  if (tomorrow || date <= now) date.setDate(date.getDate() + 1);
  return { mode: 'datetime', datetime: toLocalDateTimeValue(date) };
}

function pickChannels(request: PostPlanRequest): PostPlanRequest['channels'] {
  const text = request.instruction.toLowerCase();
  const wantsTikTok = /tik\s?tok/.test(text);
  const wantsInstagram = /insta(gram)?|reels?/.test(text);
  const byPlatform = request.channels.filter(
    (channel) =>
      (!wantsTikTok && !wantsInstagram) ||
      (wantsTikTok && channel.platform === 'tiktok') ||
      (wantsInstagram && channel.platform === 'instagram'),
  );

  const named = byPlatform.filter(
    (channel) =>
      text.includes(channel.username.toLowerCase()) ||
      text.includes(channel.displayName.toLowerCase()),
  );
  const candidates = (named.length > 0 ? named : byPlatform).filter(
    (channel) => !channel.alreadyHasThisVideo,
  );
  const connected = candidates.filter((channel) => channel.connected);
  return connected.length > 0 ? connected : candidates;
}

/** `civic-si_rolling shot.mp4` → `Civic si rolling shot`. */
function titleFromFilename(filename: string): string {
  const base = filename
    .replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return base.charAt(0).toUpperCase() + base.slice(1);
}

export function interpretInstruction(request: PostPlanRequest, now: Date): PostPlanDraft {
  const language = detectLanguage(request.instruction);
  const channels = pickChannels(request);
  const title = titleFromFilename(request.media.filename);
  const wantsMoreHashtags = /hashtag|tags/i.test(request.instruction);
  const hashtags = [
    ...new Set([
      ...request.media.tags
        .map((tag) => `#${normalizeHashtag(tag)}`)
        .filter((tag) => tag.length > 1),
      ...extractHashtags(title, wantsMoreHashtags ? 8 : 4),
    ]),
  ];
  const schedule = detectSchedule(request.instruction, now);

  const mentionedChannel = channels.length < request.channels.length;
  const scheduleText =
    schedule.mode === 'now'
      ? 'publicar assim que possível'
      : schedule.mode === 'datetime'
        ? `agendar para ${schedule.datetime?.replace('T', ' às ') ?? ''}`
        : 'usar o próximo horário do Auto Schedule';

  return {
    summary:
      `Interpretação simulada (sem IA real): legenda em ${LANGUAGE_NAMES[language]}, ` +
      `${channels.length} canal(is)${mentionedChannel ? '' : ' — nenhum foi citado, então incluí todos os conectados'}, ` +
      `${scheduleText}. Configure a chave da OpenAI em Configurações → IA para legendas reais.`,
    language,
    posts: channels.map((channel) => ({
      channelId: channel.id,
      caption: `${title} 👀\n\n${CLOSINGS[language]}`,
      hashtags: channel.maxHashtags === null ? hashtags : hashtags.slice(0, channel.maxHashtags),
    })),
    schedule,
  };
}
