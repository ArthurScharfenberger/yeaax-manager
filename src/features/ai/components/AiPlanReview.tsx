import { CalendarCheck, X } from 'lucide-react';
import { useId, useState } from 'react';

import { PlatformMark } from '@/components/PlatformMark';
import { ChannelStatusBadge } from '@/components/StatusBadges';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { IconButton } from '@/components/ui/IconButton';
import { Input, Textarea } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { useToast } from '@/components/ui/toastContext';
import { checkCaption } from '@/features/posts/postRules';
import type { DuplicateResult } from '@/features/posts/postService';
import type { Id } from '@/types';
import { cn } from '@/utils/cn';
import { parseDateTimeInput, toDateInputValue, toTimeInputValue } from '@/utils/date';
import { formatHandle, formatScheduleLabel } from '@/utils/format';

import { useConfirmPlan } from '../hooks';
import type { PostPlan } from '../postPlanner';

interface AiPlanReviewProps {
  plan: PostPlan;
  onBack: () => void;
  onDone: () => void;
}

/** Revisão do plano: o clique em confirmar é o consentimento explícito do usuário (DEC-019). */
export function AiPlanReview({ plan, onBack, onDone }: AiPlanReviewProps) {
  const ids = { date: useId(), time: useId() };
  const [captions, setCaptions] = useState(
    () => new Map(plan.posts.map((post) => [post.channel.id, post.caption])),
  );
  const [date, setDate] = useState(plan.scheduledAt ? toDateInputValue(plan.scheduledAt) : '');
  const [time, setTime] = useState(plan.scheduledAt ? toTimeInputValue(plan.scheduledAt) : '');
  const [failures, setFailures] = useState<DuplicateResult['failed']>([]);
  const confirm = useConfirmPlan();
  const toast = useToast();

  const posts = plan.posts.filter((post) => captions.has(post.channel.id));
  const scheduledAt = date || time ? parseDateTimeInput(date, time) : null;
  const scheduleInvalid = (date !== '' || time !== '') && scheduledAt === null;
  const checks = posts.map((post) =>
    checkCaption(captions.get(post.channel.id) ?? '', post.channel.platform),
  );
  const captionsInvalid = checks.some(
    (check) => check.tooLong || check.tooManyHashtags || check.tooManyMentions,
  );

  function updateCaption(channelId: Id, value: string | null) {
    setCaptions((current) => {
      const next = new Map(current);
      if (value === null) next.delete(channelId);
      else next.set(channelId, value);
      return next;
    });
  }

  function submit() {
    confirm.mutate(
      {
        mediaId: plan.mediaId,
        instruction: plan.instruction,
        posts: posts.map((post) => ({
          channelId: post.channel.id,
          caption: captions.get(post.channel.id) ?? '',
        })),
        scheduledAt,
      },
      {
        onSuccess: (result) => {
          if (result.failed.length > 0) {
            setFailures(result.failed);
            return;
          }
          toast.success(
            scheduledAt
              ? `${result.created.length} post(s) agendado(s)`
              : `${result.created.length} rascunho(s) criado(s)`,
            scheduledAt ? formatScheduleLabel(scheduledAt, new Date()) : undefined,
          );
          onDone();
        },
        onError: (error) => toast.error(error),
      },
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Notice title="O que a IA entendeu">{plan.summary}</Notice>
      {plan.scheduleNote && <Notice tone="warning">{plan.scheduleNote}</Notice>}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Data" htmlFor={ids.date} hint="Deixe vazio para salvar como rascunho.">
          <Input id={ids.date} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field
          label="Horário"
          htmlFor={ids.time}
          error={scheduleInvalid ? 'Preencha data e horário, ou deixe ambos vazios.' : null}
        >
          <Input id={ids.time} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>

      <ul className="flex flex-col gap-3" aria-label="Posts planejados">
        {posts.map((post, index) => {
          const check = checks[index];
          const invalid =
            check && (check.tooLong || check.tooManyHashtags || check.tooManyMentions);
          return (
            <li key={post.channel.id} className="rounded-md border border-line">
              <div className="flex items-center gap-2 border-b border-line bg-sunken px-3 py-2">
                <PlatformMark platform={post.channel.platform} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                  {post.channel.displayName}{' '}
                  <span className="text-xs font-normal text-ink-3">
                    {formatHandle(post.channel.username)}
                  </span>
                </span>
                {post.channel.status !== 'connected' && (
                  <ChannelStatusBadge status={post.channel.status} />
                )}
                {check && (
                  <span className={cn('text-2xs tabular', invalid ? 'text-danger' : 'text-ink-3')}>
                    {check.length}/{check.maxLength} · {check.hashtags} hashtags
                  </span>
                )}
                <IconButton
                  icon={X}
                  size="sm"
                  label={`Remover ${post.channel.displayName} do plano`}
                  onClick={() => updateCaption(post.channel.id, null)}
                />
              </div>
              <Textarea
                aria-label={`Legenda para ${post.channel.displayName}`}
                rows={5}
                value={captions.get(post.channel.id) ?? ''}
                onChange={(event) => updateCaption(post.channel.id, event.target.value)}
                className="block w-full rounded-t-none border-0 focus:ring-0"
              />
            </li>
          );
        })}
      </ul>

      {posts.length === 0 && (
        <Notice tone="warning">Todos os canais foram removidos do plano.</Notice>
      )}
      {failures.length > 0 && (
        <Notice tone="danger" title="Alguns posts não foram criados">
          <ul className="list-disc pl-4">
            {failures.map((item) => (
              <li key={item.channelId}>
                {plan.posts.find((post) => post.channel.id === item.channelId)?.channel.displayName}
                : {item.message}
              </li>
            ))}
          </ul>
        </Notice>
      )}
      <p className="text-xs text-ink-3">
        A publicação automática nas plataformas será ativada na integração com as APIs oficiais. Por
        enquanto, os posts ficam agendados no calendário.
      </p>

      <div className="flex justify-end gap-2 border-t border-line pt-3">
        <Button onClick={onBack} disabled={confirm.isPending}>
          Voltar
        </Button>
        <Button
          variant="primary"
          icon={CalendarCheck}
          loading={confirm.isPending}
          disabled={posts.length === 0 || captionsInvalid || scheduleInvalid}
          onClick={submit}
        >
          {scheduledAt
            ? `Confirmar e agendar (${posts.length})`
            : `Salvar rascunhos (${posts.length})`}
        </Button>
      </div>
    </div>
  );
}
