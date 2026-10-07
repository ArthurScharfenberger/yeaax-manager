import type { ComponentProps } from 'react';

import { cn } from '@/utils/cn';

// Sem largura padrão: dentro de <Field> o flex estica o controle; fora dele, passe a
// largura via className (classes conflitantes do Tailwind não se sobrescrevem pela ordem).
const CONTROL_CLASSES = cn(
  'rounded border border-line-strong bg-canvas text-sm text-ink placeholder:text-ink-4',
  'transition-colors hover:border-ink-4 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none',
  'disabled:cursor-not-allowed disabled:bg-sunken disabled:text-ink-3',
  'aria-invalid:border-danger aria-invalid:focus:ring-danger/20',
);

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn(CONTROL_CLASSES, 'h-8 px-2.5', className)} {...props} />;
}

export function Textarea({ className, rows = 4, ...props }: ComponentProps<'textarea'>) {
  return (
    <textarea
      rows={rows}
      className={cn(CONTROL_CLASSES, 'resize-y px-2.5 py-2 leading-relaxed', className)}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: ComponentProps<'select'>) {
  return (
    <select className={cn(CONTROL_CLASSES, 'h-8 pr-7 pl-2', className)} {...props}>
      {children}
    </select>
  );
}
