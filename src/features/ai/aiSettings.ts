import { z } from 'zod';

import { defineSetting } from '@/lib/settings';

/**
 * Modelo da OpenAI usado em legendas e em "Postar com IA".
 * Padrão: o modelo mais econômico com entrada de imagem do catálogo oficial (verificado em
 * 2026-10-07 — ver docs/API_NOTES.md). Pode ser trocado em Configurações → IA.
 */
export const DEFAULT_OPENAI_MODEL = 'gpt-6-luna';

export const AI_MODEL_SETTING = defineSetting(
  'ai.openai.model',
  z.string().trim().min(1).max(100),
  DEFAULT_OPENAI_MODEL,
);
