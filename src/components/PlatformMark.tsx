import { PLATFORM_INFO } from '@/lib/platforms';
import type { Platform } from '@/types';
import { cn } from '@/utils/cn';

interface PlatformMarkProps {
  platform: Platform;
  /** Mostra o nome da plataforma ao lado do monograma. */
  withLabel?: boolean;
  className?: string;
}

/**
 * Identificação neutra da plataforma (monograma), sem logotipos de marca e sem cores
 * extras: TikTok em bloco escuro, Instagram em contorno.
 */
export function PlatformMark({ platform, withLabel = false, className }: PlatformMarkProps) {
  const info = PLATFORM_INFO[platform];
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      <span
        aria-hidden={withLabel}
        aria-label={withLabel ? undefined : info.label}
        title={withLabel ? undefined : info.label}
        className={cn(
          'inline-flex h-4 min-w-5 shrink-0 items-center justify-center rounded-sm px-0.5 text-[9px] leading-none font-bold tracking-tight',
          platform === 'tiktok' ? 'bg-ink text-white' : 'border border-ink-2 text-ink-2',
        )}
      >
        {info.monogram}
      </span>
      {withLabel && <span className="text-sm text-ink-2">{info.label}</span>}
    </span>
  );
}
