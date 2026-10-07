import { useEffect } from 'react';

import { useServices } from '@/app/ServicesContext';
import { useInvalidate } from '@/hooks/useInvalidate';

/** Garante uma única execução por sessão (o StrictMode monta os efeitos duas vezes em dev). */
let started = false;

/**
 * Ao abrir o app, gera em segundo plano as miniaturas que faltam — sem ação do usuário.
 * Vídeos novos já recebem a miniatura na importação; isto cobre os antigos e as falhas.
 */
export function useThumbnailBackfill(): void {
  const { media, mode } = useServices();
  const invalidate = useInvalidate();

  useEffect(() => {
    if (mode !== 'desktop' || started) return;
    started = true;
    void media.generateMissingThumbnails().then(({ generated }) => {
      if (generated > 0) void invalidate('media', 'posts');
    });
  }, [media, mode, invalidate]);
}
