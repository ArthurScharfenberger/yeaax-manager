import { type SubmitEvent, useId, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Notice } from '@/components/ui/Notice';
import { useToast } from '@/components/ui/toastContext';
import { useChannels } from '@/features/channels/hooks';
import { MediaVideoPreview } from '@/features/media/components/MediaVideoPreview';
import { useMediaList } from '@/features/media/hooks';
import { PublishProgressNotice } from '@/features/publishing/components/PublishProgressNotice';
import { useCanPublish, usePublishNow } from '@/features/publishing/hooks';
import { PROCESSING_NOTICE } from '@/features/publishing/publishService';
import { getErrorMessage } from '@/lib/errors';
import { CHANNEL_STATUS_LABELS, POST_STATUS_LABELS } from '@/lib/labels';
import { PLATFORM_INFO } from '@/lib/platforms';
import type { Id } from '@/types';
import { cn } from '@/utils/cn';
import { parseDateTimeInput } from '@/utils/date';
import { formatDuration, formatHandle } from '@/utils/format';

import { useCreatorInfo, useSavePost } from '../hooks';
import type { PostInput } from '../postService';
import { checkCaption, COMPOSER_STATUSES, type ComposerStatus } from '../postRules';
import { tiktokOptionIssues } from '../tiktokOptionsRules';
import { type FormState, SUBMIT_LABELS, successMessage } from './composerState';
import { TikTokDeclaration, TikTokOptionsSection } from './TikTokPostOptions';

interface ComposerFormProps {
  title: string;
  editingId: Id | null;
  initialState: FormState;
  onClose: () => void;
}

export function ComposerForm({ title, editingId, initialState, onClose }: ComposerFormProps) {
  const ids = {
    channel: useId(),
    media: useId(),
    caption: useId(),
    date: useId(),
    time: useId(),
    status: useId(),
  };
  const formId = useId();
  const [form, setForm] = useState(initialState);
  const [error, setError] = useState<string | null>(null);
  /** Id do post já salvo (o "Publicar agora" salva antes de enviar; tentativas seguintes editam o mesmo post). */
  const [savedId, setSavedId] = useState<Id | null>(editingId);
  const channels = useChannels();
  const media = useMediaList();
  const save = useSavePost();
  const publishNow = usePublishNow();
  const toast = useToast();

  const channelList = channels.data ?? [];
  const defaultChannelId =
    channelList.find((channel) => channel.status === 'connected')?.id ?? channelList[0]?.id ?? '';
  const channelId = form.channelId || defaultChannelId;
  const channel = channelList.find((item) => item.id === channelId);
  const selectedMedia = media.data?.find((item) => item.id === form.mediaId);
  const caption = checkCaption(form.caption, channel?.platform ?? 'tiktok');

  // TikTok: o creator_info é buscado de novo sempre que o compositor abre (diretrizes do TikTok).
  const isTikTok = channel?.platform === 'tiktok';
  const creator = useCreatorInfo(isTikTok ? channel : undefined);
  const tiktokIssues = isTikTok
    ? tiktokOptionIssues(form.tiktok, creator.data ?? null, selectedMedia?.duration ?? null)
    : [];
  const schedulingTikTok = isTikTok && form.status === 'scheduled';
  const blockedByTikTok = schedulingTikTok && (tiktokIssues.length > 0 || !creator.isSuccess);
  const canPublish = useCanPublish(channel?.platform);
  const readyToPublish =
    canPublish &&
    channel?.status === 'connected' &&
    Boolean(selectedMedia) &&
    (!isTikTok || (creator.isSuccess && tiktokIssues.length === 0));
  const busy = save.isPending || publishNow.isPending;

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  function buildInput(status: ComposerStatus): PostInput | null {
    let scheduledAt: string | null = null;
    if (form.date || form.time) {
      const parsed = parseDateTimeInput(form.date, form.time);
      if (!parsed) {
        setError('Preencha data e horário completos, ou deixe ambos vazios.');
        return null;
      }
      scheduledAt = parsed.toISOString();
    }
    return {
      channelId,
      mediaId: form.mediaId || null,
      caption: form.caption,
      status,
      scheduledAt,
      platformOptions: isTikTok ? form.tiktok : null,
    };
  }

  function submit(status: ComposerStatus) {
    const input = buildInput(status);
    if (!input) return;
    save.mutate(
      { id: savedId, input },
      {
        onSuccess: (post) => {
          toast.success(successMessage(post));
          onClose();
        },
        onError: (caught) => setError(getErrorMessage(caught)),
      },
    );
  }

  /**
   * "Publicar agora": salva o post (rascunho, com as escolhas) e envia. O clique, com a declaração visível, é o
   * consentimento expresso exigido pelo TikTok (registrado no post).
   */
  function publish() {
    const input = buildInput('draft');
    if (!input) return;
    save.mutate(
      { id: savedId, input },
      {
        onSuccess: (post) => {
          setSavedId(post.id);
          publishNow.mutate(post.id, {
            onSuccess: () => {
              toast.success('Vídeo enviado ao TikTok', PROCESSING_NOTICE);
              onClose();
            },
            onError: (caught) => setError(getErrorMessage(caught)),
          });
        },
        onError: (caught) => setError(getErrorMessage(caught)),
      },
    );
  }

  // Durante o envio a janela não fecha (o upload continua no app, mas o progresso some).
  const close = () => {
    if (!busy) onClose();
  };

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    submit(form.status);
  }

  return (
    <Modal
      title={title}
      description="Os posts ficam salvos localmente. Agendados são publicados no horário, com o app aberto."
      size="lg"
      onClose={close}
      footer={
        <>
          <Button onClick={close} disabled={busy}>
            Cancelar
          </Button>
          {form.status !== 'draft' && (
            <Button onClick={() => submit('draft')} disabled={busy}>
              Salvar como rascunho
            </Button>
          )}
          {canPublish && (
            <Button
              onClick={publish}
              loading={publishNow.isPending}
              disabled={busy || !readyToPublish}
            >
              Publicar agora
            </Button>
          )}
          <Button
            type="submit"
            form={formId}
            variant="primary"
            loading={save.isPending && !publishNow.isPending}
            disabled={blockedByTikTok || busy}
          >
            {SUBMIT_LABELS[form.status]}
          </Button>
        </>
      }
    >
      <form
        id={formId}
        onSubmit={handleSubmit}
        className="grid grid-cols-[180px_minmax(0,1fr)] gap-5"
        noValidate
      >
        <div className="flex flex-col gap-2">
          {selectedMedia ? (
            <>
              {/* Prévia do conteúdo antes de publicar (exigida pelas diretrizes do TikTok). */}
              <MediaVideoPreview media={selectedMedia} />
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
            label={isTikTok ? 'Título / legenda' : 'Legenda'}
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
              rows={5}
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

          {isTikTok && (
            <TikTokOptionsSection
              value={form.tiktok}
              onChange={(next) => update('tiktok', next)}
              creator={creator}
              issues={tiktokIssues}
              showIssues={schedulingTikTok}
            />
          )}

          {publishNow.progress && <PublishProgressNotice progress={publishNow.progress} />}
          {error && <Notice tone="danger">{error}</Notice>}
          {isTikTok && <TikTokDeclaration options={form.tiktok} />}
        </div>
      </form>
    </Modal>
  );
}
