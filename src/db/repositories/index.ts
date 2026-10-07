import type { DbClient } from '../client';
import { createChannelRepository } from './channelRepository';
import { createMediaRepository } from './mediaRepository';
import { createPostHistoryRepository } from './postHistoryRepository';
import { createPostRepository } from './postRepository';
import { createSettingsRepository } from './settingsRepository';
import { createTagRepository } from './tagRepository';

export function createRepositories(db: DbClient) {
  const tags = createTagRepository(db);
  return {
    channels: createChannelRepository(db),
    tags,
    media: createMediaRepository(db, tags),
    posts: createPostRepository(db),
    postHistory: createPostHistoryRepository(db),
    settings: createSettingsRepository(db),
  };
}

export type Repositories = ReturnType<typeof createRepositories>;

export type { ChannelPatch, ChannelRepository } from './channelRepository';
export type { MediaFilters, MediaPatch, MediaRepository, NewMedia } from './mediaRepository';
export type { PostHistoryRepository } from './postHistoryRepository';
export type { PostFilters, PostPatch, PostRepository } from './postRepository';
export type { SettingsRepository } from './settingsRepository';
export type { TagRepository } from './tagRepository';
