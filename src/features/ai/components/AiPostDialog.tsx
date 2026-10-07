import { Sparkles } from 'lucide-react';
import { type KeyboardEvent, useId, useState } from 'react';

import { MediaThumbnail } from '@/components/MediaThumbnail';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Textarea } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Notice } from '@/components/ui/Notice';
import { useMedia } from '@/features/media/hooks';
import { getErrorMessage } from '@/lib/errors';
import type { Id } from '@/types';
import { formatDuration } from '@/utils/format';

import { useAiStatus, usePlanPost } from '../hooks';
import { MAX_INSTRUCTION_LENGTH, type PostPlan } from '../postPlanner';
import { AiPlanReview } from './AiPlanReview';

const EXAMPLES = [
  'Poste com uma legenda em inglês e boas hashtags',
  'Publique no TikTok e no Instagram amanhã às 19h',
  'Legenda curta e divertida em português, só no Instagram',
];

interface AiPostDialogProps {
  mediaId: Id;
  onClose: () => void;
}

/** "Postar com IA": descreva o que quer → a IA monta o plano → você revisa e confirma. */
export function AiPostDialog({ mediaId, onClose }: AiPostDialogProps) {
  const instructionId = useId();
  const [instruction, setInstruction] = useState('');
  const [plan, setPlan] = useState<PostPlan | null>(null);
  const media = useMedia(mediaId);
  const aiStatus = useAiStatus();
  const planPost = usePlanPost();

  function generate() {
    if (!instruction.trim() || planPost.isPending) return;
    planPost.mutate({ mediaId, instruction }, { onSuccess: setPlan });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      generate();
    }
  }

  return (
    <Modal
      title="Postar com IA"
      description={
        plan
          ? 'Revise o plano. Nada é criado até você confirmar.'
          : 'Descreva o que você quer fazer com este vídeo.'
      }
      size="lg"
      onClose={onClose}
      footer={
        !plan && (
          <>
            <Button onClick={onClose} disabled={planPost.isPending}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              icon={Sparkles}
              loading={planPost.isPending}
              disabled={!instruction.trim()}
              onClick={generate}
            >
              {planPost.isPending ? 'Preparando plano…' : 'Gerar plano'}
            </Button>
          </>
        )
      }
    >
      {plan ? (
        <AiPlanReview plan={plan} onBack={() => setPlan(null)} onDone={onClose} />
      ) : (
        <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-5">
          <div className="flex flex-col gap-1.5">
            {media.data && (
              <>
                <MediaThumbnail media={media.data} className="aspect-[9/16] w-full rounded" />
                <p className="truncate text-xs text-ink-2" title={media.data.filename}>
                  {media.data.filename}
                </p>
                <p className="text-2xs text-ink-3 tabular">{formatDuration(media.data.duration)}</p>
              </>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-3">
            <Field
              label="Pedido"
              htmlFor={instructionId}
              hint="Ctrl+Enter para gerar. Você revisa tudo antes de confirmar."
              aside={
                aiStatus.data && (
                  <Badge tone={aiStatus.data.simulated ? 'warning' : 'success'}>
                    {aiStatus.data.label}
                  </Badge>
                )
              }
            >
              <Textarea
                id={instructionId}
                rows={5}
                data-autofocus
                maxLength={MAX_INSTRUCTION_LENGTH}
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder='Ex.: "Poste no TikTok e no Instagram com uma legenda em inglês e boas hashtags, amanhã às 19h"'
              />
            </Field>

            <div className="flex flex-wrap gap-1.5" aria-label="Exemplos de pedido">
              {EXAMPLES.map((example) => (
                <button
                  key={example}
                  type="button"
                  onClick={() => setInstruction(example)}
                  className="rounded-sm border border-line bg-sunken px-2 py-1 text-xs text-ink-2 hover:border-line-strong hover:text-ink"
                >
                  {example}
                </button>
              ))}
            </div>

            {aiStatus.data?.simulated && (
              <Notice>
                Sem chave da OpenAI, um interpretador local entende idioma, plataformas e horários,
                mas as legendas são simples. Configure a chave em Configurações → IA.
              </Notice>
            )}
            {planPost.isError && <Notice tone="danger">{getErrorMessage(planPost.error)}</Notice>}
          </div>
        </div>
      )}
    </Modal>
  );
}
