import { type ReactNode, useMemo, useState } from 'react';

import type { Id } from '@/types';

import { PostComposerDialog } from './components/PostComposerDialog';
import { PostDetailsDialog } from './components/PostDetailsDialog';
import {
  type ComposerOptions,
  type PostDialogsApi,
  PostDialogsContext,
} from './postDialogsContext';

export function PostDialogsProvider({ children }: { children: ReactNode }) {
  const [composer, setComposer] = useState<ComposerOptions | null>(null);
  const [detailsId, setDetailsId] = useState<Id | null>(null);

  const api = useMemo<PostDialogsApi>(
    () => ({
      openComposer: (options = {}) => {
        setDetailsId(null);
        setComposer(options);
      },
      openDetails: (postId) => setDetailsId(postId),
    }),
    [],
  );

  return (
    <PostDialogsContext value={api}>
      {children}
      {detailsId && (
        <PostDetailsDialog
          postId={detailsId}
          onClose={() => setDetailsId(null)}
          onEdit={() => api.openComposer({ postId: detailsId })}
        />
      )}
      {composer && <PostComposerDialog options={composer} onClose={() => setComposer(null)} />}
    </PostDialogsContext>
  );
}
