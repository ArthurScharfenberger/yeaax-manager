/** Fonte de tempo injetável — permite testar regras dependentes de "agora". */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

/** Relógio fixo para testes. */
export function createFixedClock(date: Date): Clock {
  return { now: () => new Date(date) };
}
