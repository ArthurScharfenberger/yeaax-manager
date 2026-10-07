import { CheckCircle2, CircleAlert, Info, type LucideIcon, X } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { getErrorMessage } from '@/lib/errors';
import { cn } from '@/utils/cn';

import { type ToastApi, ToastContext, type ToastTone } from './toastContext';

interface ToastItem {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string | undefined;
}

const MAX_VISIBLE = 4;
const DURATION_MS: Record<ToastTone, number> = { success: 4000, info: 5000, error: 7000 };

const TONE_STYLE: Record<ToastTone, { icon: LucideIcon; iconClass: string }> = {
  success: { icon: CheckCircle2, iconClass: 'text-success' },
  info: { icon: Info, iconClass: 'text-accent' },
  error: { icon: CircleAlert, iconClass: 'text-danger' },
};

/**
 * Notificações efêmeras (canto inferior direito). A região é um popover "manual" para
 * aparecer acima de modais abertos. Erros de formulário devem ficar inline no próprio
 * formulário; toasts servem para confirmar ações e para falhas fora de formulários.
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const regionRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const push = useCallback(
    (tone: ToastTone, title: string, description?: string) => {
      const id = nextId.current++;
      setToasts((current) => [
        ...current.slice(-(MAX_VISIBLE - 1)),
        { id, tone, title, description },
      ]);
      window.setTimeout(() => dismiss(id), DURATION_MS[tone]);
    },
    [dismiss],
  );

  // Reabrir o popover o coloca no topo da pilha da camada superior (acima de modais).
  useEffect(() => {
    const region = regionRef.current;
    if (!region || toasts.length === 0) return;
    if (region.matches(':popover-open')) region.hidePopover();
    region.showPopover();
  }, [toasts.length]);

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, description) => push('success', title, description),
      info: (title, description) => push('info', title, description),
      error: (error, title = 'Não foi possível concluir a ação') =>
        push('error', title, getErrorMessage(error)),
    }),
    [push],
  );

  return (
    <ToastContext value={api}>
      {children}
      <div
        ref={regionRef}
        popover="manual"
        role="region"
        aria-label="Notificações"
        className="pointer-events-none fixed right-4 bottom-4 flex w-80 flex-col gap-2"
      >
        {toasts.map((toast) => {
          const { icon: Icon, iconClass } = TONE_STYLE[toast.tone];
          return (
            <div
              key={toast.id}
              role={toast.tone === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto flex animate-fade-in items-start gap-2.5 rounded-md border border-line bg-canvas px-3 py-2.5 shadow-overlay"
            >
              <Icon size={16} className={cn('mt-px shrink-0', iconClass)} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink">{toast.title}</p>
                {toast.description && (
                  <p className="mt-0.5 text-xs break-words text-ink-3">{toast.description}</p>
                )}
              </div>
              <button
                type="button"
                aria-label="Fechar notificação"
                onClick={() => dismiss(toast.id)}
                className="-mr-1 rounded p-0.5 text-ink-4 hover:bg-hover hover:text-ink"
              >
                <X size={14} aria-hidden />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext>
  );
}
