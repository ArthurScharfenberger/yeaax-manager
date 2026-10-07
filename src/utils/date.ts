/**
 * Utilitários de data no fuso local do usuário.
 * Persistência usa ISO UTC; a interface trabalha com datas locais.
 */

export type WeekStart = 'monday' | 'sunday';

const MINUTES_PER_DAY = 24 * 60;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Início da semana (00:00) que contém `date`. */
export function startOfWeek(date: Date, weekStart: WeekStart): Date {
  const day = date.getDay(); // 0 = domingo
  const offset = weekStart === 'monday' ? (day + 6) % 7 : day;
  return startOfDay(addDays(date, -offset));
}

/** Os 7 dias da semana iniciada em `weekStartDate`. */
export function getWeekDays(weekStartDate: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStartDate, index));
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** `YYYY-MM-DD` para `<input type="date">`. */
export function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `HH:mm` para `<input type="time">`. */
export function toTimeInputValue(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** Converte `HH:mm` em minutos desde 00:00. Retorna `null` se inválido. */
export function timeToMinutes(time: string): number | null {
  const match = TIME_PATTERN.exec(time);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/** Converte minutos desde 00:00 em `HH:mm`. */
export function minutesToTime(minutes: number): string {
  const normalized = ((Math.round(minutes) % MINUTES_PER_DAY) + MINUTES_PER_DAY) % MINUTES_PER_DAY;
  return `${pad(Math.floor(normalized / 60))}:${pad(normalized % 60)}`;
}

/** Combina valores de `<input type="date">` e `<input type="time">` em uma data local. */
export function parseDateTimeInput(date: string, time: string): Date | null {
  const dateMatch = DATE_PATTERN.exec(date);
  const minutes = timeToMinutes(time);
  if (!dateMatch || minutes === null) return null;

  const result = new Date(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Math.floor(minutes / 60),
    minutes % 60,
  );
  return Number.isNaN(result.getTime()) ? null : result;
}

/** `YYYY-MM-DDTHH:mm` (horário local) → Date. Retorna `null` se inválido. */
export function parseLocalDateTime(value: string): Date | null {
  const [date, time] = value.split('T');
  return date && time ? parseDateTimeInput(date, time) : null;
}

/** Date → `YYYY-MM-DDTHH:mm` (horário local). */
export function toLocalDateTimeValue(date: Date): string {
  return `${toDateInputValue(date)}T${toTimeInputValue(date)}`;
}

/** Arredonda para cima até o próximo múltiplo de `stepMinutes`. */
export function ceilToMinutes(date: Date, stepMinutes: number): Date {
  const stepMs = stepMinutes * 60_000;
  return new Date(Math.ceil(date.getTime() / stepMs) * stepMs);
}
