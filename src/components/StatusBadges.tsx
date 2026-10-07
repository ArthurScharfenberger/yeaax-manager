import { CHANNEL_STATUS_LABELS, MEDIA_STATUS_LABELS, POST_STATUS_LABELS } from '@/lib/labels';
import type { ChannelStatus, MediaStatus, PostStatus } from '@/types';

import { Badge, type BadgeTone } from './ui/Badge';

const POST_TONES: Record<PostStatus, BadgeTone> = {
  draft: 'neutral',
  review: 'warning',
  scheduled: 'info',
  publishing: 'info',
  published: 'success',
  failed: 'danger',
  cancelled: 'neutral',
};

const CHANNEL_TONES: Record<ChannelStatus, BadgeTone> = {
  connected: 'success',
  disconnected: 'neutral',
  expired: 'warning',
  error: 'danger',
};

const MEDIA_TONES: Record<MediaStatus, BadgeTone> = {
  imported: 'neutral',
  processing: 'info',
  ready: 'success',
  used: 'neutral',
  error: 'danger',
};

export function PostStatusBadge({
  status,
  overdue = false,
}: {
  status: PostStatus;
  overdue?: boolean;
}) {
  if (overdue) {
    return (
      <Badge tone="warning" dot>
        Atrasado
      </Badge>
    );
  }
  return (
    <Badge tone={POST_TONES[status]} dot>
      {POST_STATUS_LABELS[status]}
    </Badge>
  );
}

export function ChannelStatusBadge({ status }: { status: ChannelStatus }) {
  return (
    <Badge tone={CHANNEL_TONES[status]} dot>
      {CHANNEL_STATUS_LABELS[status]}
    </Badge>
  );
}

export function MediaStatusBadge({ status }: { status: MediaStatus }) {
  return <Badge tone={MEDIA_TONES[status]}>{MEDIA_STATUS_LABELS[status]}</Badge>;
}
