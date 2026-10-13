import { type DbClient, withErrorMapping } from '@/db/client';
import { createTauriDbClient } from '@/db/tauriClient';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { APP_VERSION, detectRuntimeMode, type RuntimeMode } from '@/lib/runtime';
import { createPreviewDesktopBridge } from '@/services/desktop/previewDesktopBridge';
import { createTauriDesktopBridge } from '@/services/desktop/tauriDesktopBridge';

import { type AppServices, createAppServices } from './services';

async function createDbClient(mode: RuntimeMode): Promise<DbClient> {
  if (mode === 'desktop') return createTauriDbClient();

  // O modo preview (SQLite WASM) existe só em desenvolvimento e fica fora do build final.
  if (import.meta.env.DEV) {
    const { createPreviewDbClient } = await import('@/db/previewClient');
    return createPreviewDbClient();
  }

  throw new AppError(
    'NOT_AVAILABLE',
    'Esta interface precisa ser aberta pelo aplicativo desktop do Yeaax Manager.',
  );
}

async function bootstrap(): Promise<AppServices> {
  const mode = detectRuntimeMode();
  if (mode === 'desktop') {
    const { createFileLogSink } = await import('@/services/desktop/fileLogSink');
    logger.addSink(createFileLogSink());
  }
  const db = withErrorMapping(await createDbClient(mode));
  const desktop = mode === 'desktop' ? createTauriDesktopBridge() : createPreviewDesktopBridge();
  const services = createAppServices({ db, desktop, mode });

  await services.demo.seedIfNeeded();
  logger.info('Yeaax Manager iniciado', { version: APP_VERSION, mode });
  return services;
}

let bootPromise: Promise<AppServices> | null = null;

/** Inicializa uma única vez (o StrictMode do React monta os efeitos duas vezes em dev). */
export function bootstrapOnce(): Promise<AppServices> {
  bootPromise ??= bootstrap();
  return bootPromise;
}

/** Permite tentar novamente após uma falha de inicialização. */
export function resetBootstrap(): void {
  bootPromise = null;
}
