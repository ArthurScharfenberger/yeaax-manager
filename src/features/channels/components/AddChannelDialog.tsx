import { type SubmitEvent, useId, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Notice } from '@/components/ui/Notice';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useToast } from '@/components/ui/toastContext';
import { getErrorMessage } from '@/lib/errors';
import { PLATFORM_INFO } from '@/lib/platforms';
import { type Platform, PLATFORMS } from '@/types';
import { formatHandle } from '@/utils/format';

import { useConnectNewChannel } from '../hooks';

const PLATFORM_OPTIONS = PLATFORMS.map((platform) => ({
  value: platform,
  label: PLATFORM_INFO[platform].label,
}));

export function AddChannelDialog({ onClose }: { onClose: () => void }) {
  const usernameId = useId();
  const displayNameId = useId();
  const formId = useId();
  const [platform, setPlatform] = useState<Platform>('tiktok');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const connect = useConnectNewChannel();
  const toast = useToast();

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setError(null);
    connect.mutate(
      { platform, username, displayName },
      {
        onSuccess: (channel) => {
          toast.success(
            'Canal conectado',
            `${formatHandle(channel.username)} · ${PLATFORM_INFO[channel.platform].label}`,
          );
          onClose();
        },
        onError: (caught) => setError(getErrorMessage(caught)),
      },
    );
  }

  return (
    <Modal
      title="Adicionar canal"
      description="Conecte uma conta do TikTok ou do Instagram."
      size="sm"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose} disabled={connect.isPending}>
            Cancelar
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={connect.isPending}>
            Conectar (simulado)
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-ink-2">Plataforma</span>
          <SegmentedControl
            label="Plataforma"
            value={platform}
            options={PLATFORM_OPTIONS}
            onChange={setPlatform}
            className="self-start"
          />
        </div>
        <Field label="Usuário" htmlFor={usernameId} hint="Sem espaços. Ex.: yeaxx ou techfix.rs">
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-sm text-ink-3">
              @
            </span>
            <Input
              id={usernameId}
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full pl-6"
              autoComplete="off"
              spellCheck={false}
              required
            />
          </div>
        </Field>
        <Field label="Nome de exibição" htmlFor={displayNameId} hint="Opcional. Ex.: YEAXX Cars">
          <Input
            id={displayNameId}
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            autoComplete="off"
          />
        </Field>
        <Notice>
          O login oficial (OAuth) ainda não foi implementado. Nenhum dado é enviado à plataforma.
        </Notice>
        {error && <Notice tone="danger">{error}</Notice>}
      </form>
    </Modal>
  );
}
