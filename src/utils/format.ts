import { addDays, isSameDay, startOfDay } from './date';

const LOCALE = 'pt-BR';

const timeFormatter = new Intl.DateTimeFormat(LOCALE, { hour: '2-digit', minute: '2-digit' });
const dateFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});
const shortDayFormatter = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'short',
  day: '2-digit',
  month: '2-digit',
});
const longDayFormatter = new Intl.DateTimeFormat(LOCALE, {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const monthDayFormatter = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short' });
const yearFormatter = new Intl.DateTimeFormat(LOCALE, { year: 'numeric' });
const weekdayFormatter = new Intl.DateTimeFormat(LOCALE, { weekday: 'short' });
const decimalFormatter = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 });
const relativeFormatter = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });

const PLACEHOLDER = '—';
const FILE_SIZE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/** `42` → `0:42`; `3903` → `1:05:03`. */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds < 0) return PLACEHOLDER;
  const total = Math.round(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = String(total % 60).padStart(2, '0');
  return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}` : `${minutes}:${secs}`;
}

/** `50_550_000` → `48,2 MB`. */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return PLACEHOLDER;
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < FILE_SIZE_UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const unit = FILE_SIZE_UNITS[unitIndex] ?? 'B';
  return `${unitIndex === 0 ? String(value) : decimalFormatter.format(value)} ${unit}`;
}

export function formatResolution(width: number | null, height: number | null): string {
  return width && height ? `${width}×${height}` : PLACEHOLDER;
}

export function formatTime(date: Date): string {
  return timeFormatter.format(date);
}

export function formatDate(date: Date): string {
  return dateFormatter.format(date);
}

export function formatDateTime(date: Date): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

/** `quarta-feira, 7 de outubro` */
export function formatLongDay(date: Date): string {
  return longDayFormatter.format(date);
}

/** `qua.` */
export function formatWeekday(date: Date): string {
  return weekdayFormatter.format(date);
}

/** Rótulo curto para filas e listas: `Hoje 19:30`, `Amanhã 09:00`, `Ontem 14:00`, `sex., 09/10 12:00`. */
export function formatScheduleLabel(date: Date, now: Date): string {
  const time = formatTime(date);
  const today = startOfDay(now);
  if (isSameDay(date, today)) return `Hoje ${time}`;
  if (isSameDay(date, addDays(today, 1))) return `Amanhã ${time}`;
  if (isSameDay(date, addDays(today, -1))) return `Ontem ${time}`;
  return `${shortDayFormatter.format(date)} ${time}`;
}

/** `há 5 minutos`, `em 2 horas`, `ontem`. */
export function formatRelativeTime(date: Date, now: Date): string {
  const diffSeconds = Math.round((date.getTime() - now.getTime()) / 1000);
  const abs = Math.abs(diffSeconds);
  if (abs < 60) return 'agora';
  if (abs < 3600) return relativeFormatter.format(Math.round(diffSeconds / 60), 'minute');
  if (abs < 86_400) return relativeFormatter.format(Math.round(diffSeconds / 3600), 'hour');
  if (abs < 30 * 86_400) return relativeFormatter.format(Math.round(diffSeconds / 86_400), 'day');
  return formatDate(date);
}

/** `5 – 11 de out. de 2026` (semana com início em `start`). */
export function formatWeekRange(start: Date): string {
  const end = addDays(start, 6);
  const year = yearFormatter.format(end);
  return `${monthDayFormatter.format(start)} – ${monthDayFormatter.format(end)} de ${year}`;
}

/** `@yeaxx` */
export function formatHandle(username: string): string {
  return `@${username}`;
}

/** Corta texto longo preservando palavras quando possível. */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const slice = text.slice(0, maxLength - 1);
  const lastSpace = slice.lastIndexOf(' ');
  return `${lastSpace > maxLength * 0.6 ? slice.slice(0, lastSpace) : slice}…`;
}
