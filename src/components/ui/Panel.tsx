import { type ReactNode, useId } from 'react';

import { cn } from '@/utils/cn';

interface PanelProps {
  title: string;
  /** Texto curto ao lado do título (ex.: contagem). */
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
}

/** Seção delimitada por borda, sem sombra. Bloco básico do dashboard e das páginas. */
export function Panel({ title, meta, actions, className, bodyClassName, children }: PanelProps) {
  const headingId = useId();
  return (
    <section
      aria-labelledby={headingId}
      className={cn('flex min-w-0 flex-col rounded-md border border-line bg-canvas', className)}
    >
      <header className="flex h-11 shrink-0 items-center justify-between gap-3 border-b border-line px-4">
        <div className="flex min-w-0 items-baseline gap-2">
          <h2 id={headingId} className="truncate text-sm font-semibold text-ink">
            {title}
          </h2>
          {meta && <span className="text-xs text-ink-3 tabular">{meta}</span>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
      </header>
      <div className={cn('min-h-0 flex-1', bodyClassName)}>{children}</div>
    </section>
  );
}
