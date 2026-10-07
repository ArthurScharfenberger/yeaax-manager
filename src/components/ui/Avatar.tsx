import { cn } from '@/utils/cn';

interface AvatarProps {
  name: string;
  src?: string | null;
  size?: 'sm' | 'md';
  className?: string;
}

function initials(name: string): string {
  const parts = name
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  const letters =
    parts.length > 1 ? `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}` : name.slice(0, 2);
  return letters.toUpperCase();
}

export function Avatar({ name, src, size = 'md', className }: AvatarProps) {
  const sizeClass = size === 'sm' ? 'size-6 text-2xs' : 'size-8 text-xs';
  if (src) {
    return (
      <img
        src={src}
        alt=""
        className={cn(
          'shrink-0 rounded-full border border-line object-cover',
          sizeClass,
          className,
        )}
      />
    );
  }
  return (
    <span
      aria-hidden
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-line bg-sunken font-semibold text-ink-2',
        sizeClass,
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
