import type { IntegrationStatus } from '@/lib/integrations';
import type { Platform } from '@/types';

/**
 * Contrato para geração de texto assistida por IA.
 *
 * Implementações:
 *  - `MockAIProvider` (atual): modelos de texto locais, determinísticos, sem rede;
 *  - `OpenAIProvider` (planejado): chamadas feitas pelo lado Rust, com a chave de API
 *    no Credential Manager — nunca no frontend nem em variáveis VITE_* (docs/SECURITY.md).
 */
export interface AIProvider {
  readonly id: string;
  readonly label: string;
  readonly integrationStatus: IntegrationStatus;
  /** `true` quando o resultado não vem de um modelo real. */
  readonly simulated: boolean;

  generateCaptions(request: CaptionRequest): Promise<CaptionSuggestion[]>;
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
