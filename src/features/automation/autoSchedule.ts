import { z } from 'zod';

import { defineSetting } from '@/lib/settings';
import { platformSchema } from '@/types';
import { minutesToTime, timeToMinutes } from '@/utils/date';

/**
 * Auto Schedule — configuração e prévia de horários.
 * A execução automática ainda NÃO existe (docs/ROADMAP.md, Fase 2); aqui ficam apenas
 * as regras puras que o motor de automação vai reutilizar.
 */

const SLOT_STEP_MINUTES = 15;
const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário inválido.');

export const autoScheduleConfigSchema = z
  .object({
    postsPerDay: z.number().int().min(1, 'Mínimo de 1 post.').max(12, 'Máximo de 12 posts.'),
    platforms: z.array(platformSchema).min(1, 'Selecione ao menos uma plataforma.'),
    minIntervalMinutes: z.number().int().min(30).max(720),
    windowStart: timeSchema,
    windowEnd: timeSchema,
    preferBestTimes: z.boolean(),
    avoidSimilarSameDay: z.boolean(),
  })
  .refine(
    (config) => (timeToMinutes(config.windowEnd) ?? 0) > (timeToMinutes(config.windowStart) ?? 0),
    { error: 'O fim do período precisa ser depois do início.', path: ['windowEnd'] },
  );

export type AutoScheduleConfig = z.infer<typeof autoScheduleConfigSchema>;

export const DEFAULT_AUTO_SCHEDULE_CONFIG: AutoScheduleConfig = {
  postsPerDay: 2,
  platforms: ['tiktok', 'instagram'],
  minIntervalMinutes: 180,
  windowStart: '09:00',
  windowEnd: '22:00',
  preferBestTimes: false,
  avoidSimilarSameDay: false,
};

export const AUTO_SCHEDULE_SETTING = defineSetting(
  'automation.autoSchedule',
  autoScheduleConfigSchema,
  DEFAULT_AUTO_SCHEDULE_CONFIG,
);

export interface DailySlotPlan {
  /** Horários `HH:mm` sugeridos para um dia. */
  slots: string[];
  /** `false` quando `postsPerDay` não cabe no período com o intervalo mínimo. */
  feasible: boolean;
  /** Quantidade máxima de posts que cabe no período. */
  maxPostsInWindow: number;
}

/** Espaçamento em múltiplos de 15 min para `count` posts com margens iguais nas pontas. */
function stepFor(windowMinutes: number, count: number): number {
  return Math.floor(windowMinutes / count / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES;
}

/**
 * Distribui os posts do dia de forma uniforme dentro do período, respeitando o
 * intervalo mínimo. Horários sempre alinhados a 15 minutos a partir do início do período.
 */
export function planDailySlots(
  config: Pick<
    AutoScheduleConfig,
    'postsPerDay' | 'minIntervalMinutes' | 'windowStart' | 'windowEnd'
  >,
): DailySlotPlan {
  const start = timeToMinutes(config.windowStart);
  const end = timeToMinutes(config.windowEnd);
  if (start === null || end === null || end <= start || config.postsPerDay < 1) {
    return { slots: [], feasible: false, maxPostsInWindow: 0 };
  }

  const window = end - start;
  // Limite físico: no máximo um post a cada 15 minutos (evita laço infinito com intervalo 0).
  const upperBound = Math.floor(window / SLOT_STEP_MINUTES);
  let maxPostsInWindow = 1;
  while (
    maxPostsInWindow < upperBound &&
    stepFor(window, maxPostsInWindow + 1) >= config.minIntervalMinutes
  ) {
    maxPostsInWindow += 1;
  }

  const count = Math.min(config.postsPerDay, maxPostsInWindow);
  const step = stepFor(window, count);
  const span = step * (count - 1);
  const offset = start + Math.floor((window - span) / 2 / SLOT_STEP_MINUTES) * SLOT_STEP_MINUTES;

  return {
    slots: Array.from({ length: count }, (_, index) => minutesToTime(offset + index * step)),
    feasible: config.postsPerDay <= maxPostsInWindow,
    maxPostsInWindow,
  };
}
