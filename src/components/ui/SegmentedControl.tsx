import type { LucideIcon } from 'lucide-react';
import type { KeyboardEvent } from 'react';

import { cn } from '@/utils/cn';

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
  /** Esconde o texto e usa o rótulo apenas como `aria-label`. */
  iconOnly?: boolean;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  value: T;
  options: readonly SegmentOption<T>[];
  onChange: (value: T) => void;
  className?: string;
}

/** Grupo de opções exclusivas (radiogroup) navegável por setas. */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (delta === 0) return;
    event.preventDefault();
    const index = options.findIndex((option) => option.value === value);
    const next = options[(index + delta + options.length) % options.length];
    if (next) {
      onChange(next.value);
      const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]');
      buttons[options.indexOf(next)]?.focus();
    }
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={handleKeyDown}
      className={cn(
        'inline-flex h-8 items-center rounded border border-line-strong p-0.5',
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        const Icon = option.icon;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={option.iconOnly ? option.label : undefined}
            title={option.iconOnly ? option.label : undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex h-full items-center gap-1.5 rounded-sm px-2.5 text-xs font-medium transition-colors select-none',
              selected ? 'bg-pressed text-ink' : 'text-ink-3 hover:text-ink',
            )}
          >
            {Icon && <Icon size={14} aria-hidden />}
            {!option.iconOnly && option.label}
          </button>
        );
      })}
    </div>
  );
}
