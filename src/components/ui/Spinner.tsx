import { Loader2 } from 'lucide-react';

import { cn } from '@/utils/cn';

interface SpinnerProps {
  label?: string;
  className?: string;
}

export function Spinner({ label = 'Carregando…', className }: SpinnerProps) {
  return (
    <div role="status" className={cn('flex items-center gap-2 text-xs text-ink-3', className)}>
      <Loader2 size={15} className="animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

/** Bloco de carregamento centralizado para áreas inteiras. */
export function LoadingBlock({ label, className }: SpinnerProps) {
  return (
    <div className={cn('flex items-center justify-center', className ?? 'py-12')}>
      <Spinner {...(label ? { label } : {})} />
    </div>
  );
}
