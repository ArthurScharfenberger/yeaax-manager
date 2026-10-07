import { AlertTriangle, CircleAlert, Info, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

export type NoticeTone = 'info' | 'warning' | 'danger';

const TONES: Record<NoticeTone, { icon: LucideIcon; classes: string; iconClass: string }> = {
  info: { icon: Info, classes: 'border-line bg-sunken text-ink-2', iconClass: 'text-accent' },
  warning: {
    icon: AlertTriangle,
    classes: 'border-warning-line bg-warning-subtle text-ink-2',
    iconClass: 'text-warning',
  },
  danger: {
    icon: CircleAlert,
    classes: 'border-danger-line bg-danger-subtle text-danger',
    iconClass: 'text-danger',
  },
};

interface NoticeProps {
  tone?: NoticeTone;
  title?: string;
  children: ReactNode;
  className?: string;
}

/** Aviso inline (não flutuante). Use para contexto persistente: modo simulado, erros de formulário. */
export function Notice({ tone = 'info', title, children, className }: NoticeProps) {
  const { icon: Icon, classes, iconClass } = TONES[tone];
  return (
    <div
      role={tone === 'danger' ? 'alert' : 'note'}
      className={cn('flex gap-2.5 rounded-md border px-3 py-2.5 text-xs', classes, className)}
    >
      <Icon size={15} className={cn('mt-px shrink-0', iconClass)} aria-hidden />
      <div className="flex flex-col gap-0.5">
        {title && <p className="font-semibold text-ink">{title}</p>}
        <div>{children}</div>
      </div>
    </div>
  );
}
