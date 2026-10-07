import {
  type Channel,
  type ChannelStatus,
  channelStatusSchema,
  type Id,
  type IsoDateString,
  type Platform,
  platformSchema,
} from '@/types';

import type { DbClient } from '../client';
import { buildSetClause, parseEnum } from '../sql';

interface ChannelRow {
  id: string;
  platform: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  status: string;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChannelPatch {
  displayName?: string;
  avatarUrl?: string | null;
  status?: ChannelStatus;
  lastSyncedAt?: IsoDateString | null;
  updatedAt: IsoDateString;
}

const PATCH_COLUMNS: Record<keyof ChannelPatch, string> = {
  displayName: 'display_name',
  avatarUrl: 'avatar_url',
  status: 'status',
  lastSyncedAt: 'last_synced_at',
  updatedAt: 'updated_at',
};

const COLUMNS =
  'id, platform, username, display_name, avatar_url, status, last_synced_at, created_at, updated_at';

function toChannel(row: ChannelRow): Channel {
  return {
    id: row.id,
    platform: parseEnum(platformSchema, row.platform, 'channels.platform'),
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    status: parseEnum(channelStatusSchema, row.status, 'channels.status'),
    lastSyncedAt: row.last_synced_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createChannelRepository(db: DbClient) {
  return {
    async list(): Promise<Channel[]> {
      const rows = await db.select<ChannelRow>(
        `SELECT ${COLUMNS} FROM channels ORDER BY display_name COLLATE NOCASE, username, platform`,
      );
      return rows.map(toChannel);
    },

    async getById(id: Id): Promise<Channel | null> {
      const rows = await db.select<ChannelRow>(`SELECT ${COLUMNS} FROM channels WHERE id = ?`, [
        id,
      ]);
      const row = rows[0];
      return row ? toChannel(row) : null;
    },

    async findByHandle(platform: Platform, username: string): Promise<Channel | null> {
      const rows = await db.select<ChannelRow>(
        `SELECT ${COLUMNS} FROM channels WHERE platform = ? AND username = ? COLLATE NOCASE`,
        [platform, username],
      );
      const row = rows[0];
      return row ? toChannel(row) : null;
    },

    async insert(channel: Channel): Promise<void> {
      await db.execute(`INSERT INTO channels (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        channel.id,
        channel.platform,
        channel.username,
        channel.displayName,
        channel.avatarUrl,
        channel.status,
        channel.lastSyncedAt,
        channel.createdAt,
        channel.updatedAt,
      ]);
    },

    async update(id: Id, patch: ChannelPatch): Promise<void> {
      const { clause, params } = buildSetClause(patch, PATCH_COLUMNS);
      await db.execute(`UPDATE channels SET ${clause} WHERE id = ?`, [...params, id]);
    },

    async delete(id: Id): Promise<void> {
      await db.execute('DELETE FROM channels WHERE id = ?', [id]);
    },

    async countByStatus(status: ChannelStatus): Promise<number> {
      const rows = await db.select<{ total: number }>(
        'SELECT COUNT(*) AS total FROM channels WHERE status = ?',
        [status],
      );
      return rows[0]?.total ?? 0;
    },
  };
}

export type ChannelRepository = ReturnType<typeof createChannelRepository>;
