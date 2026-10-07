import type { NewMedia } from '@/db/repositories';
import type { Channel } from '@/types';

const BASE_DATE = '2026-10-01T12:00:00.000Z';

export function buildChannel(overrides: Partial<Channel> = {}): Channel {
  return {
    id: 'channel-1',
    platform: 'tiktok',
    username: 'yeaxx',
    displayName: 'YEAXX Cars',
    avatarUrl: null,
    status: 'connected',
    lastSyncedAt: null,
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
    ...overrides,
  };
}

export function buildMedia(overrides: Partial<NewMedia> = {}): NewMedia {
  return {
    id: 'media-1',
    filename: 'civic.mp4',
    originalFilename: 'civic.mp4',
    filePath: 'C:\\Videos\\civic.mp4',
    type: 'video',
    mimeType: 'video/mp4',
    size: 1024,
    duration: 42,
    width: 1080,
    height: 1920,
    thumbnailPath: null,
    status: 'ready',
    createdAt: BASE_DATE,
    updatedAt: BASE_DATE,
    ...overrides,
  };
}
