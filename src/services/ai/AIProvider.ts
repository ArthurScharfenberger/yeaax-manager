import { z } from 'zod';

import type { Platform } from '@/types';

/**
 * Contrato para recursos de IA. O restante do app não sabe qual modelo está por trás.
 *
 * Implementações:
 *  - `OpenAIProvider`: chamadas feitas pelo lado Rust, com a chave no Gerenciador de
 *    Credenciais do Windows — nunca no frontend nem em variáveis VITE_* (docs/SECURITY.md);
 *  - `MockAIProvider`: interpretador local por regras, usado quando não há chave configurada.
 */
export interface AIProvider {
  readonly id: string;
  readonly label: string;
  /** `true` quando o resultado não vem de um modelo real. */
  readonly simulated: boolean;

  generateCaptions(request: CaptionRequest): Promise<CaptionSuggestion[]>;
  /** Interpreta um pedido em linguagem natural e devolve um plano de publicação. */
  planPost(request: PostPlanRequest): Promise<PostPlanDraft>;
}

export const CAPTION_LANGUAGES = ['pt-BR', 'en', 'es'] as const;
export type CaptionLanguage = (typeof CAPTION_LANGUAGES)[number];

export const CAPTION_TONES = ['casual', 'informative', 'fun', 'professional'] as const;
export type CaptionTone = (typeof CAPTION_TONES)[number];

export interface CaptionRequest {
  description: string;
  platform: Platform;
  language: CaptionLanguage;
  tone: CaptionTone;
  includeHashtags: boolean;
}

export interface CaptionSuggestion {
  id: string;
  text: string;
  hashtags: string[];
}

/** Contexto enviado à IA para montar um plano de post a partir do pedido do usuário. */
export interface PostPlanRequest {
  /** Pedido em linguagem natural, ex.: "Poste com legenda em inglês e boas hashtags". */
  instruction: string;
  media: {
    filename: string;
    durationSeconds: number | null;
    width: number | null;
    height: number | null;
    tags: string[];
    /** Miniatura em data URL (JPEG) para a IA "ver" o vídeo; `null` se indisponível. */
    thumbnailDataUrl: string | null;
  };
  channels: {
    id: string;
    platform: Platform;
    username: string;
    displayName: string;
    connected: boolean;
    /** Este vídeo já está agendado/publicado neste canal (não pode repetir). */
    alreadyHasThisVideo: boolean;
    captionMaxLength: number;
    maxHashtags: number | null;
  }[];
  /** Horários sugeridos pelo Auto Schedule, no formato local `YYYY-MM-DDTHH:mm`. */
  suggestedTimes: string[];
  /** Agora, no formato local `YYYY-MM-DDTHH:mm`, e o fuso do usuário. */
  now: string;
  timezone: string;
}

export const SCHEDULE_MODES = ['now', 'datetime', 'auto', 'none'] as const;

/** Resposta da IA (não confiável: sempre validada por este schema antes do uso). */
export const postPlanDraftSchema = z.object({
  /** O que a IA entendeu do pedido, em português, para o usuário conferir. */
  summary: z.string(),
  language: z.string(),
  posts: z.array(
    z.object({
      channelId: z.string(),
      caption: z.string(),
      hashtags: z.array(z.string()),
    }),
  ),
  schedule: z.object({
    mode: z.enum(SCHEDULE_MODES),
    /** Local `YYYY-MM-DDTHH:mm` quando `mode` é `datetime`. */
    datetime: z.string().nullable(),
  }),
});

export type PostPlanDraft = z.infer<typeof postPlanDraftSchema>;
