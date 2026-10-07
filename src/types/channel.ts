import { z } from 'zod';

import type { Id, IsoDateString } from './common';

export const PLATFORMS = ['tiktok', 'instagram'] as const;
export const platformSchema = z.enum(PLATFORMS);
export type Platform = z.infer<typeof platformSchema>;

export const CHANNEL_STATUSES = ['connected', 'disconnected', 'expired', 'error'] as const;
export const channelStatusSchema = z.enum(CHANNEL_STATUSES);
export type ChannelStatus = z.infer<typeof channelStatusSchema>;

/** Conta de uma plataforma social gerenciada pelo app. */
export interface Channel {
  id: Id;
  platform: Platform;
  /** Usuário sem o `@` (ex.: `yeaxx`). */
  username: string;
  displayName: string;
  avatarUrl: string | null;
  status: ChannelStatus;
  lastSyncedAt: IsoDateString | null;
  createdAt: IsoDateString;
  updatedAt: IsoDateString;
}
