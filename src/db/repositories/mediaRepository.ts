import {
  type Id,
  type IsoDateString,
  type Media,
  type MediaStatus,
  mediaStatusSchema,
  mediaTypeSchema,
} from '@/types';

import type { DbClient, SqlValue } from '../client';
import { buildSetClause, parseEnum, toLikePattern } from '../sql';
import type { TagRepository } from './tagRepository';

interface MediaRow {
  id: string;
  filename: string;
  original_filename: string;
  file_path: string;
  type: string;
  mime_type: string;
  size: number;
  duration: number | null;
  width: number | null;
  height: number | null;
  thumbnail_path: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface MediaFilters {
  search?: string;
  status?: MediaStatus;
  tagId?: Id;
  limit?: number;
}

export type NewMedia = Omit<Media, 'tags'>;

export interface MediaPatch {
  status?: MediaStatus;
  duration?: number | null;
  width?: number | null;
  height?: number | null;
  thumbnailPath?: string | null;
  updatedAt: IsoDateString;
}

const PATCH_COLUMNS: Record<keyof MediaPatch, string> = {
  status: 'status',
  duration: 'duration',
  width: 'width',
  height: 'height',
  thumbnailPath: 'thumbnail_path',
  updatedAt: 'updated_at',
};

const COLUMNS =
  'id, filename, original_filename, file_path, type, mime_type, size, duration, width, height, thumbnail_path, status, created_at, updated_at';

function toMedia(row: MediaRow): NewMedia {
  return {
    id: row.id,
    filename: row.filename,
    originalFilename: row.original_filename,
    filePath: row.file_path,
    type: parseEnum(mediaTypeSchema, row.type, 'media.type'),
    mimeType: row.mime_type,
    size: row.size,
    duration: row.duration,
    width: row.width,
    height: row.height,
    thumbnailPath: row.thumbnail_path,
    status: parseEnum(mediaStatusSchema, row.status, 'media.status'),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createMediaRepository(db: DbClient, tags: TagRepository) {
  async function withTags(rows: MediaRow[]): Promise<Media[]> {
    const tagsByMedia = await tags.listForMedia(rows.map((row) => row.id));
    return rows.map((row) => ({ ...toMedia(row), tags: tagsByMedia.get(row.id) ?? [] }));
  }

  return {
    async list(filters: MediaFilters = {}): Promise<Media[]> {
      const conditions: string[] = [];
      const params: SqlValue[] = [];

      const search = filters.search?.trim();
      if (search) {
        conditions.push("(filename LIKE ? ESCAPE '\\' OR original_filename LIKE ? ESCAPE '\\')");
        params.push(toLikePattern(search), toLikePattern(search));
      }
      if (filters.status) {
        conditions.push('status = ?');
        params.push(filters.status);
      }
      if (filters.tagId) {
        conditions.push(
          'EXISTS (SELECT 1 FROM media_tags mt WHERE mt.media_id = media.id AND mt.tag_id = ?)',
        );
        params.push(filters.tagId);
      }

      const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const limit = filters.limit ? 'LIMIT ?' : '';
      if (filters.limit) params.push(filters.limit);

      const rows = await db.select<MediaRow>(
        `SELECT ${COLUMNS} FROM media ${where} ORDER BY created_at DESC, filename ${limit}`,
        params,
      );
      return withTags(rows);
    },

    async getById(id: Id): Promise<Media | null> {
      const rows = await db.select<MediaRow>(`SELECT ${COLUMNS} FROM media WHERE id = ?`, [id]);
      const [media] = await withTags(rows);
      return media ?? null;
    },

    async findByPath(filePath: string): Promise<NewMedia | null> {
      const rows = await db.select<MediaRow>(
        `SELECT ${COLUMNS} FROM media WHERE file_path = ? COLLATE NOCASE`,
        [filePath],
      );
      const row = rows[0];
      return row ? toMedia(row) : null;
    },

    async insert(media: NewMedia): Promise<void> {
      await db.execute(
        `INSERT INTO media (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          media.id,
          media.filename,
          media.originalFilename,
          media.filePath,
          media.type,
          media.mimeType,
          media.size,
          media.duration,
          media.width,
          media.height,
          media.thumbnailPath,
          media.status,
          media.createdAt,
          media.updatedAt,
        ],
      );
    },

    async update(id: Id, patch: MediaPatch): Promise<void> {
      const { clause, params } = buildSetClause(patch, PATCH_COLUMNS);
      await db.execute(`UPDATE media SET ${clause} WHERE id = ?`, [...params, id]);
    },

    async delete(id: Id): Promise<void> {
      await db.execute('DELETE FROM media WHERE id = ?', [id]);
    },

    async count(): Promise<number> {
      const rows = await db.select<{ total: number }>('SELECT COUNT(*) AS total FROM media');
      return rows[0]?.total ?? 0;
    },
  };
}

export type MediaRepository = ReturnType<typeof createMediaRepository>;
