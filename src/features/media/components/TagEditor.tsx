import { Plus, X } from 'lucide-react';
import { type SubmitEvent, useId, useState } from 'react';

import { useToast } from '@/components/ui/toastContext';
import type { Media } from '@/types';

import { useMediaMutations, useTags } from '../hooks';
import { MAX_TAG_LENGTH } from '../mediaRules';

/** Adiciona/remove tags de uma mídia, com sugestões das tags existentes. */
export function TagEditor({ media }: { media: Media }) {
  const inputId = useId();
  const listId = useId();
  const [name, setName] = useState('');
  const tags = useTags();
  const { addTag, removeTag } = useMediaMutations();
  const toast = useToast();

  const suggestions = (tags.data ?? []).filter(
    (tag) => !media.tags.some((current) => current.id === tag.id),
  );

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!name.trim()) return;
    addTag.mutate(
      { id: media.id, name },
      { onSuccess: () => setName(''), onError: (error) => toast.error(error) },
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap gap-1.5" aria-label="Tags do vídeo">
        {media.tags.length === 0 && <li className="text-xs text-ink-3">Nenhuma tag.</li>}
        {media.tags.map((tag) => (
          <li
            key={tag.id}
            className="inline-flex h-6 items-center gap-1 rounded-sm border border-line bg-sunken pr-0.5 pl-2 text-xs text-ink-2"
          >
            #{tag.name}
            <button
              type="button"
              aria-label={`Remover tag ${tag.name}`}
              onClick={() =>
                removeTag.mutate(
                  { id: media.id, tagId: tag.id },
                  { onError: (error) => toast.error(error) },
                )
              }
              className="rounded-sm p-0.5 text-ink-4 hover:bg-hover hover:text-ink"
            >
              <X size={12} aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={handleSubmit} className="flex gap-1.5">
        <label htmlFor={inputId} className="sr-only">
          Nova tag
        </label>
        <input
          id={inputId}
          list={listId}
          value={name}
          maxLength={MAX_TAG_LENGTH}
          onChange={(event) => setName(event.target.value)}
          placeholder="Adicionar tag…"
          className="h-7 min-w-0 flex-1 rounded border border-line-strong bg-canvas px-2 text-xs placeholder:text-ink-4 focus:border-accent focus:ring-2 focus:ring-accent/20 focus:outline-none"
        />
        <datalist id={listId}>
          {suggestions.map((tag) => (
            <option key={tag.id} value={tag.name} />
          ))}
        </datalist>
        <button
          type="submit"
          aria-label="Adicionar tag"
          disabled={!name.trim() || addTag.isPending}
          className="inline-flex size-7 items-center justify-center rounded border border-line-strong text-ink-2 hover:bg-hover disabled:opacity-40"
        >
          <Plus size={14} aria-hidden />
        </button>
      </form>
    </div>
  );
}
