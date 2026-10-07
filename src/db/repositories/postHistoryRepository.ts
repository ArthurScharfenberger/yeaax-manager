import { type Id, type PostHistoryEntry, postHistoryEventSchema, postStatusSchema } from '@/types';

import type { DbClient } from '../client';
import { parseEnum } from '../sql';

interface PostHistoryRow {
  id: string;
  post_id: string;
  event: string;
  from_status: string | null;
  to_status: string | null;
  message: string | null;
  created_at: string;
}

const COLUMNS = 'id, post_id, event, from_status, to_status, message, created_at';

function toEntry(row: PostHistoryRow): PostHistoryEntry {
  return {
    id: row.id,
    postId: row.post_id,
    event: parseEnum(postHistoryEventSchema, row.event, 'post_history.event'),
    fromStatus:
      row.from_status === null
        ? null
        : parseEnum(postStatusSchema, row.from_status, 'post_history.from_status'),
    toStatus:
      row.to_status === null
        ? null
        : parseEnum(postStatusSchema, row.to_status, 'post_history.to_status'),
    message: row.message,
    createdAt: row.created_at,
  };
}

export function createPostHistoryRepository(db: DbClient) {
  return {
    async insert(entry: PostHistoryEntry): Promise<void> {
      await db.execute(`INSERT INTO post_history (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?)`, [
        entry.id,
        entry.postId,
        entry.event,
        entry.fromStatus,
        entry.toStatus,
        entry.message,
        entry.createdAt,
      ]);
    },

    /** Histórico do mais recente para o mais antigo. */
    async listByPost(postId: Id): Promise<PostHistoryEntry[]> {
      const rows = await db.select<PostHistoryRow>(
        `SELECT ${COLUMNS} FROM post_history WHERE post_id = ? ORDER BY created_at DESC, rowid DESC`,
        [postId],
      );
      return rows.map(toEntry);
    },
  };
}

export type PostHistoryRepository = ReturnType<typeof createPostHistoryRepository>;
