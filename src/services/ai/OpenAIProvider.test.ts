import { describe, expect, it } from 'vitest';

import type { PostPlanRequest } from './AIProvider';
import { OpenAIProvider } from './OpenAIProvider';

const REQUEST: PostPlanRequest = {
  instruction: 'Legenda em inglês',
  media: {
    filename: 'civic.mp4',
    durationSeconds: 42,
    width: 1080,
    height: 1920,
    tags: [],
    thumbnailDataUrl: 'data:image/jpeg;base64,AAAA',
  },
  channels: [
    {
      id: 'ig-1',
      platform: 'instagram',
      username: 'yeaxx',
      displayName: 'YEAXX Cars',
      connected: true,
      alreadyHasThisVideo: false,
      captionMaxLength: 2200,
      maxHashtags: 30,
    },
  ],
  suggestedTimes: [],
  now: '2026-10-07T14:00',
  timezone: 'America/Sao_Paulo',
};

function reply(content: unknown, refusal: string | null = null) {
  return { choices: [{ message: { content: JSON.stringify(content), refusal } }] };
}

const PLAN = {
  summary: 'Legenda em inglês para o Instagram.',
  language: 'en',
  posts: [{ channelId: 'ig-1', caption: 'Sunset run 🌅', hashtags: ['#civic'] }],
  schedule: { mode: 'auto', datetime: null },
};

describe('OpenAIProvider', () => {
  it('envia saída estruturada estrita, canais restritos e a miniatura', async () => {
    const bodies: Record<string, unknown>[] = [];
    const provider = new OpenAIProvider({
      complete: (body) => {
        bodies.push(body);
        return Promise.resolve(reply(PLAN));
      },
      getModel: () => Promise.resolve('gpt-6-luna'),
    });

    await expect(provider.planPost(REQUEST)).resolves.toEqual(PLAN);

    const body = bodies[0] as {
      model: string;
      response_format: { json_schema: { strict: boolean; schema: unknown } };
      messages: { content: unknown }[];
    };
    expect(body.model).toBe('gpt-6-luna');
    expect(body.response_format.json_schema.strict).toBe(true);
    expect(JSON.stringify(body.response_format.json_schema.schema)).toContain('"enum":["ig-1"]');
    const userContent = JSON.stringify(body.messages[1]?.content);
    expect(userContent).toContain('image_url');
    // A miniatura vai como imagem, não duplicada no texto do contexto.
    expect(userContent.match(/data:image/g)).toHaveLength(1);
  });

  it('rejeita respostas fora do formato e recusas', async () => {
    const invalid = new OpenAIProvider({
      complete: () => Promise.resolve(reply({ posts: 'x' })),
      getModel: () => Promise.resolve('m'),
    });
    await expect(invalid.planPost(REQUEST)).rejects.toMatchObject({ code: 'AI_ERROR' });

    const refused = new OpenAIProvider({
      complete: () => Promise.resolve(reply(null, 'não posso ajudar')),
      getModel: () => Promise.resolve('m'),
    });
    await expect(refused.planPost(REQUEST)).rejects.toMatchObject({ code: 'AI_ERROR' });
  });
});
