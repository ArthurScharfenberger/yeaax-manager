import { type AutoScheduleConfig, planDailySlots } from '@/features/automation/autoSchedule';
import { normalizeHashtag, type PostPlanDraft } from '@/services/ai';
import {
  addDays,
  addMinutes,
  ceilToMinutes,
  parseLocalDateTime,
  startOfDay,
  timeToMinutes,
} from '@/utils/date';

/** Antecedência mínima ao agendar "agora" (o agendador publica no minuto seguinte). */
const NOW_LEAD_MINUTES = 2;
/** Horários sugeridos muito próximos de agora não são oferecidos. */
const SLOT_MIN_LEAD_MINUTES = 5;

/** Junta legenda e hashtags, normalizando e removendo hashtags que já estão no texto. */
export function composeCaption(caption: string, hashtags: readonly string[]): string {
  const text = caption.trim();
  const present = new Set(
    (text.match(/#[\p{L}\p{N}_]+/gu) ?? []).map((tag) => normalizeHashtag(tag.slice(1))),
  );
  const extra = [
    ...new Set(hashtags.map((tag) => normalizeHashtag(tag.replace(/^#+/, '')))),
  ].filter((tag) => tag.length > 0 && !present.has(tag));

  return extra.length > 0 ? `${text}\n\n${extra.map((tag) => `#${tag}`).join(' ')}` : text;
}

/** Próximos horários do Auto Schedule nos próximos `days` dias, já no futuro. */
export function upcomingSlots(
  config: Pick<
    AutoScheduleConfig,
    'postsPerDay' | 'minIntervalMinutes' | 'windowStart' | 'windowEnd'
  >,
  now: Date,
  days = 3,
): Date[] {
  const minimum = addMinutes(now, SLOT_MIN_LEAD_MINUTES);
  const { slots } = planDailySlots(config);
  const result: Date[] = [];
  for (let offset = 0; offset < days; offset += 1) {
    const day = addDays(startOfDay(now), offset);
    for (const slot of slots) {
      const minutes = timeToMinutes(slot);
      if (minutes === null) continue;
      const date = addMinutes(day, minutes);
      if (date > minimum) result.push(date);
    }
  }
  return result.sort((a, b) => a.getTime() - b.getTime());
}

export interface ResolvedSchedule {
  /** `null` = salvar como rascunho, sem data. */
  scheduledAt: Date | null;
  /** Observação para o usuário quando o pedido não pôde ser seguido à risca. */
  note: string | null;
}

/** Converte o horário pedido pela IA em uma data concreta e válida (sempre no futuro). */
export function resolveSchedule(
  schedule: PostPlanDraft['schedule'],
  slots: readonly Date[],
  now: Date,
): ResolvedSchedule {
  const nextSlot = slots[0] ?? null;
  const fallback = (note: string): ResolvedSchedule => ({
    scheduledAt: nextSlot,
    note: nextSlot ? note : `${note} Não há horário sugerido disponível; ficará como rascunho.`,
  });

  switch (schedule.mode) {
    case 'now':
      return { scheduledAt: ceilToMinutes(addMinutes(now, NOW_LEAD_MINUTES), 1), note: null };
    case 'none':
      return { scheduledAt: null, note: null };
    case 'auto':
      return nextSlot
        ? { scheduledAt: nextSlot, note: null }
        : { scheduledAt: null, note: 'Sem horário sugerido disponível; ficará como rascunho.' };
    case 'datetime': {
      const date = schedule.datetime ? parseLocalDateTime(schedule.datetime) : null;
      if (!date) return fallback('Não entendi o horário pedido; usei o próximo horário sugerido.');
      if (date <= now)
        return fallback('O horário pedido já passou; usei o próximo horário sugerido.');
      return { scheduledAt: date, note: null };
    }
  }
}
