import type { LucideIcon } from 'lucide-react';
import type { ComponentProps } from 'react';

import { cn } from '@/utils/cn';

export interface IconButtonProps extends Omit<ComponentProps<'button'>, 'children'> {
  icon: LucideIcon;
  /** Obrigatório: vira `aria-label` e tooltip nativo. */
  label: string;
  size?: 'sm' | 'md';
}

export function IconButton({
  icon: Icon,
  label,
  size = 'md',
  className,
  type = 'button',
  ...props
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded text-ink-3 transition-colors select-none hover:bg-hover hover:text-ink active:bg-pressed',
        'disabled:pointer-events-none disabled:opacity-40',
        size === 'sm' ? 'size-6' : 'size-8',
        className,
      )}
      {...props}
    >
      <Icon size={size === 'sm' ? 14 : 16} aria-hidden />
    </button>
  );
}
