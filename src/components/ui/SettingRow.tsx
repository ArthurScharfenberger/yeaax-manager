import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

interface SettingRowProps {
  label: ReactNode;
  description?: ReactNode;
  /** Id do controle, para associar o rótulo. */
  htmlFor?: string;
  className?: string;
  children: ReactNode;
}

/** Linha de configuração: rótulo e descrição à esquerda, controle à direita. */
export function SettingRow({ label, description, htmlFor, className, children }: SettingRowProps) {
  return (
    <div
      className={cn(
        'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-6 border-b border-line py-3.5 last:border-b-0',
        className,
      )}
    >
      <div className="min-w-0">
        {htmlFor ? (
          <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
            {label}
          </label>
        ) : (
          <p className="text-sm font-medium text-ink">{label}</p>
        )}
        {description && <p className="mt-0.5 text-xs text-ink-3">{description}</p>}
      </div>
      <div className="flex items-center justify-end gap-2">{children}</div>
    </div>
  );
}
