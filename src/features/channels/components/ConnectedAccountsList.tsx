import { Users } from 'lucide-react';

import { PlatformMark } from '@/components/PlatformMark';
import { ChannelStatusBadge } from '@/components/StatusBadges';
import { Avatar } from '@/components/ui/Avatar';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingBlock } from '@/components/ui/Spinner';
import { formatHandle } from '@/utils/format';

import { useChannels } from '../hooks';

/** Lista compacta de contas (usada no Dashboard). */
export function ConnectedAccountsList() {
  const channels = useChannels();

  if (channels.isPending) return <LoadingBlock />;
  if (!channels.data || channels.data.length === 0) {
    return (
      <EmptyState
        compact
        icon={Users}
        title="Nenhum canal"
        description="Adicione um canal na página Canais."
      />
    );
  }

  return (
    <ul className="divide-y divide-line">
      {channels.data.map((channel) => (
        <li key={channel.id} className="flex items-center gap-3 px-4 py-2.5">
          <Avatar name={channel.displayName} src={channel.avatarUrl} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-ink">
              {formatHandle(channel.username)}
            </p>
            <PlatformMark
              platform={channel.platform}
              withLabel
              className="[&>span:last-child]:text-xs"
            />
          </div>
          <ChannelStatusBadge status={channel.status} />
        </li>
      ))}
    </ul>
  );
}
