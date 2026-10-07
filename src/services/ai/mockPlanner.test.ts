import { describe, expect, it } from 'vitest';

import type { PostPlanRequest } from './AIProvider';
import { interpretInstruction } from './mockPlanner';

const NOW = new Date(2026, 9, 7, 14, 0);

function request(instruction: string): PostPlanRequest {
  const channel = (
    id: string,
    platform: 'tiktok' | 'instagram',
    username: string,
    displayName: string,
    connected = true,
  ) => ({
    id,
    platform,
    username,
    displayName,
    connected,
    alreadyHasThisVideo: false,
    captionMaxLength: 2200,
    maxHashtags: platform === 'instagram' ? 30 : null,
  });
  return {
    instruction,
    media: {
      filename: 'civic-si-rolling-shot.mp4',
      durationSeconds: 42,
      width: 1080,
      height: 1920,
      tags: ['carros'],
      thumbnailDataUrl: null,
    },
    channels: [
      channel('yeaxx-tt', 'tiktok', 'yeaxx', 'YEAXX Cars'),
      channel('yeaxx-ig', 'instagram', 'yeaxx', 'YEAXX Cars'),
      channel('techfix-tt', 'tiktok', 'techfix.rs', 'TechFix'),
      channel('clipes-tt', 'tiktok', 'clipes.diarios', 'Clipes', false),
    ],
    suggestedTimes: [],
    now: '2026-10-07T14:00',
    timezone: 'America/Sao_Paulo',
  };
}

describe('interpretInstruction (simulador local)', () => {
  it('entende idioma, plataforma e canal citados', () => {
    const plan = interpretInstruction(request('Poste no instagram da yeaxx em inglês'), NOW);
    expect(plan.language).toBe('en');
    expect(plan.posts.map((post) => post.channelId)).toEqual(['yeaxx-ig']);
    expect(plan.posts[0]?.caption).toContain('What do you think');
    expect(plan.posts[0]?.hashtags).toContain('#carros');
  });

  it('sem canal citado, usa todos os conectados', () => {
    const plan = interpretInstruction(request('Poste com boas hashtags'), NOW);
    expect(plan.posts.map((post) => post.channelId)).toEqual([
      'yeaxx-tt',
      'yeaxx-ig',
      'techfix-tt',
    ]);
    expect(plan.schedule).toEqual({ mode: 'auto', datetime: null });
  });

  it('entende horários: agora, "amanhã às 19h" e horário já passado hoje', () => {
    expect(interpretInstruction(request('posta agora'), NOW).schedule.mode).toBe('now');
    expect(interpretInstruction(request('amanhã às 19h'), NOW).schedule).toEqual({
      mode: 'datetime',
      datetime: '2026-10-08T19:00',
    });
    expect(interpretInstruction(request('às 18:30'), NOW).schedule.datetime).toBe(
      '2026-10-07T18:30',
    );
    expect(interpretInstruction(request('às 9h'), NOW).schedule.datetime).toBe('2026-10-08T09:00');
  });
});
