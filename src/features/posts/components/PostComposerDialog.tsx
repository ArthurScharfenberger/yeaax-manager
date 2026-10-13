import { Modal } from '@/components/ui/Modal';
import { Notice } from '@/components/ui/Notice';
import { LoadingBlock } from '@/components/ui/Spinner';
import { getErrorMessage } from '@/lib/errors';

import { usePost } from '../hooks';
import type { ComposerOptions } from '../postDialogsContext';
import { buildInitialState } from './composerState';
import { ComposerForm } from './PostComposerForm';

interface PostComposerDialogProps {
  options: ComposerOptions;
  onClose: () => void;
}

/** Criação e edição de posts (carrega o post em edição e abre o formulário — `PostComposerForm`). */
export function PostComposerDialog({ options, onClose }: PostComposerDialogProps) {
  const editingId = options.postId ?? null;
  const existing = usePost(editingId);
  const title = editingId ? 'Editar post' : 'Novo post';

  if (editingId && existing.isPending) {
    return (
      <Modal title={title} onClose={onClose}>
        <LoadingBlock />
      </Modal>
    );
  }
  if (editingId && existing.isError) {
    return (
      <Modal title={title} onClose={onClose}>
        <Notice tone="danger">{getErrorMessage(existing.error)}</Notice>
      </Modal>
    );
  }

  return (
    <ComposerForm
      title={title}
      editingId={editingId}
      initialState={buildInitialState(options, existing.data)}
      onClose={onClose}
    />
  );
}
