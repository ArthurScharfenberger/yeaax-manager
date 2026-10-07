-- Migration 0001 — schema inicial do Social Manager.
-- Documentação: docs/DATABASE.md
--
-- Convenções:
--   * ids são TEXT (UUID v4 gerado na aplicação);
--   * datas são TEXT em ISO 8601 UTC (ex.: 2026-10-07T22:30:00.000Z);
--   * enums (status, plataforma) são TEXT validados na aplicação (Zod), sem CHECK,
--     para permitir novos valores sem recriar tabelas (ver DEC-007);
--   * nunca altere uma migration já distribuída: crie uma nova (0002_..., 0003_...).

CREATE TABLE channels (
  id TEXT PRIMARY KEY NOT NULL,
  platform TEXT NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected',
  last_synced_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (platform, username)
);

CREATE TABLE media (
  id TEXT PRIMARY KEY NOT NULL,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_path TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL DEFAULT 0,
  duration REAL,
  width INTEGER,
  height INTEGER,
  thumbnail_path TEXT,
  status TEXT NOT NULL DEFAULT 'imported',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_media_status ON media (status);
CREATE INDEX idx_media_created_at ON media (created_at);

CREATE TABLE tags (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL UNIQUE COLLATE NOCASE,
  created_at TEXT NOT NULL
);

CREATE TABLE media_tags (
  media_id TEXT NOT NULL REFERENCES media (id) ON DELETE CASCADE,
  tag_id TEXT NOT NULL REFERENCES tags (id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  PRIMARY KEY (media_id, tag_id)
);

CREATE INDEX idx_media_tags_tag_id ON media_tags (tag_id);

CREATE TABLE posts (
  id TEXT PRIMARY KEY NOT NULL,
  channel_id TEXT NOT NULL REFERENCES channels (id) ON DELETE RESTRICT,
  media_id TEXT REFERENCES media (id) ON DELETE SET NULL,
  caption TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_at TEXT,
  published_at TEXT,
  external_post_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_posts_channel_id ON posts (channel_id);
CREATE INDEX idx_posts_media_id ON posts (media_id);
CREATE INDEX idx_posts_status ON posts (status);
CREATE INDEX idx_posts_scheduled_at ON posts (scheduled_at);

CREATE TABLE post_history (
  id TEXT PRIMARY KEY NOT NULL,
  post_id TEXT NOT NULL REFERENCES posts (id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  from_status TEXT,
  to_status TEXT,
  message TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_post_history_post_id ON post_history (post_id, created_at);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
