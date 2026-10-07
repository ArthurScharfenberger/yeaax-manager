import { describe, expect, it } from 'vitest';

import { timeToMinutes } from '@/utils/date';

import {
  autoScheduleConfigSchema,
  DEFAULT_AUTO_SCHEDULE_CONFIG,
  planDailySlots,
} from './autoSchedule';

const base = { minIntervalMinutes: 180, windowStart: '09:00', windowEnd: '22:00' };

function gaps(slots: string[]): number[] {
  const minutes = slots.map((slot) => timeToMinutes(slot)!);
  return minutes.slice(1).map((value, index) => value - minutes[index]!);
}

describe('planDailySlots', () => {
  it('distribui 2 posts com margens iguais no período', () => {
    expect(planDailySlots({ ...base, postsPerDay: 2 })).toEqual({
      slots: ['12:15', '18:45'],
      feasible: true,
      maxPostsInWindow: 4,
    });
  });

  it('coloca um único post no meio do período', () => {
    expect(planDailySlots({ ...base, postsPerDay: 1 }).slots).toEqual(['15:30']);
  });

  it('respeita o intervalo mínimo e alinha a 15 minutos', () => {
    const plan = planDailySlots({ ...base, postsPerDay: 4 });
    expect(plan.feasible).toBe(true);
    expect(plan.slots).toHaveLength(4);
    expect(gaps(plan.slots).every((gap) => gap >= 180)).toBe(true);
    expect(plan.slots.every((slot) => timeToMinutes(slot)! % 15 === 0)).toBe(true);
  });

  it('sinaliza quando a quantidade não cabe no período', () => {
    const plan = planDailySlots({ ...base, postsPerDay: 6 });
    expect(plan.feasible).toBe(false);
    expect(plan.slots).toHaveLength(plan.maxPostsInWindow);
  });

  it('retorna plano vazio para período inválido', () => {
    expect(planDailySlots({ ...base, postsPerDay: 2, windowEnd: '08:00' }).slots).toEqual([]);
  });
});

describe('autoScheduleConfigSchema', () => {
  it('aceita a configuração padrão', () => {
    expect(autoScheduleConfigSchema.safeParse(DEFAULT_AUTO_SCHEDULE_CONFIG).success).toBe(true);
  });

  it('exige ao menos uma plataforma e período válido', () => {
    expect(
      autoScheduleConfigSchema.safeParse({ ...DEFAULT_AUTO_SCHEDULE_CONFIG, platforms: [] })
        .success,
    ).toBe(false);
    expect(
      autoScheduleConfigSchema.safeParse({ ...DEFAULT_AUTO_SCHEDULE_CONFIG, windowEnd: '08:00' })
        .success,
    ).toBe(false);
  });
});
