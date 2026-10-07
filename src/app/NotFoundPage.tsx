import { Compass } from 'lucide-react';
import { Link } from 'react-router';

import { EmptyState } from '@/components/ui/EmptyState';

import { ROUTES } from './routes';

export function NotFoundPage() {
  return (
    <EmptyState
      icon={Compass}
      title="Página não encontrada"
      description="O endereço solicitado não existe nesta versão do app."
      action={
        <Link to={ROUTES.dashboard} className="text-sm font-medium text-accent hover:underline">
          Voltar ao Dashboard
        </Link>
      }
      className="h-full"
    />
  );
}
