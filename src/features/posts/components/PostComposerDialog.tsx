import { type SubmitEvent, useId, useState } from 'react';

import { MediaThumbnail } from '@/components/MediaThumbnail';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Notice } from '@/components/ui/Notice';
import { LoadingBlock } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/toastContext';
import { useChannels } from '@/features/channels/hooks';
import { useMediaList } from '@/features/media/hooks';
import { getErrorMessage } from '@/lib/errors';
import { CHANNEL_STATUS_LABELS, POST_STATUS_LABELS } from '@/lib/labels';
import { PLATFORM_INFO } from '@/lib/platforms';
import type { Id, Post, PostWithRelations } from '@/types';
import { cn } from '@/utils/cn';
import { parseDateTimeInput, toDateInputValue, toTimeInputValue } from '@/utils/date';
import { formatDuration, formatHandle, formatScheduleLabel } from '@/utils/format';

import { usePost, useSavePost } from '../hooks';
import type { ComposerOptions } from '../postDialogsContext';
import { checkCaption, COMPOSER_STATUSES, type ComposerStatus } from '../postRules';

interface FormState {
  channelId: string;
  mediaId: string;
  caption: string;
  date: string;
  time: string;
  status: ComposerStatus;
}

const SUBMIT_LABELS: Record<ComposerStatus, string> = {
  draft: 'Salvar rascunho',
  review: 'Enviar para revisão',
  scheduled: 'Agendar',
};

function isComposerStatus(status: string): status is ComposerStatus {
  return (COMPOSER_STATUSES as readonly string[]).includes(status);
}

function buildInitialState(
  options: ComposerOptions,
  post: PostWithRelations | undefined,
): FormState {
  const date = post?.scheduledAt ? new Date(post.scheduledAt) : (options.scheduledAt ?? null);
  return {
    channelId: post?.channelId ?? options.channelId ?? '',
    mediaId: post?.mediaId ?? options.mediaId ?? '',
    caption: post?.caption ?? options.caption ?? '',
    date: date ? toDateInputValue(date) : '',
    time: date ? toTimeInputValue(date) : '',
    status: post
      ? isComposerStatus(post.status)
        ? post.status
        : 'draft'
      : date
        ? 'scheduled'
        : 'draft',
  };
}

function successMessage(post: Post): string {
  if (post.status === 'scheduled' && post.scheduledAt) {
    return `Post agendado · ${formatScheduleLabel(new Date(post.scheduledAt), new Date())}`;
  }
  return post.status === 'review' ? 'Post enviado para revisão' : 'Rascunho salvo';
}

interface PostComposerDialogProps {
  options: ComposerOptions;
  onClose: () => void;
}

/** Criação e edição de posts. Nada é publicado de verdade nesta fase. */
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

interface ComposerFormProps {
  title: string;
  editingId: Id | null;
  initialState: FormState;
  onClose: () => void;
}

function ComposerForm({ title, editingId, initialState, onClose }: ComposerFormProps) {
  const ids = {
    channel: useId(),
    media: useId(),
    caption: useId(),
    date: useId(),
    time: useId(),
    status: useId(),
  };
  const [form, setForm] = useState(initialState);
  const [error, setError] = useState<string | null>(null);
  const channels = useChannels();
  const media = useMediaList();
  const save = useSavePost();
  const toast = useToast();

  const channelList = channels.data ?? [];
  const defaultChannelId =
    channelList.find((channel) => channel.status === 'connected')?.id ?? channelList[0]?.id ?? '';
  const channelId = form.channelId || defaultChannelId;
  const channel = channelList.find((item) => item.id === channelId);
  const selectedMedia = media.data?.find((item) => item.id === form.mediaId);
  const caption = checkCaption(form.caption, channel?.platform ?? 'tiktok');

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  function submit(status: ComposerStatus) {
    let scheduledAt: string | null = null;
    if (form.date || form.time) {
      const parsed = parseDateTimeInput(form.date, form.time);
      if (!parsed) {
        setError('Preencha data e horário completos, ou deixe ambos vazios.');
        return;
      }
      scheduledAt = parsed.toISOString();
    }

    save.mutate(
      {
        id: editingId,
        input: {
          channelId,
          mediaId: form.mediaId || null,
          caption: form.caption,
          status,
          scheduledAt,
        },
      },
      {
        onSuccess: (post) => {
          toast.success(successMessage(post));
          onClose();
        },
        onError: (caught) => setError(getErrorMessage(caught)),
      },
    );
  }

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    submit(form.status);
  }

  const formId = useId();

  return (
    <Modal
      title={title}
      description="Os posts ficam salvos localmente. A publicação real será ativada com as integrações oficiais."
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={save.isPending}>
            Cancelar
          </Button>
          {form.status !== 'draft' && (
            <Button onClick={() => submit('draft')} disabled={save.isPending}>
              Salvar como rascunho
            </Button>
          )}
          <Button type="submit" form={formId} variant="primary" loading={save.isPending}>
            {SUBMIT_LABELS[form.status]}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={handleSubmit}
        className="grid grid-cols-[150px_minmax(0,1fr)] gap-5"
        noValidate
      >
        <div className="flex flex-col gap-2">
          {selectedMedia ? (
            <>
              <MediaThumbnail media={selectedMedia} className="aspect-[9/16] w-full rounded" />
              <p className="truncate text-xs text-ink-2" title={selectedMedia.filename}>
                {selectedMedia.filename}
              </p>
              <p className="text-2xs text-ink-3 tabular">
                {formatDuration(selectedMedia.duration)}
              </p>
            </>
          ) : (
            <div className="flex aspect-[9/16] w-full items-center justify-center rounded border border-dashed border-line-strong px-3 text-center text-xs text-ink-3">
              Nenhum vídeo selecionado
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Canal" htmlFor={ids.channel}>
              <Select
                id={ids.channel}
                value={channelId}
                onChange={(event) => update('channelId', event.target.value)}
                disabled={channels.isPending}
                required
              >
                {channelList.length === 0 && <option value="">Nenhum canal cadastrado</option>}
                {channelList.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.displayName} · {formatHandle(item.username)} (
                    {PLATFORM_INFO[item.platform].label})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status" htmlFor={ids.status}>
              <Select
                id={ids.status}
                value={form.status}
                onChange={(event) => update('status', event.target.value as ComposerStatus)}
              >
                {COMPOSER_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {POST_STATUS_LABELS[status]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {channel && channel.status !== 'connected' && (
            <Notice tone="warning">
              Canal com status “{CHANNEL_STATUS_LABELS[channel.status]}”. Reconecte-o antes da data
              de publicação.
            </Notice>
          )}

          <Field label="Vídeo" htmlFor={ids.media}>
            <Select
              id={ids.media}
              value={form.mediaId}
              onChange={(event) => update('mediaId', event.target.value)}
              disabled={media.isPending}
            >
              <option value="">Sem vídeo (definir depois)</option>
              {media.data?.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.filename} · {formatDuration(item.duration)}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Legenda"
            htmlFor={ids.caption}
            aside={
              <span
                className={cn(
                  'text-2xs tabular',
                  caption.tooLong || caption.tooManyHashtags || caption.tooManyMentions
                    ? 'text-danger'
                    : 'text-ink-3',
                )}
              >
                {caption.length}/{caption.maxLength}
                {' · '}
                {caption.hashtags}
                {caption.maxHashtags !== null && `/${caption.maxHashtags}`} hashtags
                {caption.maxMentions !== null &&
                  ` · ${caption.mentions}/${caption.maxMentions} menções`}
              </span>
            }
          >
            <Textarea
              id={ids.caption}
              rows={6}
              value={form.caption}
              onChange={(event) => update('caption', event.target.value)}
              placeholder="Escreva a legenda do post…"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Data" htmlFor={ids.date}>
              <Input
                id={ids.date}
                type="date"
                value={form.date}
                onChange={(event) => update('date', event.target.value)}
              />
            </Field>
            <Field label="Horário" htmlFor={ids.time}>
              <Input
                id={ids.time}
                type="time"
                value={form.time}
                onChange={(event) => update('time', event.target.value)}
              />
            </Field>
          </div>

          {error && <Notice tone="danger">{error}</Notice>}
        </div>
      </form>
    </Modal>
  );
}
