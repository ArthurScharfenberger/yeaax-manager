import type { MediaFilters, PostFilters } from '@/db/repositories';
import type { Id } from '@/types';

/**
 * Chaves do TanStack Query centralizadas. A primeira posição é o "domínio", usado
 * para invalidar grupos inteiros após mutações (ver `invalidateDomains`).
 */
export const queryKeys = {
  channels: {
    all: ['channels'] as const,
  },
  media: {
    all: ['media'] as const,
    list: (filters: MediaFilters) => ['media', 'list', filters] as const,
    detail: (id: Id) => ['media', 'detail', id] as const,
    tags: ['media', 'tags'] as const,
    file: (path: string) => ['media', 'file', path] as const,
  },
  posts: {
    all: ['posts'] as const,
    list: (filters: PostFilters) => ['posts', 'list', filters] as const,
    detail: (id: Id) => ['posts', 'detail', id] as const,
    history: (id: Id) => ['posts', 'history', id] as const,
  },
  dashboard: {
    all: ['dashboard'] as const,
    metrics: (day: string, weekStartsOn: string) =>
      ['dashboard', 'metrics', day, weekStartsOn] as const,
  },
  settings: {
    all: ['settings'] as const,
    key: (key: string) => ['settings', key] as const,
  },
  search: {
    all: ['search'] as const,
    term: (term: string) => ['search', term] as const,
  },
  system: {
    ffmpeg: ['system', 'ffmpeg'] as const,
    dataDirectory: ['system', 'dataDirectory'] as const,
    demoData: ['system', 'demoData'] as const,
  },
} as const;

export type QueryDomain = keyof typeof queryKeys;
