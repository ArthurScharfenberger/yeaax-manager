import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex min-h-14 shrink-0 items-center justify-between gap-4 border-b border-line px-6 py-2.5">
      <div className="min-w-0">
        <h1 className="truncate text-lg font-semibold text-ink">{title}</h1>
        {description && <p className="truncate text-xs text-ink-3">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}
