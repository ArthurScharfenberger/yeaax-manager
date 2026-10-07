import { describe, expect, it } from 'vitest';

import { formatDuration, formatFileSize, formatScheduleLabel, truncate } from './format';

describe('formatDuration', () => {
  it('formata segundos em m:ss e h:mm:ss', () => {
    expect(formatDuration(42)).toBe('0:42');
    expect(formatDuration(130)).toBe('2:10');
    expect(formatDuration(3903)).toBe('1:05:03');
  });

  it('usa placeholder quando a duração é desconhecida', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(Number.NaN)).toBe('—');
  });
});

describe('formatFileSize', () => {
  it('usa unidades binárias com vírgula decimal', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1536)).toBe('1,5 KB');
    expect(formatFileSize(50_550_000)).toBe('48,2 MB');
  });
});

describe('formatScheduleLabel', () => {
  const now = new Date(2026, 9, 7, 10, 0);

  it('usa Hoje/Amanhã/Ontem para datas próximas', () => {
    expect(formatScheduleLabel(new Date(2026, 9, 7, 19, 30), now)).toBe('Hoje 19:30');
    expect(formatScheduleLabel(new Date(2026, 9, 8, 9, 0), now)).toBe('Amanhã 09:00');
    expect(formatScheduleLabel(new Date(2026, 9, 6, 14, 0), now)).toBe('Ontem 14:00');
  });

  it('usa dia da semana e data para datas distantes', () => {
    expect(formatScheduleLabel(new Date(2026, 9, 9, 12, 0), now)).toMatch(/09\/10.*12:00$/);
  });
});

describe('truncate', () => {
  it('mantém textos curtos', () => {
    expect(truncate('curto', 10)).toBe('curto');
  });

  it('corta em limite de palavra quando possível', () => {
    expect(truncate('Civic Si no rolling shot de fim de tarde', 20)).toBe('Civic Si no rolling…');
  });
});
