import { describe, expect, it } from 'vitest';

import { groupByDay, groupByDayAndHour, moveToSlot, slotKey } from './calendarLayout';

const local = (day: number, hour: number, minute = 0) =>
  new Date(2026, 9, day, hour, minute).toISOString();

describe('calendarLayout', () => {
  const posts = [
    { id: 'a', scheduledAt: local(7, 19, 30) },
    { id: 'b', scheduledAt: local(7, 19, 45) },
    { id: 'c', scheduledAt: local(8, 9, 0) },
    { id: 'd', scheduledAt: null },
  ];

  it('agrupa por dia local e ignora posts sem data', () => {
    const groups = groupByDay(posts);
    expect(groups.get('2026-10-07')?.map((post) => post.id)).toEqual(['a', 'b']);
    expect(groups.get('2026-10-08')?.map((post) => post.id)).toEqual(['c']);
    expect([...groups.values()].flat()).toHaveLength(3);
  });

  it('agrupa por dia e hora para a grade semanal', () => {
    const groups = groupByDayAndHour(posts);
    expect(groups.get(slotKey(new Date(2026, 9, 7), 19))).toHaveLength(2);
    expect(groups.get(slotKey(new Date(2026, 9, 8), 9))).toHaveLength(1);
  });

  it('preserva os minutos ao mover para outra célula', () => {
    const moved = moveToSlot(new Date(2026, 9, 7, 19, 30), new Date(2026, 9, 9), 15);
    expect(moved).toEqual(new Date(2026, 9, 9, 15, 30));
    expect(moveToSlot(null, new Date(2026, 9, 9), 8)).toEqual(new Date(2026, 9, 9, 8, 0));
  });
});
