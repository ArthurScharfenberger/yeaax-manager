import { Component, type ErrorInfo, type ReactNode } from 'react';

import { logger } from '@/lib/logger';

import { ErrorScreen } from './ErrorScreen';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: unknown;
}

/** Último recurso para erros de renderização fora do roteador. */
export class AppErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    logger.error('Erro de renderização', { error, componentStack: info.componentStack });
  }

  override render(): ReactNode {
    if (this.state.error !== null) {
      return (
        <ErrorScreen
          error={this.state.error}
          onRetry={() => {
            window.location.reload();
          }}
        />
      );
    }
    return this.props.children;
  }
}
