import { createContext, useContext } from 'react';

import type { Id } from '@/types';

export interface ComposerOptions {
  /** Edita um post existente. */
  postId?: Id;
  mediaId?: Id;
  channelId?: Id;
  /** Data/hora sugerida (ex.: célula do calendário). */
  scheduledAt?: Date;
  caption?: string;
}

export interface PostDialogsApi {
  openComposer: (options?: ComposerOptions) => void;
  openDetails: (postId: Id) => void;
  /** Copia o post para outros canais como rascunho. */
  openDuplicate: (postId: Id) => void;
  /** "Postar com IA": pedido em linguagem natural → plano → confirmação. */
  openAiPost: (mediaId: Id) => void;
}

export const PostDialogsContext = createContext<PostDialogsApi | null>(null);

/** Abre o compositor ou os detalhes de um post a partir de qualquer tela. */
export function usePostDialogs(): PostDialogsApi {
  const api = useContext(PostDialogsContext);
  if (!api) throw new Error('usePostDialogs precisa estar dentro de <PostDialogsProvider>.');
  return api;
}
