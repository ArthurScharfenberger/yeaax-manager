import type { ComponentProps } from 'react';

import { cn } from '@/utils/cn';

/** Primitivas de tabela com o estilo padrão do app (densa, linhas finas, sem zebra). */

export function Table({ className, ...props }: ComponentProps<'table'>) {
  return <table className={cn('w-full border-collapse text-sm', className)} {...props} />;
}

export function THead({ className, ...props }: ComponentProps<'thead'>) {
  return <thead className={cn('bg-sunken', className)} {...props} />;
}

export function Th({ className, ...props }: ComponentProps<'th'>) {
  return (
    <th
      scope="col"
      className={cn(
        'h-8 border-b border-line px-3 text-left text-2xs font-medium tracking-wide whitespace-nowrap text-ink-3 uppercase',
        className,
      )}
      {...props}
    />
  );
}

export function Tr({ className, ...props }: ComponentProps<'tr'>) {
  return (
    <tr
      className={cn(
        'border-b border-line transition-colors last:border-b-0 hover:bg-sunken',
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: ComponentProps<'td'>) {
  return <td className={cn('h-12 px-3 align-middle', className)} {...props} />;
}
