import { QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { RouterProvider } from 'react-router';

import { LoadingBlock } from '@/components/ui/Spinner';
import { ToastProvider } from '@/components/ui/Toast';
import { createQueryClient } from '@/lib/queryClient';
import { logger } from '@/lib/logger';

import { bootstrapOnce, resetBootstrap } from './bootstrap';
import { ErrorScreen } from './ErrorScreen';
import { createAppRouter } from './router';
import type { AppServices } from './services';
import { ServicesContext } from './ServicesContext';

type BootState =
  | { status: 'loading' }
  | { status: 'ready'; services: AppServices }
  | { status: 'error'; error: unknown };

const queryClient = createQueryClient();
const router = createAppRouter();

export function App() {
  const [boot, setBoot] = useState<BootState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    bootstrapOnce().then(
      (services) => {
        if (active) setBoot({ status: 'ready', services });
      },
      (error: unknown) => {
        logger.error('Falha ao iniciar o app', { error });
        if (active) setBoot({ status: 'error', error });
      },
    );
    return () => {
      active = false;
    };
  }, [attempt]);

  if (boot.status === 'loading') {
    return <LoadingBlock label="Abrindo banco de dados local…" className="h-full" />;
  }

  if (boot.status === 'error') {
    return (
      <ErrorScreen
        title="Não foi possível iniciar o Social Manager"
        error={boot.error}
        onRetry={() => {
          resetBootstrap();
          setBoot({ status: 'loading' });
          setAttempt((value) => value + 1);
        }}
      />
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <ServicesContext value={boot.services}>
        <ToastProvider>
          <RouterProvider router={router} />
        </ToastProvider>
      </ServicesContext>
    </QueryClientProvider>
  );
}
