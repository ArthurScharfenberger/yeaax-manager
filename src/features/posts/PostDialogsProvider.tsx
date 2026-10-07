import { type ReactNode, useMemo, useState } from 'react';

import { AiPostDialog } from '@/features/ai/components/AiPostDialog';
import type { Id } from '@/types';

import { DuplicatePostDialog } from './components/DuplicatePostDialog';
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
  const [duplicateId, setDuplicateId] = useState<Id | null>(null);
  const [aiMediaId, setAiMediaId] = useState<Id | null>(null);

  const api = useMemo<PostDialogsApi>(
    () => ({
      openComposer: (options = {}) => {
        setDetailsId(null);
        setComposer(options);
      },
      openDetails: (postId) => setDetailsId(postId),
      openDuplicate: (postId) => {
        setDetailsId(null);
        setDuplicateId(postId);
      },
      openAiPost: (mediaId) => setAiMediaId(mediaId),
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
          onDuplicate={() => api.openDuplicate(detailsId)}
        />
      )}
      {composer && <PostComposerDialog options={composer} onClose={() => setComposer(null)} />}
      {aiMediaId && <AiPostDialog mediaId={aiMediaId} onClose={() => setAiMediaId(null)} />}
      {duplicateId && (
        <DuplicatePostDialog postId={duplicateId} onClose={() => setDuplicateId(null)} />
      )}
    </PostDialogsContext>
  );
}
