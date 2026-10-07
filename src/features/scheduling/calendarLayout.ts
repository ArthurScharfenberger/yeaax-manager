import type { PostStatus } from '@/types';
import { toDateInputValue } from '@/utils/date';

/** Status exibidos no calendário (cancelados ficam de fora). */
export const CALENDAR_STATUSES: readonly PostStatus[] = [
  'draft',
  'review',
  'scheduled',
  'publishing',
  'published',
  'failed',
];

export const HOURS_OF_DAY = Array.from({ length: 24 }, (_, hour) => hour);

/** Chave estável de dia local (`YYYY-MM-DD`). */
export function dayKey(date: Date): string {
  return toDateInputValue(date);
}

/** Agrupa posts com data por dia local, mantendo a ordem recebida. */
export function groupByDay<T extends { scheduledAt: string | null }>(
  items: readonly T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    if (!item.scheduledAt) continue;
    const key = dayKey(new Date(item.scheduledAt));
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

/** Agrupa por `dia|hora` local, para a grade semanal. */
export function groupByDayAndHour<T extends { scheduledAt: string | null }>(
  items: readonly T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    if (!item.scheduledAt) continue;
    const date = new Date(item.scheduledAt);
    const key = slotKey(date, date.getHours());
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }
  return groups;
}

export function slotKey(day: Date, hour: number): string {
  return `${dayKey(day)}|${hour}`;
}

/**
 * Novo horário ao soltar um post em uma célula (dia + hora), preservando os minutos
 * originais — arrastar um post das 19:30 para a célula das 15h resulta em 15:30.
 */
export function moveToSlot(original: Date | null, day: Date, hour: number): Date {
  const result = new Date(day);
  result.setHours(hour, original?.getMinutes() ?? 0, 0, 0);
  return result;
}
