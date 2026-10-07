import { createContext, useContext } from 'react';

export type ToastTone = 'success' | 'info' | 'error';

export interface ToastApi {
  success: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
  /** Mostra a mensagem amigável de qualquer erro (via `getErrorMessage`). */
  error: (error: unknown, title?: string) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast precisa estar dentro de <ToastProvider>.');
  return api;
}
