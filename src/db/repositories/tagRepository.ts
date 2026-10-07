import type { Id, IsoDateString, Tag, TagWithUsage } from '@/types';

import type { DbClient } from '../client';
import { placeholders } from '../sql';

interface TagRow {
  id: string;
  name: string;
  created_at: string;
}

interface TagUsageRow extends TagRow {
  usage_count: number;
}

interface MediaTagRow extends TagRow {
  media_id: string;
}

function toTag(row: TagRow): Tag {
  return { id: row.id, name: row.name, createdAt: row.created_at };
}

export function createTagRepository(db: DbClient) {
  return {
    async listWithUsage(): Promise<TagWithUsage[]> {
      const rows = await db.select<TagUsageRow>(
        `SELECT t.id, t.name, t.created_at, COUNT(mt.media_id) AS usage_count
           FROM tags t
           LEFT JOIN media_tags mt ON mt.tag_id = t.id
          GROUP BY t.id
          ORDER BY t.name COLLATE NOCASE`,
      );
      return rows.map((row) => ({ ...toTag(row), usageCount: row.usage_count }));
    },

    async findByName(name: string): Promise<Tag | null> {
      const rows = await db.select<TagRow>(
        'SELECT id, name, created_at FROM tags WHERE name = ? COLLATE NOCASE',
        [name],
      );
      const row = rows[0];
      return row ? toTag(row) : null;
    },

    async insert(tag: Tag): Promise<void> {
      await db.execute('INSERT INTO tags (id, name, created_at) VALUES (?, ?, ?)', [
        tag.id,
        tag.name,
        tag.createdAt,
      ]);
    },

    async attach(mediaId: Id, tagId: Id, createdAt: IsoDateString): Promise<void> {
      await db.execute(
        'INSERT OR IGNORE INTO media_tags (media_id, tag_id, created_at) VALUES (?, ?, ?)',
        [mediaId, tagId, createdAt],
      );
    },

    async detach(mediaId: Id, tagId: Id): Promise<void> {
      await db.execute('DELETE FROM media_tags WHERE media_id = ? AND tag_id = ?', [
        mediaId,
        tagId,
      ]);
    },

    /** Tags agrupadas por mídia, para montar `Media.tags` sem N consultas. */
    async listForMedia(mediaIds: readonly Id[]): Promise<Map<Id, Tag[]>> {
      const result = new Map<Id, Tag[]>();
      if (mediaIds.length === 0) return result;

      const rows = await db.select<MediaTagRow>(
        `SELECT mt.media_id, t.id, t.name, t.created_at
           FROM media_tags mt
           JOIN tags t ON t.id = mt.tag_id
          WHERE mt.media_id IN (${placeholders(mediaIds.length)})
          ORDER BY t.name COLLATE NOCASE`,
        mediaIds,
      );

      for (const row of rows) {
        const tags = result.get(row.media_id) ?? [];
        tags.push(toTag(row));
        result.set(row.media_id, tags);
      }
      return result;
    },
  };
}

export type TagRepository = ReturnType<typeof createTagRepository>;
