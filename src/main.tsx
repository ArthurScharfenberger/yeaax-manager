import './styles/index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { App } from './app/App';
import { AppErrorBoundary } from './app/ErrorBoundary';
import { logger } from './lib/logger';

window.addEventListener('error', (event) => {
  logger.error('Erro não tratado', { error: event.error ?? event.message });
});
window.addEventListener('unhandledrejection', (event) => {
  logger.error('Promise rejeitada sem tratamento', { error: event.reason });
});

const container = document.getElementById('root');
if (!container) throw new Error('Elemento #root não encontrado em index.html.');

createRoot(container).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>,
);
