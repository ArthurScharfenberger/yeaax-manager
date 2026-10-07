import { CircleAlert, RotateCw } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { getErrorMessage } from '@/lib/errors';

interface ErrorScreenProps {
  title?: string;
  error: unknown;
  onRetry?: () => void;
}

/** Tela de erro usada na inicialização, no ErrorBoundary e nas rotas. */
export function ErrorScreen({ title = 'Algo deu errado', error, onRetry }: ErrorScreenProps) {
  return (
    <div
      role="alert"
      className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center"
    >
      <span className="flex size-11 items-center justify-center rounded-md border border-danger-line bg-danger-subtle text-danger">
        <CircleAlert size={20} aria-hidden />
      </span>
      <div className="max-w-md">
        <h1 className="text-base font-semibold text-ink">{title}</h1>
        <p className="mt-1 text-sm text-ink-3">{getErrorMessage(error)}</p>
        <p className="mt-2 text-xs text-ink-3">
          Detalhes técnicos ficam em Configurações → Sobre → Logs.
        </p>
      </div>
      {onRetry && (
        <Button icon={RotateCw} onClick={onRetry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
