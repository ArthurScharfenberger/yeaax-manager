import type { UseQueryResult } from '@tanstack/react-query';
import { useId } from 'react';

import { useServices } from '@/app/ServicesContext';
import { Avatar } from '@/components/ui/Avatar';
import { Checkbox } from '@/components/ui/Checkbox';
import { Field } from '@/components/ui/Field';
import { Select } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { Spinner } from '@/components/ui/Spinner';
import { getErrorMessage } from '@/lib/errors';
import { TIKTOK_COMMERCIAL_LABELS, TIKTOK_PRIVACY_LABELS } from '@/lib/labels';
import type { TikTokPolicy } from '@/services/desktop/DesktopBridge';
import type { CreatorInfo } from '@/services/social';
import { type TikTokPostOptions, type TikTokPrivacyLevel, tiktokPrivacyLevelSchema } from '@/types';
import { formatHandle } from '@/utils/format';

import {
  commercialLabel,
  requiredDeclaration,
  TIKTOK_OPTION_ISSUE_MESSAGES,
  type TikTokOptionIssue,
} from '../tiktokOptionsRules';

interface TikTokOptionsSectionProps {
  value: TikTokPostOptions;
  onChange: (next: TikTokPostOptions) => void;
  creator: UseQueryResult<CreatorInfo>;
  issues: readonly TikTokOptionIssue[];
  /** Mostra a lista de pendências (ao agendar). */
  showIssues: boolean;
}

const DISABLED_BY_ACCOUNT = 'Desativado nas configurações da sua conta do TikTok.';

/**
 * Escolhas exigidas pelas diretrizes do TikTok (Content Sharing Guidelines — DEC-029): conta que vai publicar,
 * privacidade sem padrão, interações desmarcadas (bloqueadas quando a conta não permite), divulgação de conteúdo
 * comercial e seus rótulos.
 */
export function TikTokOptionsSection({
  value,
  onChange,
  creator,
  issues,
  showIssues,
}: TikTokOptionsSectionProps) {
  const privacyId = useId();
  const info = creator.data;
  const set = (patch: Partial<TikTokPostOptions>) => onChange({ ...value, ...patch });
  const branded = value.commercialContent && value.brandedContent;
  const label = commercialLabel(value);

  return (
    <section
      aria-label="Opções do TikTok"
      className="flex flex-col gap-4 rounded-md border border-line p-4"
    >
      <CreatorHeader creator={creator} />

      <Field label="Quem pode ver este vídeo" htmlFor={privacyId}>
        <Select
          id={privacyId}
          value={value.privacyLevel ?? ''}
          onChange={(event) => {
            const parsed = tiktokPrivacyLevelSchema.safeParse(event.target.value);
            set({ privacyLevel: parsed.success ? parsed.data : null });
          }}
          disabled={!info}
          required
        >
          {/* Sem valor padrão: o usuário precisa escolher (diretrizes do TikTok). */}
          <option value="" disabled>
            Selecione…
          </option>
          {info?.privacyOptions.map((level: TikTokPrivacyLevel) => {
            const blocked = level === 'SELF_ONLY' && branded;
            return (
              <option key={level} value={level} disabled={blocked}>
                {TIKTOK_PRIVACY_LABELS[level]}
                {blocked ? ' — indisponível para conteúdo de marca' : ''}
              </option>
            );
          })}
        </Select>
      </Field>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-medium text-ink-2">
          Permitir que os espectadores
        </legend>
        <Checkbox
          label="Comentem"
          checked={value.allowComment}
          disabled={!info || info.commentDisabled}
          description={info?.commentDisabled ? DISABLED_BY_ACCOUNT : undefined}
          onChange={(event) => set({ allowComment: event.target.checked })}
        />
        <Checkbox
          label="Façam dueto"
          checked={value.allowDuet}
          disabled={!info || info.duetDisabled}
          description={info?.duetDisabled ? DISABLED_BY_ACCOUNT : undefined}
          onChange={(event) => set({ allowDuet: event.target.checked })}
        />
        <Checkbox
          label="Façam stitch"
          checked={value.allowStitch}
          disabled={!info || info.stitchDisabled}
          description={info?.stitchDisabled ? DISABLED_BY_ACCOUNT : undefined}
          onChange={(event) => set({ allowStitch: event.target.checked })}
        />
      </fieldset>

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-xs font-medium text-ink-2">Divulgação de conteúdo</legend>
        <Checkbox
          label="Divulgar conteúdo comercial"
          description="Indique se o conteúdo promove você, um terceiro ou ambos."
          checked={value.commercialContent}
          disabled={!info}
          onChange={(event) =>
            set({
              commercialContent: event.target.checked,
              yourBrand: false,
              brandedContent: false,
            })
          }
        />
        {value.commercialContent && (
          <div className="ml-6 flex flex-col gap-2">
            <Checkbox
              label="Sua marca"
              description="Você está promovendo a si mesmo ou o seu próprio negócio."
              checked={value.yourBrand}
              onChange={(event) => set({ yourBrand: event.target.checked })}
            />
            <Checkbox
              label="Conteúdo de marca"
              description={
                value.privacyLevel === 'SELF_ONLY'
                  ? 'Conteúdo de marca não pode ser privado (“Somente eu”). Mude a privacidade para marcar.'
                  : 'Você está promovendo outra marca ou um terceiro.'
              }
              checked={value.brandedContent}
              disabled={value.privacyLevel === 'SELF_ONLY'}
              onChange={(event) => set({ brandedContent: event.target.checked })}
            />
            {label ? (
              <p className="text-xs text-ink-2">
                Seu vídeo será identificado como “{TIKTOK_COMMERCIAL_LABELS[label]}”.
              </p>
            ) : (
              <p className="text-xs text-warning">
                Selecione ao menos uma opção para poder agendar.
              </p>
            )}
          </div>
        )}
      </fieldset>

      {showIssues && issues.length > 0 && (
        <Notice tone="warning" title="Antes de agendar no TikTok">
          <ul className="list-disc pl-4">
            {issues.map((issue) => (
              <li key={issue}>{TIKTOK_OPTION_ISSUE_MESSAGES[issue]}</li>
            ))}
          </ul>
        </Notice>
      )}
    </section>
  );
}

function CreatorHeader({ creator }: { creator: UseQueryResult<CreatorInfo> }) {
  if (creator.isPending) {
    return <Spinner label="Consultando a conta no TikTok…" />;
  }
  if (creator.isError) {
    return (
      <Notice tone="danger" title="Não é possível publicar nesta conta agora">
        {getErrorMessage(creator.error)}
      </Notice>
    );
  }
  const info = creator.data;
  return (
    <div className="flex items-center gap-3">
      <Avatar name={info.nickname} src={info.avatarUrl} />
      <div className="min-w-0">
        <p className="text-xs text-ink-3">Publicar no TikTok como</p>
        <p className="truncate text-sm font-medium text-ink">
          {info.nickname}
          {info.username && (
            <span className="font-normal text-ink-3"> · {formatHandle(info.username)}</span>
          )}
        </p>
      </div>
    </div>
  );
}

/**
 * Declaração exigida antes do botão de publicar. Os links abrem as políticas oficiais no navegador do sistema
 * (no webview, um link comum navegaria o próprio app).
 */
export function TikTokDeclaration({ options }: { options: TikTokPostOptions }) {
  const { desktop } = useServices();
  const open = (policy: TikTokPolicy) => () => void desktop.openTikTokPolicy(policy);
  const linkClass = 'text-accent underline underline-offset-2 hover:text-accent-hover';
  return (
    <p className="text-xs text-ink-2">
      Ao publicar ou agendar, você concorda com{' '}
      {requiredDeclaration(options) === 'branded_and_music' ? (
        <>
          a{' '}
          <button type="button" className={linkClass} onClick={open('branded_content')}>
            Política de Conteúdo de Marca
          </button>{' '}
          e a{' '}
        </>
      ) : (
        'a '
      )}
      <button type="button" className={linkClass} onClick={open('music_usage')}>
        Confirmação de Uso de Música
      </button>{' '}
      do TikTok. Agendado: o vídeo é enviado no horário, com o app aberto.
    </p>
  );
}
