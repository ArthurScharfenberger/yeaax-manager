import type { IntegrationStatus } from '@/lib/integrations';
import { PLATFORM_INFO } from '@/lib/platforms';

import type {
  AIProvider,
  CaptionLanguage,
  CaptionRequest,
  CaptionSuggestion,
  CaptionTone,
} from './AIProvider';
import { extractHashtags } from './hashtags';

type CaptionTemplate = (description: string) => string;

/** Modelos de texto locais por idioma e tom. Sem IA: apenas variações determinísticas. */
const TEMPLATES: Record<CaptionLanguage, Record<CaptionTone, CaptionTemplate[]>> = {
  'pt-BR': {
    casual: [
      (d) => `${d} 👀\n\nO que vocês acharam? Comenta aí!`,
      (d) => `Olha só isso: ${lowerFirst(d)}.\n\nSegue para ver os próximos!`,
      (d) => `${d}.\n\nSalva para não perder 📌`,
    ],
    informative: [
      (d) => `${d}.\n\nSalve este vídeo para consultar depois.`,
      (d) => `Passo a passo: ${lowerFirst(d)}.\n\nDúvidas? Deixe nos comentários.`,
      (d) => `Você sabia? ${d}.\n\nCompartilhe com quem precisa ver isso.`,
    ],
    fun: [
      (d) => `${d} 😂\n\nMarca aquele amigo que precisa ver isso!`,
      (d) => `Ninguém esperava por isso: ${lowerFirst(d)} 🤯`,
      (d) => `POV: ${lowerFirst(d)} 🔥`,
    ],
    professional: [
      (d) => `${d}.\n\nAcompanhe o perfil para mais conteúdos como este.`,
      (d) => `Neste vídeo: ${lowerFirst(d)}.\n\nFale com a gente pelo direct.`,
      (d) => `${d}. Qualidade e transparência em cada detalhe.`,
    ],
  },
  en: {
    casual: [
      (d) => `${d} 👀\n\nWhat do you think? Drop a comment!`,
      (d) => `Check this out: ${lowerFirst(d)}.\n\nFollow for more!`,
      (d) => `${d}.\n\nSave it for later 📌`,
    ],
    informative: [
      (d) => `${d}.\n\nSave this video for later.`,
      (d) => `Step by step: ${lowerFirst(d)}.\n\nQuestions? Ask in the comments.`,
      (d) => `Did you know? ${d}.\n\nShare it with someone who needs it.`,
    ],
    fun: [
      (d) => `${d} 😂\n\nTag a friend who needs to see this!`,
      (d) => `Nobody expected this: ${lowerFirst(d)} 🤯`,
      (d) => `POV: ${lowerFirst(d)} 🔥`,
    ],
    professional: [
      (d) => `${d}.\n\nFollow for more content like this.`,
      (d) => `In this video: ${lowerFirst(d)}.\n\nSend us a DM to learn more.`,
      (d) => `${d}. Quality and transparency in every detail.`,
    ],
  },
  es: {
    casual: [
      (d) => `${d} 👀\n\n¿Qué opinan? ¡Comenten!`,
      (d) => `Miren esto: ${lowerFirst(d)}.\n\n¡Síguenos para más!`,
      (d) => `${d}.\n\nGuárdalo para después 📌`,
    ],
    informative: [
      (d) => `${d}.\n\nGuarda este video para consultarlo luego.`,
      (d) => `Paso a paso: ${lowerFirst(d)}.\n\n¿Dudas? Déjalas en los comentarios.`,
      (d) => `¿Sabías que? ${d}.\n\nCompártelo con quien lo necesite.`,
    ],
    fun: [
      (d) => `${d} 😂\n\n¡Etiqueta a ese amigo que tiene que verlo!`,
      (d) => `Nadie esperaba esto: ${lowerFirst(d)} 🤯`,
      (d) => `POV: ${lowerFirst(d)} 🔥`,
    ],
    professional: [
      (d) => `${d}.\n\nSíguenos para más contenido como este.`,
      (d) => `En este video: ${lowerFirst(d)}.\n\nEscríbenos por mensaje directo.`,
      (d) => `${d}. Calidad y transparencia en cada detalle.`,
    ],
  },
};

const LATENCY_MS = 450;

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function cleanDescription(description: string): string {
  return description
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.!?]+$/, '');
}

/** Gerador simulado de legendas. Não usa rede nem IA. */
export class MockAIProvider implements AIProvider {
  readonly id = 'mock';
  readonly label = 'Gerador local (simulado)';
  readonly integrationStatus: IntegrationStatus = 'MOCK';
  readonly simulated = true;

  async generateCaptions(request: CaptionRequest): Promise<CaptionSuggestion[]> {
    await new Promise((resolve) => setTimeout(resolve, LATENCY_MS));

    const description = cleanDescription(request.description);
    const hashtags = request.includeHashtags ? extractHashtags(request.description, 6) : [];
    const maxLength = PLATFORM_INFO[request.platform].limits.captionMaxLength;

    return TEMPLATES[request.language][request.tone].map((template, index) => {
      const body = template(description);
      const text = hashtags.length > 0 ? `${body}\n\n${hashtags.join(' ')}` : body;
      return { id: `mock-${index}`, text: text.slice(0, maxLength), hashtags };
    });
  }
}
