import { useMutation } from '@tanstack/react-query';
import { Copy, PenLine, Plus, Sparkles } from 'lucide-react';
import { type SubmitEvent, useId, useState } from 'react';
import { useSearchParams } from 'react-router';

import { useServices } from '@/app/ServicesContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field } from '@/components/ui/Field';
import { Select, Textarea } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { useToast } from '@/components/ui/toastContext';
import { checkCaption } from '@/features/posts/postRules';
import { usePostDialogs } from '@/features/posts/postDialogsContext';
import { getErrorMessage } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { PLATFORM_INFO } from '@/lib/platforms';
import {
  CAPTION_LANGUAGES,
  CAPTION_TONES,
  type CaptionLanguage,
  type CaptionRequest,
  type CaptionTone,
} from '@/services/ai';
import { type Platform, PLATFORMS } from '@/types';
import { cn } from '@/utils/cn';

import { useAiStatus } from './hooks';

const LANGUAGE_LABELS: Record<CaptionLanguage, string> = {
  'pt-BR': 'Português (Brasil)',
  en: 'Inglês',
  es: 'Espanhol',
};

const TONE_LABELS: Record<CaptionTone, string> = {
  casual: 'Casual',
  informative: 'Informativo',
  fun: 'Divertido',
  professional: 'Profissional',
};

function parseLanguage(value: string | null): CaptionLanguage {
  return (CAPTION_LANGUAGES as readonly string[]).includes(value ?? '')
    ? (value as CaptionLanguage)
    : 'pt-BR';
}

export function CaptionsPage() {
  const { ai } = useServices();
  const { openComposer } = usePostDialogs();
  const toast = useToast();
  const [params] = useSearchParams();
  const ids = { description: useId(), platform: useId(), language: useId(), tone: useId() };
  const [request, setRequest] = useState<CaptionRequest>({
    description: '',
    platform: 'tiktok',
    language: parseLanguage(params.get('lang')),
    tone: 'casual',
    includeHashtags: true,
  });
  const aiStatus = useAiStatus();
  const generate = useMutation({
    mutationFn: (input: CaptionRequest) => ai.generateCaptions(input),
  });

  function patch(changes: Partial<CaptionRequest>) {
    setRequest((current) => ({ ...current, ...changes }));
  }

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (!request.description.trim()) return;
    generate.mutate(request);
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Legenda copiada');
    } catch (error) {
      logger.warn('Falha ao copiar para a área de transferência', { error });
      toast.error(error, 'Não foi possível copiar');
    }
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Legendas IA"
        description="Gere variações de legenda e hashtags a partir de uma descrição do vídeo."
        actions={
          aiStatus.data && (
            <Badge tone={aiStatus.data.simulated ? 'warning' : 'success'}>
              {aiStatus.data.label}
            </Badge>
          )
        }
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-5 p-6">
          {aiStatus.data?.simulated && (
            <Notice title="Gerador simulado">
              Sem chave da OpenAI configurada, as sugestões vêm de modelos de texto locais.
              Configure a chave em Configurações → IA para usar IA real.
            </Notice>
          )}
          {generate.isError && <Notice tone="danger">{getErrorMessage(generate.error)}</Notice>}

          <div className="grid gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
            <Panel title="Briefing">
              <form onSubmit={handleSubmit} className="flex flex-col gap-4 p-4">
                <Field label="Sobre o que é o vídeo?" htmlFor={ids.description}>
                  <Textarea
                    id={ids.description}
                    rows={5}
                    value={request.description}
                    onChange={(event) => patch({ description: event.target.value })}
                    placeholder="Ex.: Como trocar a tela do iPhone 13 em casa com segurança"
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Plataforma" htmlFor={ids.platform}>
                    <Select
                      id={ids.platform}
                      value={request.platform}
                      onChange={(event) => patch({ platform: event.target.value as Platform })}
                    >
                      {PLATFORMS.map((platform) => (
                        <option key={platform} value={platform}>
                          {PLATFORM_INFO[platform].label}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Tom" htmlFor={ids.tone}>
                    <Select
                      id={ids.tone}
                      value={request.tone}
                      onChange={(event) => patch({ tone: event.target.value as CaptionTone })}
                    >
                      {CAPTION_TONES.map((tone) => (
                        <option key={tone} value={tone}>
                          {TONE_LABELS[tone]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
                <Field label="Idioma" htmlFor={ids.language}>
                  <Select
                    id={ids.language}
                    value={request.language}
                    onChange={(event) => patch({ language: event.target.value as CaptionLanguage })}
                  >
                    {CAPTION_LANGUAGES.map((language) => (
                      <option key={language} value={language}>
                        {LANGUAGE_LABELS[language]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Checkbox
                  label="Incluir hashtags"
                  description="Extraídas das palavras-chave da descrição."
                  checked={request.includeHashtags}
                  onChange={(event) => patch({ includeHashtags: event.target.checked })}
                />
                <Button
                  type="submit"
                  variant="primary"
                  icon={Sparkles}
                  loading={generate.isPending}
                  disabled={!request.description.trim()}
                >
                  Gerar legendas
                </Button>
              </form>
            </Panel>

            <Panel
              title="Sugestões"
              meta={generate.data ? `${generate.data.length} variações` : undefined}
            >
              {!generate.data && (
                <EmptyState
                  icon={PenLine}
                  title="Nenhuma sugestão ainda"
                  description="Descreva o vídeo e clique em Gerar legendas."
                />
              )}
              <ul className="divide-y divide-line">
                {generate.data?.map((suggestion, index) => {
                  const check = checkCaption(suggestion.text, request.platform);
                  return (
                    <li key={suggestion.id} className="flex flex-col gap-3 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-ink-3">Variação {index + 1}</span>
                        <span
                          className={cn(
                            'text-2xs tabular',
                            check.tooLong ? 'text-danger' : 'text-ink-3',
                          )}
                        >
                          {check.length}/{check.maxLength}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap text-ink">{suggestion.text}</p>
                      <div className="flex gap-2">
                        <Button size="sm" icon={Copy} onClick={() => void copy(suggestion.text)}>
                          Copiar
                        </Button>
                        <Button
                          size="sm"
                          icon={Plus}
                          onClick={() => openComposer({ caption: suggestion.text })}
                        >
                          Usar em novo post
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Panel>
          </div>
        </div>
      </div>
    </div>
  );
}
