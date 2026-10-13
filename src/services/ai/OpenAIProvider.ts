import { z } from 'zod';

import { AppError } from '@/lib/errors';

import {
  type AIProvider,
  type CaptionRequest,
  type CaptionSuggestion,
  type PostPlanDraft,
  postPlanDraftSchema,
  type PostPlanRequest,
  SCHEDULE_MODES,
} from './AIProvider';

interface OpenAIProviderDeps {
  /** Envia o corpo do Chat Completions pelo lado Rust (que anexa a chave). */
  complete: (body: Record<string, unknown>) => Promise<unknown>;
  getModel: () => Promise<string>;
}

type ChatMessage = Record<string, unknown>;

const chatResponseSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string().nullable(),
          refusal: z.string().nullable().optional(),
        }),
      }),
    )
    .min(1),
});

const captionsSchema = z.object({
  suggestions: z.array(z.object({ text: z.string(), hashtags: z.array(z.string()) })),
});

const LANGUAGE_NAMES: Record<CaptionRequest['language'], string> = {
  'pt-BR': 'português do Brasil',
  en: 'inglês',
  es: 'espanhol',
};

const TONE_NAMES: Record<CaptionRequest['tone'], string> = {
  casual: 'casual',
  informative: 'informativo',
  fun: 'divertido',
  professional: 'profissional',
};

const PLAN_SYSTEM_PROMPT = `Você é o assistente de publicação do Yeaax Manager, um app que gerencia canais do TikTok e do Instagram.
Você recebe um vídeo (miniatura + metadados), a lista de canais disponíveis e um pedido do usuário. Monte um plano de publicação que cumpra o pedido.

Regras:
- Use somente channelId da lista e nunca canais com alreadyHasThisVideo = true. Se o pedido não citar canais nem plataformas, escolha os canais conectados que combinam com o conteúdo (marca/tema); na dúvida, inclua todos os conectados.
- Escreva a legenda no idioma pedido (padrão: português do Brasil), natural, com um gancho forte na primeira linha. Não coloque hashtags no texto da legenda — elas vão no campo hashtags.
- Hashtags: relevantes ao que aparece na miniatura, ao nome do arquivo, às tags e ao pedido; cada uma começando com "#"; entre 3 e 8 salvo pedido diferente; respeite maxHashtags do canal.
- A legenda somada às hashtags deve caber em captionMaxLength do canal. Pode adaptar a legenda por plataforma.
- schedule.mode: "now" se o usuário pedir para postar já; "datetime" (datetime no formato YYYY-MM-DDTHH:mm, horário local) se citar dia/hora — resolva expressões como "amanhã" ou "sexta" a partir de "now"; "auto" se não citar horário (o app usará suggestedTimes); "none" se pedir apenas um rascunho. Em outros modos, datetime = null.
- summary: 1 ou 2 frases em português explicando o que você entendeu e fez, incluindo o que identificou no vídeo.
- Não invente fatos que não possam ser inferidos da miniatura, do nome do arquivo ou das tags.`;

function planJsonSchema(channelIds: string[]) {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'language', 'posts', 'schedule'],
    properties: {
      summary: { type: 'string' },
      language: { type: 'string' },
      posts: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['channelId', 'caption', 'hashtags'],
          properties: {
            channelId: { type: 'string', enum: channelIds },
            caption: { type: 'string' },
            hashtags: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      schedule: {
        type: 'object',
        additionalProperties: false,
        required: ['mode', 'datetime'],
        properties: {
          mode: { type: 'string', enum: [...SCHEDULE_MODES] },
          datetime: { type: ['string', 'null'] },
        },
      },
    },
  };
}

const CAPTIONS_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['suggestions'],
  properties: {
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'hashtags'],
        properties: {
          text: { type: 'string' },
          hashtags: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
};

/**
 * IA real via OpenAI (Chat Completions + Structured Outputs). A chamada HTTP e a chave
 * ficam no Rust (`ai_chat_completion`); aqui só montamos o pedido e validamos a resposta.
 */
export class OpenAIProvider implements AIProvider {
  readonly id = 'openai';
  readonly label = 'OpenAI';
  readonly simulated = false;

  private readonly deps: OpenAIProviderDeps;

  constructor(deps: OpenAIProviderDeps) {
    this.deps = deps;
  }

  private async completeJson<T>(
    name: string,
    jsonSchema: Record<string, unknown>,
    resultSchema: z.ZodType<T>,
    messages: ChatMessage[],
  ): Promise<T> {
    const response = chatResponseSchema.safeParse(
      await this.deps.complete({
        model: await this.deps.getModel(),
        messages,
        response_format: {
          type: 'json_schema',
          json_schema: { name, schema: jsonSchema, strict: true },
        },
      }),
    );
    if (!response.success) {
      throw new AppError('AI_ERROR', 'A OpenAI devolveu uma resposta em formato inesperado.');
    }

    const message = response.data.choices[0]?.message;
    if (message?.refusal) {
      throw new AppError('AI_ERROR', `A IA recusou o pedido: ${message.refusal}`);
    }
    try {
      return resultSchema.parse(JSON.parse(message?.content ?? ''));
    } catch (error) {
      throw new AppError('AI_ERROR', 'A resposta da IA não seguiu o formato esperado.', {
        cause: error,
      });
    }
  }

  async generateCaptions(request: CaptionRequest): Promise<CaptionSuggestion[]> {
    const result = await this.completeJson(
      'caption_suggestions',
      CAPTIONS_JSON_SCHEMA,
      captionsSchema,
      [
        {
          role: 'system',
          content:
            'Você escreve legendas para vídeos curtos de redes sociais. Gere exatamente 3 variações ' +
            'diferentes entre si. Hashtags vão no campo hashtags (com "#"), não no texto.',
        },
        {
          role: 'user',
          content:
            `Vídeo: ${request.description}\nPlataforma: ${request.platform}\n` +
            `Idioma: ${LANGUAGE_NAMES[request.language]}\nTom: ${TONE_NAMES[request.tone]}\n` +
            `Incluir hashtags: ${request.includeHashtags ? 'sim (3 a 8)' : 'não (lista vazia)'}`,
        },
      ],
    );

    return result.suggestions.slice(0, 3).map((suggestion, index) => ({
      id: `openai-${index}`,
      text:
        suggestion.hashtags.length > 0
          ? `${suggestion.text.trim()}\n\n${suggestion.hashtags.join(' ')}`
          : suggestion.text.trim(),
      hashtags: suggestion.hashtags,
    }));
  }

  async planPost(request: PostPlanRequest): Promise<PostPlanDraft> {
    const { thumbnailDataUrl, ...media } = request.media;
    const context = { ...request, media };
    const userContent: ChatMessage[] = [{ type: 'text', text: JSON.stringify(context) }];
    if (thumbnailDataUrl) {
      userContent.push({ type: 'image_url', image_url: { url: thumbnailDataUrl, detail: 'low' } });
    }

    return this.completeJson(
      'post_plan',
      planJsonSchema(request.channels.map((channel) => channel.id)),
      postPlanDraftSchema,
      [
        { role: 'system', content: PLAN_SYSTEM_PROMPT },
        { role: 'user', content: userContent },
      ],
    );
  }

  /** Pedido mínimo para validar chave, créditos e modelo. */
  async testConnection(): Promise<void> {
    await this.completeJson(
      'connection_test',
      {
        type: 'object',
        additionalProperties: false,
        required: ['ok'],
        properties: { ok: { type: 'boolean' } },
      },
      z.object({ ok: z.boolean() }),
      [{ role: 'user', content: 'Responda com {"ok": true}.' }],
    );
  }
}
