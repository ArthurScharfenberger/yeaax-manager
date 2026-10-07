import type { ReactNode } from 'react';

import { cn } from '@/utils/cn';

export type BadgeTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'border-line bg-sunken text-ink-2',
  info: 'border-accent-line bg-accent-subtle text-accent-ink',
  success: 'border-success-line bg-success-subtle text-success',
  warning: 'border-warning-line bg-warning-subtle text-warning',
  danger: 'border-danger-line bg-danger-subtle text-danger',
};

interface BadgeProps {
  tone?: BadgeTone;
  /** Ponto colorido à esquerda — útil para status. */
  dot?: boolean;
  className?: string;
  children: ReactNode;
}

export function Badge({ tone = 'neutral', dot = false, className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex h-5 shrink-0 items-center gap-1.5 rounded-sm border px-1.5 text-2xs font-medium whitespace-nowrap',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  );
}
