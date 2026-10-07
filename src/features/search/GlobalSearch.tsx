import { useQuery } from '@tanstack/react-query';
import { Clapperboard, FileText, Search, Users } from 'lucide-react';
import { type KeyboardEvent, useId, useState } from 'react';
import { useNavigate } from 'react-router';

import { ROUTES } from '@/app/routes';
import { useServices } from '@/app/ServicesContext';
import { PlatformMark } from '@/components/PlatformMark';
import { usePostDialogs } from '@/features/posts/postDialogsContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { queryKeys } from '@/lib/queryKeys';
import { cn } from '@/utils/cn';
import { formatHandle, truncate } from '@/utils/format';

import { MIN_SEARCH_LENGTH } from './searchService';

interface ResultOption {
  key: string;
  group: string;
  icon: typeof Search;
  label: string;
  detail: string;
  platform?: 'tiktok' | 'instagram';
  onSelect: () => void;
}

/** Busca global em canais, posts e biblioteca (combobox acessível). */
export function GlobalSearch() {
  const { search } = useServices();
  const navigate = useNavigate();
  const { openDetails } = usePostDialogs();
  const listboxId = useId();
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const debounced = useDebouncedValue(term.trim(), 200);
  const enabled = debounced.length >= MIN_SEARCH_LENGTH;

  const results = useQuery({
    queryKey: queryKeys.search.term(debounced),
    queryFn: () => search.search(debounced),
    enabled,
  });

  const options: ResultOption[] = [
    ...(results.data?.channels ?? []).map((channel) => ({
      key: `channel-${channel.id}`,
      group: 'Canais',
      icon: Users,
      label: channel.displayName,
      detail: formatHandle(channel.username),
      platform: channel.platform,
      onSelect: () => void navigate(ROUTES.channels),
    })),
    ...(results.data?.posts ?? []).map((post) => ({
      key: `post-${post.id}`,
      group: 'Posts',
      icon: FileText,
      label: truncate(post.caption || 'Sem legenda', 60),
      detail: formatHandle(post.channel.username),
      platform: post.channel.platform,
      onSelect: () => openDetails(post.id),
    })),
    ...(results.data?.media ?? []).map((item) => ({
      key: `media-${item.id}`,
      group: 'Biblioteca',
      icon: Clapperboard,
      label: item.filename,
      detail: item.tags.map((tag) => tag.name).join(', '),
      onSelect: () => void navigate(`${ROUTES.library}?media=${item.id}`),
    })),
  ];

  const showResults = open && enabled;
  const active = options[Math.min(activeIndex, options.length - 1)];

  function choose(option: ResultOption) {
    option.onSelect();
    setOpen(false);
    setTerm('');
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (!showResults || options.length === 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((index) => (index + delta + options.length) % options.length);
    } else if (event.key === 'Enter' && active) {
      event.preventDefault();
      choose(active);
    }
  }

  return (
    <div className="relative w-full max-w-md">
      <Search
        size={15}
        className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-4"
        aria-hidden
      />
      <input
        type="search"
        role="combobox"
        aria-label="Buscar posts, canais e legendas"
        aria-expanded={showResults}
        aria-controls={listboxId}
        aria-autocomplete="list"
        aria-activedescendant={showResults && active ? `${listboxId}-${active.key}` : undefined}
        placeholder="Buscar posts, canais, legendas..."
        value={term}
        onChange={(event) => {
          setTerm(event.target.value);
          setActiveIndex(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={handleKeyDown}
        className="h-8 w-full rounded border border-line-strong bg-canvas pr-2.5 pl-8 text-sm placeholder:text-ink-4 hover:border-ink-4 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
      />

      {showResults && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Resultados da busca"
          // Mantém o foco no campo ao clicar em um resultado.
          onMouseDown={(event) => event.preventDefault()}
          className="absolute top-full right-0 left-0 z-20 mt-1 max-h-96 animate-fade-in overflow-y-auto rounded-md border border-line bg-canvas p-1 shadow-overlay"
        >
          {results.isPending && <p className="px-2 py-2 text-xs text-ink-3">Buscando…</p>}
          {results.isSuccess && options.length === 0 && (
            <p className="px-2 py-2 text-xs text-ink-3">Nada encontrado para “{debounced}”.</p>
          )}
          {options.map((option, index) => {
            const Icon = option.icon;
            const showGroup = index === 0 || options[index - 1]?.group !== option.group;
            return (
              <div key={option.key}>
                {showGroup && (
                  <p className="px-2 pt-2 pb-1 text-2xs font-medium tracking-wide text-ink-3 uppercase">
                    {option.group}
                  </p>
                )}
                <div
                  id={`${listboxId}-${option.key}`}
                  role="option"
                  aria-selected={option === active}
                  onClick={() => choose(option)}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={cn(
                    'flex h-9 items-center gap-2.5 rounded-sm px-2 text-sm',
                    option === active ? 'bg-hover' : '',
                  )}
                >
                  <Icon size={14} className="shrink-0 text-ink-3" aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-ink">{option.label}</span>
                  {option.platform && <PlatformMark platform={option.platform} />}
                  <span className="max-w-40 shrink-0 truncate text-xs text-ink-3">
                    {option.detail}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
