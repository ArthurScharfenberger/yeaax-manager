import { CopyPlus } from 'lucide-react';
import { useState } from 'react';

import { PlatformMark } from '@/components/PlatformMark';
import { ChannelStatusBadge } from '@/components/StatusBadges';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Notice } from '@/components/ui/Notice';
import { LoadingBlock } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/toastContext';
import { useChannels } from '@/features/channels/hooks';
import { getErrorMessage } from '@/lib/errors';
import type { Channel, Id, PostWithRelations } from '@/types';
import { formatHandle, truncate } from '@/utils/format';

import { useDuplicatePost, usePost } from '../hooks';
import type { DuplicateResult } from '../postService';

interface DuplicatePostDialogProps {
  postId: Id;
  onClose: () => void;
}

/** A "mesma marca" em outra plataforma (mesmo usuário ou mesmo nome de exibição). */
function isSameBrand(channel: Channel, source: PostWithRelations['channel']): boolean {
  return (
    channel.platform !== source.platform &&
    (channel.username.toLowerCase() === source.username.toLowerCase() ||
      channel.displayName.toLowerCase() === source.displayName.toLowerCase())
  );
}

export function DuplicatePostDialog({ postId, onClose }: DuplicatePostDialogProps) {
  const post = usePost(postId);
  const channels = useChannels();

  if (post.isPending || channels.isPending) {
    return (
      <Modal title="Duplicar post" onClose={onClose}>
        <LoadingBlock />
      </Modal>
    );
  }
  if (!post.data || !channels.data) {
    return (
      <Modal title="Duplicar post" onClose={onClose}>
        <Notice tone="danger">{getErrorMessage(post.error ?? channels.error)}</Notice>
      </Modal>
    );
  }

  const targets = channels.data.filter((channel) => channel.id !== post.data.channelId);
  return (
    <DuplicateForm
      post={post.data}
      targets={targets}
      initialSelection={targets.filter((channel) => isSameBrand(channel, post.data.channel))}
      onClose={onClose}
    />
  );
}

interface DuplicateFormProps {
  post: PostWithRelations;
  targets: Channel[];
  initialSelection: Channel[];
  onClose: () => void;
}

function DuplicateForm({ post, targets, initialSelection, onClose }: DuplicateFormProps) {
  const [selected, setSelected] = useState(() => new Set(initialSelection.map((item) => item.id)));
  const [result, setResult] = useState<DuplicateResult | null>(null);
  const duplicate = useDuplicatePost();
  const toast = useToast();
  const channelName = (id: Id) => {
    const channel = targets.find((item) => item.id === id);
    return channel ? `${channel.displayName} (${formatHandle(channel.username)})` : id;
  };

  function toggle(id: Id, checked: boolean) {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function submit() {
    duplicate.mutate(
      { id: post.id, channelIds: [...selected] },
      {
        onSuccess: (outcome) => {
          if (outcome.failed.length === 0) {
            toast.success(
              outcome.created.length === 1
                ? '1 rascunho criado'
                : `${outcome.created.length} rascunhos criados`,
              'Revise e agende cada cópia antes de publicar.',
            );
            onClose();
          } else {
            setResult(outcome);
          }
        },
        onError: (error) => toast.error(error),
      },
    );
  }

  return (
    <Modal
      title="Duplicar para outros canais"
      description="As cópias são criadas como rascunho, com o mesmo vídeo, legenda e horário planejado."
      size="sm"
      onClose={onClose}
      footer={
        result ? (
          <Button variant="primary" onClick={onClose}>
            Fechar
          </Button>
        ) : (
          <>
            <Button onClick={onClose} disabled={duplicate.isPending}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              icon={CopyPlus}
              loading={duplicate.isPending}
              disabled={selected.size === 0}
              onClick={submit}
            >
              {selected.size <= 1 ? 'Criar rascunho' : `Criar ${selected.size} rascunhos`}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded border border-line bg-sunken px-3 py-2 text-xs text-ink-2">
          <span className="font-medium text-ink">{post.channel.displayName}</span>{' '}
          <PlatformMark platform={post.channel.platform} className="align-middle" />
          <p className="mt-1 text-ink-3">{truncate(post.caption || 'Sem legenda', 140)}</p>
        </div>

        {result ? (
          <div className="flex flex-col gap-2">
            {result.created.length > 0 && (
              <Notice>
                {result.created.length} rascunho(s) criado(s). Revise e agende cada um antes de
                publicar.
              </Notice>
            )}
            <Notice tone="danger" title="Algumas cópias não foram criadas">
              <ul className="list-disc pl-4">
                {result.failed.map((item) => (
                  <li key={item.channelId}>
                    {channelName(item.channelId)}: {item.message}
                  </li>
                ))}
              </ul>
            </Notice>
          </div>
        ) : targets.length === 0 ? (
          <Notice>Não há outros canais cadastrados.</Notice>
        ) : (
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1.5 text-xs font-medium text-ink-2">Canais de destino</legend>
            {targets.map((channel) => (
              <label
                key={channel.id}
                className="flex items-center gap-2.5 rounded px-2 py-1.5 hover:bg-hover"
              >
                <input
                  type="checkbox"
                  className="size-4 accent-accent"
                  checked={selected.has(channel.id)}
                  onChange={(event) => toggle(channel.id, event.target.checked)}
                />
                <PlatformMark platform={channel.platform} />
                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                  {channel.displayName}{' '}
                  <span className="text-xs text-ink-3">{formatHandle(channel.username)}</span>
                </span>
                {channel.status !== 'connected' && <ChannelStatusBadge status={channel.status} />}
              </label>
            ))}
          </fieldset>
        )}
      </div>
    </Modal>
  );
}
