import { describe, expect, it } from 'vitest';

import { DEFAULT_AUTO_SCHEDULE_CONFIG } from '@/features/automation/autoSchedule';

import { composeCaption, resolveSchedule, upcomingSlots } from './postPlanRules';

const NOW = new Date(2026, 9, 7, 14, 0); // quarta, 14:00 local

describe('composeCaption', () => {
  it('normaliza hashtags e não repete as que já estão no texto', () => {
    expect(
      composeCaption('  Civic Si no pôr do sol #civic ', ['civic', '#Carros', 'Mecânica Rápida']),
    ).toBe('Civic Si no pôr do sol #civic\n\n#carros #mecanicarapida');
  });

  it('devolve só o texto quando não há hashtags extras', () => {
    expect(composeCaption('Olá', [])).toBe('Olá');
  });
});

describe('upcomingSlots', () => {
  it('lista os próximos horários do Auto Schedule a partir de agora', () => {
    // Padrão: 2 posts/dia → 12:15 e 18:45.
    const slots = upcomingSlots(DEFAULT_AUTO_SCHEDULE_CONFIG, NOW, 2);
    expect(slots).toEqual([
      new Date(2026, 9, 7, 18, 45),
      new Date(2026, 9, 8, 12, 15),
      new Date(2026, 9, 8, 18, 45),
    ]);
  });
});

describe('resolveSchedule', () => {
  const slots = [new Date(2026, 9, 7, 18, 45)];

  it('"agora" vira o minuto seguinte com folga', () => {
    expect(resolveSchedule({ mode: 'now', datetime: null }, slots, NOW).scheduledAt).toEqual(
      new Date(2026, 9, 7, 14, 2),
    );
  });

  it('usa o horário pedido quando é futuro', () => {
    expect(resolveSchedule({ mode: 'datetime', datetime: '2026-10-08T19:00' }, slots, NOW)).toEqual(
      { scheduledAt: new Date(2026, 9, 8, 19, 0), note: null },
    );
  });

  it('cai no próximo horário sugerido quando o pedido já passou ou é inválido', () => {
    const past = resolveSchedule({ mode: 'datetime', datetime: '2026-10-07T09:00' }, slots, NOW);
    expect(past.scheduledAt).toEqual(slots[0]);
    expect(past.note).toContain('já passou');
    expect(resolveSchedule({ mode: 'datetime', datetime: 'amanhã' }, slots, NOW).note).toContain(
      'Não entendi',
    );
  });

  it('"auto" usa o próximo horário e "none" gera rascunho', () => {
    expect(resolveSchedule({ mode: 'auto', datetime: null }, slots, NOW).scheduledAt).toEqual(
      slots[0],
    );
    expect(resolveSchedule({ mode: 'auto', datetime: null }, [], NOW).scheduledAt).toBeNull();
    expect(resolveSchedule({ mode: 'none', datetime: null }, slots, NOW).scheduledAt).toBeNull();
  });
});
