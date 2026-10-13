import { type SubmitEvent, useId, useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { Notice } from '@/components/ui/Notice';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useToast } from '@/components/ui/toastContext';
import { getErrorMessage, isAppError } from '@/lib/errors';
import { PLATFORM_INFO } from '@/lib/platforms';
import { type Channel, type Platform, PLATFORMS } from '@/types';
import { formatHandle } from '@/utils/format';

import {
  useCancelConnect,
  useConnectAccount,
  useConnectNewChannel,
  useHasOfficialLogin,
} from '../hooks';

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
  const official = useHasOfficialLogin(platform);
  const connectSimulated = useConnectNewChannel();
  const connectAccount = useConnectAccount();
  const cancelConnect = useCancelConnect();
  const toast = useToast();
  const pending = connectSimulated.isPending || connectAccount.isPending;
  const label = PLATFORM_INFO[platform].label;

  function done(channel: Channel, title: string) {
    toast.success(
      title,
      `${formatHandle(channel.username)} · ${PLATFORM_INFO[channel.platform].label}`,
    );
    onClose();
  }

  function handleError(caught: unknown) {
    // Cancelar o login é escolha do usuário, não erro.
    if (isAppError(caught) && caught.code === 'TIKTOK_LOGIN_CANCELLED') return;
    setError(getErrorMessage(caught));
  }

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    setError(null);
    if (official) {
      connectAccount.mutate(platform, {
        onSuccess: ({ channel, created }) =>
          done(channel, created ? 'Canal conectado' : 'Canal reconectado'),
        onError: handleError,
      });
      return;
    }
    connectSimulated.mutate(
      { platform, username, displayName },
      { onSuccess: (channel) => done(channel, 'Canal conectado'), onError: handleError },
    );
  }

  function handleClose() {
    // Fechar no meio do login encerra a espera (a porta local do app é fechada).
    if (connectAccount.isPending) void cancelConnect(platform);
    onClose();
  }

  return (
    <Modal
      title="Adicionar canal"
      description="Conecte uma conta do TikTok ou do Instagram."
      size="sm"
      onClose={handleClose}
      footer={
        <>
          <Button onClick={handleClose}>
            {connectAccount.isPending ? 'Cancelar login' : 'Cancelar'}
          </Button>
          <Button type="submit" form={formId} variant="primary" loading={pending}>
            {official ? `Conectar ${label}` : 'Conectar (simulado)'}
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
            onChange={(value) => {
              setPlatform(value);
              setError(null);
            }}
            className="self-start"
          />
        </div>

        {official ? (
          <OfficialLoginNotice label={label} waiting={connectAccount.isPending} />
        ) : (
          <>
            <Field
              label="Usuário"
              htmlFor={usernameId}
              hint="Sem espaços. Ex.: yeaxx ou techfix.rs"
            >
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
            <Field
              label="Nome de exibição"
              htmlFor={displayNameId}
              hint="Opcional. Ex.: YEAXX Cars"
            >
              <Input
                id={displayNameId}
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                autoComplete="off"
              />
            </Field>
            <Notice>
              O login oficial do {label} ainda não foi implementado. Nenhum dado é enviado à
              plataforma.
            </Notice>
          </>
        )}
        {error && <Notice tone="danger">{error}</Notice>}
      </form>
    </Modal>
  );
}

function OfficialLoginNotice({ label, waiting }: { label: string; waiting: boolean }) {
  if (waiting) {
    return (
      <div role="status">
        <Notice title="Aguardando autorização">
          Autorize o acesso na página do {label} que abriu no navegador e volte para cá — esta
          janela atualiza sozinha. Se desistir, clique em “Cancelar login”.
        </Notice>
      </div>
    );
  }
  return (
    <Notice>
      O navegador vai abrir a página oficial do {label} para você entrar e autorizar. A conta é
      identificada automaticamente — não precisa digitar o @. As credenciais ficam só neste
      computador, no Gerenciador de Credenciais do Windows.
    </Notice>
  );
}
