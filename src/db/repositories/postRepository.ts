import {
  channelStatusSchema,
  type Id,
  type IsoDateString,
  platformSchema,
  type Post,
  type PostStatus,
  postStatusSchema,
  type PostWithRelations,
} from '@/types';

import type { DbClient, SqlValue } from '../client';
import { buildSetClause, parseEnum, placeholders, toLikePattern } from '../sql';

interface PostRow {
  id: string;
  channel_id: string;
  media_id: string | null;
  caption: string;
  status: string;
  scheduled_at: string | null;
  published_at: string | null;
  external_post_id: string | null;
  created_at: string;
  updated_at: string;
}

interface PostDetailedRow extends PostRow {
  channel_platform: string;
  channel_username: string;
  channel_display_name: string;
  channel_status: string;
  media_filename: string | null;
  media_file_path: string | null;
  media_thumbnail_path: string | null;
  media_duration: number | null;
}

export interface PostFilters {
  statuses?: readonly PostStatus[];
  channelId?: Id;
  mediaId?: Id;
  /** Início inclusivo do intervalo de `scheduled_at` (ISO UTC). */
  scheduledFrom?: IsoDateString;
  /** Fim exclusivo do intervalo de `scheduled_at` (ISO UTC). */
  scheduledTo?: IsoDateString;
  search?: string;
  order?: 'scheduled_asc' | 'updated_desc';
  limit?: number;
}

export interface PostPatch {
  channelId?: Id;
  mediaId?: Id | null;
  caption?: string;
  status?: PostStatus;
  scheduledAt?: IsoDateString | null;
  publishedAt?: IsoDateString | null;
  externalPostId?: string | null;
  updatedAt: IsoDateString;
}

const PATCH_COLUMNS: Record<keyof PostPatch, string> = {
  channelId: 'channel_id',
  mediaId: 'media_id',
  caption: 'caption',
  status: 'status',
  scheduledAt: 'scheduled_at',
  publishedAt: 'published_at',
  externalPostId: 'external_post_id',
  updatedAt: 'updated_at',
};

const COLUMNS =
  'id, channel_id, media_id, caption, status, scheduled_at, published_at, external_post_id, created_at, updated_at';

const DETAILED_SELECT = `
  SELECT p.id, p.channel_id, p.media_id, p.caption, p.status, p.scheduled_at, p.published_at,
         p.external_post_id, p.created_at, p.updated_at,
         c.platform AS channel_platform, c.username AS channel_username,
         c.display_name AS channel_display_name, c.status AS channel_status,
         m.filename AS media_filename, m.file_path AS media_file_path,
         m.thumbnail_path AS media_thumbnail_path, m.duration AS media_duration
    FROM posts p
    JOIN channels c ON c.id = p.channel_id
    LEFT JOIN media m ON m.id = p.media_id`;

const ORDER_BY: Record<NonNullable<PostFilters['order']>, string> = {
  // Posts sem data vão para o fim.
  scheduled_asc: 'p.scheduled_at IS NULL, p.scheduled_at ASC, p.created_at ASC',
  updated_desc: 'p.updated_at DESC',
};

function toPost(row: PostRow): Post {
  return {
    id: row.id,
    channelId: row.channel_id,
    mediaId: row.media_id,
    caption: row.caption,
    status: parseEnum(postStatusSchema, row.status, 'posts.status'),
    scheduledAt: row.scheduled_at,
    publishedAt: row.published_at,
    externalPostId: row.external_post_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toPostWithRelations(row: PostDetailedRow): PostWithRelations {
  return {
    ...toPost(row),
    channel: {
      id: row.channel_id,
      platform: parseEnum(platformSchema, row.channel_platform, 'channels.platform'),
      username: row.channel_username,
      displayName: row.channel_display_name,
      status: parseEnum(channelStatusSchema, row.channel_status, 'channels.status'),
    },
    media:
      row.media_id && row.media_filename !== null && row.media_file_path !== null
        ? {
            id: row.media_id,
            filename: row.media_filename,
            filePath: row.media_file_path,
            thumbnailPath: row.media_thumbnail_path,
            duration: row.media_duration,
          }
        : null,
  };
}

function buildWhere(filters: PostFilters): { where: string; params: SqlValue[] } {
  const conditions: string[] = [];
  const params: SqlValue[] = [];

  if (filters.statuses && filters.statuses.length > 0) {
    conditions.push(`p.status IN (${placeholders(filters.statuses.length)})`);
    params.push(...filters.statuses);
  }
  if (filters.channelId) {
    conditions.push('p.channel_id = ?');
    params.push(filters.channelId);
  }
  if (filters.mediaId) {
    conditions.push('p.media_id = ?');
    params.push(filters.mediaId);
  }
  if (filters.scheduledFrom) {
    conditions.push('p.scheduled_at >= ?');
    params.push(filters.scheduledFrom);
  }
  if (filters.scheduledTo) {
    conditions.push('p.scheduled_at < ?');
    params.push(filters.scheduledTo);
  }
  const search = filters.search?.trim();
  if (search) {
    conditions.push(
      "(p.caption LIKE ? ESCAPE '\\' OR c.username LIKE ? ESCAPE '\\' OR c.display_name LIKE ? ESCAPE '\\')",
    );
    const pattern = toLikePattern(search);
    params.push(pattern, pattern, pattern);
  }

  return { where: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '', params };
}

export function createPostRepository(db: DbClient) {
  return {
    async listDetailed(filters: PostFilters = {}): Promise<PostWithRelations[]> {
      const { where, params } = buildWhere(filters);
      const limit = filters.limit ? 'LIMIT ?' : '';
      if (filters.limit) params.push(filters.limit);

      const rows = await db.select<PostDetailedRow>(
        `${DETAILED_SELECT} ${where} ORDER BY ${ORDER_BY[filters.order ?? 'scheduled_asc']} ${limit}`,
        params,
      );
      return rows.map(toPostWithRelations);
    },

    async getDetailed(id: Id): Promise<PostWithRelations | null> {
      const rows = await db.select<PostDetailedRow>(`${DETAILED_SELECT} WHERE p.id = ?`, [id]);
      const row = rows[0];
      return row ? toPostWithRelations(row) : null;
    },

    async getById(id: Id): Promise<Post | null> {
      const rows = await db.select<PostRow>(`SELECT ${COLUMNS} FROM posts WHERE id = ?`, [id]);
      const row = rows[0];
      return row ? toPost(row) : null;
    },

    async insert(post: Post): Promise<void> {
      await db.execute(`INSERT INTO posts (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
        post.id,
        post.channelId,
        post.mediaId,
        post.caption,
        post.status,
        post.scheduledAt,
        post.publishedAt,
        post.externalPostId,
        post.createdAt,
        post.updatedAt,
      ]);
    },

    async update(id: Id, patch: PostPatch): Promise<void> {
      const { clause, params } = buildSetClause(patch, PATCH_COLUMNS);
      await db.execute(`UPDATE posts SET ${clause} WHERE id = ?`, [...params, id]);
    },

    async delete(id: Id): Promise<void> {
      await db.execute('DELETE FROM posts WHERE id = ?', [id]);
    },

    async count(filters: { statuses?: readonly PostStatus[]; channelId?: Id; mediaId?: Id } = {}) {
      const { where, params } = buildWhere(filters);
      const rows = await db.select<{ total: number }>(
        `SELECT COUNT(*) AS total FROM posts p ${where}`,
        params,
      );
      return rows[0]?.total ?? 0;
    },

    /** Conta posts cuja data efetiva (publicação ou agendamento) cai em [from, to). */
    async countByEffectiveDate(options: {
      statuses: readonly PostStatus[];
      from: IsoDateString;
      to: IsoDateString;
    }): Promise<number> {
      const rows = await db.select<{ total: number }>(
        `SELECT COUNT(*) AS total FROM posts
          WHERE status IN (${placeholders(options.statuses.length)})
            AND COALESCE(published_at, scheduled_at) >= ?
            AND COALESCE(published_at, scheduled_at) < ?`,
        [...options.statuses, options.from, options.to],
      );
      return rows[0]?.total ?? 0;
    },

    /** Posts que já ocupam um canal com a mesma mídia (base da regra anti-duplicidade). */
    async findByChannelAndMedia(options: {
      channelId: Id;
      mediaId: Id;
      statuses: readonly PostStatus[];
      excludePostId?: Id;
    }): Promise<Post[]> {
      const rows = await db.select<PostRow>(
        `SELECT ${COLUMNS} FROM posts
          WHERE channel_id = ? AND media_id = ? AND id <> ?
            AND status IN (${placeholders(options.statuses.length)})`,
        [options.channelId, options.mediaId, options.excludePostId ?? '', ...options.statuses],
      );
      return rows.map(toPost);
    },
  };
}

export type PostRepository = ReturnType<typeof createPostRepository>;
