import { useEffect } from 'react';
import { useNavigate, useRouteError } from 'react-router';

import { logger } from '@/lib/logger';

import { ErrorScreen } from './ErrorScreen';
import { ROUTES } from './routes';

/** Erros de renderização dentro de uma página. Mantém o app utilizável. */
export function RouteError() {
  const error = useRouteError();
  const navigate = useNavigate();

  useEffect(() => {
    logger.error('Erro ao renderizar página', { error });
  }, [error]);

  return (
    <ErrorScreen
      title="Esta página encontrou um erro"
      error={error}
      onRetry={() => void navigate(ROUTES.dashboard)}
    />
  );
}
