import { describe, expect, it } from 'vitest';

import {
  addDays,
  ceilToMinutes,
  getWeekDays,
  minutesToTime,
  parseDateTimeInput,
  startOfWeek,
  timeToMinutes,
  toDateInputValue,
  toTimeInputValue,
} from './date';

describe('startOfWeek', () => {
  // 2026-10-07 é uma quarta-feira.
  const wednesday = new Date(2026, 9, 7, 15, 45);

  it('começa na segunda-feira por padrão brasileiro', () => {
    expect(startOfWeek(wednesday, 'monday')).toEqual(new Date(2026, 9, 5));
  });

  it('suporta semana iniciando no domingo', () => {
    expect(startOfWeek(wednesday, 'sunday')).toEqual(new Date(2026, 9, 4));
  });

  it('trata domingo como último dia da semana iniciada na segunda', () => {
    const sunday = new Date(2026, 9, 11, 10);
    expect(startOfWeek(sunday, 'monday')).toEqual(new Date(2026, 9, 5));
  });
});

describe('getWeekDays', () => {
  it('retorna 7 dias consecutivos', () => {
    const days = getWeekDays(new Date(2026, 9, 5));
    expect(days).toHaveLength(7);
    expect(days[6]).toEqual(new Date(2026, 9, 11));
  });

  it('atravessa a virada de mês', () => {
    const days = getWeekDays(new Date(2026, 9, 26));
    expect(toDateInputValue(days[6]!)).toBe('2026-11-01');
  });
});

describe('conversões de input', () => {
  it('combina data e hora locais', () => {
    expect(parseDateTimeInput('2026-10-07', '19:30')).toEqual(new Date(2026, 9, 7, 19, 30));
  });

  it('rejeita valores inválidos', () => {
    expect(parseDateTimeInput('', '19:30')).toBeNull();
    expect(parseDateTimeInput('2026-10-07', '24:00')).toBeNull();
    expect(parseDateTimeInput('07/10/2026', '10:00')).toBeNull();
  });

  it('formata para os inputs nativos', () => {
    const date = new Date(2026, 0, 3, 8, 5);
    expect(toDateInputValue(date)).toBe('2026-01-03');
    expect(toTimeInputValue(date)).toBe('08:05');
  });
});

describe('minutos', () => {
  it('converte HH:mm em minutos e vice-versa', () => {
    expect(timeToMinutes('09:30')).toBe(570);
    expect(timeToMinutes('9:30')).toBeNull();
    expect(minutesToTime(570)).toBe('09:30');
    expect(minutesToTime(24 * 60 + 15)).toBe('00:15');
  });

  it('arredonda para o próximo múltiplo', () => {
    expect(ceilToMinutes(new Date(2026, 9, 7, 10, 7), 15)).toEqual(new Date(2026, 9, 7, 10, 15));
    expect(ceilToMinutes(new Date(2026, 9, 7, 10, 15), 15)).toEqual(new Date(2026, 9, 7, 10, 15));
  });

  it('soma dias respeitando o calendário local', () => {
    expect(addDays(new Date(2026, 1, 28), 1)).toEqual(new Date(2026, 2, 1));
  });
});
