import { Plus, RefreshCw, Trash2, Users } from 'lucide-react';
import { useState } from 'react';

import { PlatformMark } from '@/components/PlatformMark';
import { ChannelStatusBadge } from '@/components/StatusBadges';
import { ActionMenu } from '@/components/ui/ActionMenu';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { LoadingBlock } from '@/components/ui/Spinner';
import { Table, Td, Th, THead, Tr } from '@/components/ui/Table';
import { useToast } from '@/components/ui/toastContext';
import { useNow } from '@/hooks/useNow';
import { getErrorMessage } from '@/lib/errors';
import { PLATFORM_INFO } from '@/lib/platforms';
import { type Channel, type Platform, PLATFORMS } from '@/types';
import { formatHandle, formatRelativeTime } from '@/utils/format';

import { AddChannelDialog } from './components/AddChannelDialog';
import { useChannelAction, useChannels } from './hooks';

type PlatformFilter = 'all' | Platform;

const FILTER_OPTIONS = [
  { value: 'all' as const, label: 'Todos' },
  ...PLATFORMS.map((platform) => ({ value: platform, label: PLATFORM_INFO[platform].label })),
];

export function ChannelsPage() {
  const channels = useChannels();
  const action = useChannelAction();
  const toast = useToast();
  const now = useNow();
  const [filter, setFilter] = useState<PlatformFilter>('all');
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Channel | null>(null);

  const visible = (channels.data ?? []).filter(
    (channel) => filter === 'all' || channel.platform === filter,
  );

  function run(channel: Channel, kind: 'connect' | 'disconnect' | 'sync') {
    const messages = {
      connect: 'Canal conectado',
      disconnect: 'Canal desconectado',
      sync: 'Perfil sincronizado',
    };
    action.mutate(
      { id: channel.id, action: kind },
      {
        onSuccess: () => toast.success(messages[kind], formatHandle(channel.username)),
        onError: (error) => toast.error(error),
      },
    );
  }

  const isBusy = (channel: Channel) => action.isPending && action.variables.id === channel.id;

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Canais"
        description="Contas do TikTok e do Instagram gerenciadas pelo app."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>
            Adicionar canal
          </Button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-4 p-6">
          <Notice title="Conexões simuladas">
            Conectar e desconectar usam providers mock. O login oficial (OAuth) de cada plataforma
            será implementado na fase de integrações — ver docs/INTEGRATIONS.md.
          </Notice>

          <div className="flex items-center justify-between">
            <SegmentedControl
              label="Filtrar por plataforma"
              value={filter}
              options={FILTER_OPTIONS}
              onChange={setFilter}
            />
            <span className="text-xs text-ink-3 tabular">{visible.length} canal(is)</span>
          </div>

          <div className="overflow-hidden rounded-md border border-line">
            {channels.isPending && <LoadingBlock />}
            {channels.isError && (
              <Notice tone="danger" className="m-4">
                {getErrorMessage(channels.error)}
              </Notice>
            )}
            {channels.isSuccess && visible.length === 0 && (
              <EmptyState
                icon={Users}
                title="Nenhum canal encontrado"
                description="Adicione uma conta para organizar e agendar posts."
                action={
                  <Button size="sm" variant="primary" icon={Plus} onClick={() => setAdding(true)}>
                    Adicionar canal
                  </Button>
                }
              />
            )}
            {visible.length > 0 && (
              <Table>
                <THead>
                  <tr>
                    <Th>Canal</Th>
                    <Th>Plataforma</Th>
                    <Th>Status</Th>
                    <Th>Última sincronização</Th>
                    <Th className="w-40 text-right">
                      <span className="sr-only">Ações</span>
                    </Th>
                  </tr>
                </THead>
                <tbody>
                  {visible.map((channel) => (
                    <Tr key={channel.id}>
                      <Td>
                        <div className="flex items-center gap-3">
                          <Avatar name={channel.displayName} src={channel.avatarUrl} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-ink">{channel.displayName}</p>
                            <p className="truncate text-xs text-ink-3">
                              {formatHandle(channel.username)}
                            </p>
                          </div>
                        </div>
                      </Td>
                      <Td>
                        <PlatformMark platform={channel.platform} withLabel />
                      </Td>
                      <Td>
                        <ChannelStatusBadge status={channel.status} />
                      </Td>
                      <Td className="text-ink-2">
                        {channel.lastSyncedAt ? (
                          <time dateTime={channel.lastSyncedAt}>
                            {formatRelativeTime(new Date(channel.lastSyncedAt), now)}
                          </time>
                        ) : (
                          <span className="text-ink-4">Nunca</span>
                        )}
                      </Td>
                      <Td>
                        <div className="flex items-center justify-end gap-1">
                          {channel.status === 'connected' ? (
                            <Button
                              size="sm"
                              loading={isBusy(channel)}
                              onClick={() => run(channel, 'disconnect')}
                            >
                              Desconectar
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="primary"
                              loading={isBusy(channel)}
                              onClick={() => run(channel, 'connect')}
                            >
                              Conectar
                            </Button>
                          )}
                          <ActionMenu
                            label={`Ações de ${formatHandle(channel.username)}`}
                            items={[
                              {
                                label: 'Sincronizar perfil',
                                icon: RefreshCw,
                                onSelect: () => run(channel, 'sync'),
                                disabled: channel.status !== 'connected',
                              },
                              'separator',
                              {
                                label: 'Remover canal',
                                icon: Trash2,
                                tone: 'danger',
                                onSelect: () => setRemoving(channel),
                              },
                            ]}
                          />
                        </div>
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
            )}
          </div>
        </div>
      </div>

      {adding && <AddChannelDialog onClose={() => setAdding(false)} />}
      {removing && (
        <ConfirmDialog
          title={`Remover ${formatHandle(removing.username)}?`}
          description="O canal será removido do app. Canais com posts não podem ser removidos — exclua os posts antes."
          confirmLabel="Remover canal"
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            await action.mutateAsync({ id: removing.id, action: 'remove' });
            toast.success('Canal removido');
          }}
        />
      )}
    </div>
  );
}
