import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { useServices } from '@/app/ServicesContext';
import { useInvalidate } from '@/hooks/useInvalidate';
import type { PublishProgress } from '@/services/social';
import type { Id, Platform } from '@/types';

const AFFECTED = ['posts', 'dashboard', 'search'] as const;
/** Intervalo do agendador local (o TikTok limita o `status/fetch` a 30 req/min por token). */
export const SCHEDULER_INTERVAL_MS = 30_000;

/** A plataforma publica de verdade pelo app (providers simulados não)? */
export function useCanPublish(platform: Platform | undefined): boolean {
  const { social } = useServices();
  return platform ? social[platform].capabilities.publishVideo : false;
}

/** "Publicar agora" com o andamento do envio (preparando → enviando % → processando). */
export function usePublishNow() {
  const { publishing } = useServices();
  const invalidate = useInvalidate();
  const [progress, setProgress] = useState<PublishProgress | null>(null);
  const mutation = useMutation({
    mutationFn: (postId: Id) => {
      setProgress({ stage: 'preparing' });
      return publishing.publishNow(postId, { consent: 'now', onProgress: setProgress });
    },
    onSettled: () => {
      setProgress(null);
      void invalidate(...AFFECTED);
    },
  });
  return { ...mutation, progress };
}

/** Consulta de novo o resultado de um post em processamento. */
export function useRefreshPublication() {
  const { publishing } = useServices();
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (postId: Id) => publishing.refreshStatus(postId),
    onSettled: () => invalidate(...AFFECTED),
  });
}

/** Um único agendador por sessão (o StrictMode monta os efeitos duas vezes em dev). */
let schedulerStarted = false;

/**
 * Agendador local (DEC-019/030): enquanto o app está aberto, publica os posts agendados que venceram e acompanha
 * os que estão em processamento. Só no app desktop.
 */
export function usePublishingScheduler(): void {
  const { publishing, mode } = useServices();
  const invalidate = useInvalidate();

  useEffect(() => {
    if (mode !== 'desktop' || schedulerStarted) return;
    schedulerStarted = true;
    let running = false;
    const tick = () => {
      if (running) return;
      running = true;
      void publishing
        .runScheduler()
        .then((result) => {
          if (result.started + result.failed + result.completed > 0) void invalidate(...AFFECTED);
        })
        .finally(() => {
          running = false;
        });
    };
    tick();
    window.setInterval(tick, SCHEDULER_INTERVAL_MS);
  }, [publishing, mode, invalidate]);
}
