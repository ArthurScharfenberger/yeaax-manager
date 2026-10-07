import { type DbClient } from '@/db/client';
import { createDemoDataService } from '@/db/demoData';
import { createRepositories } from '@/db/repositories';
import { createChannelService } from '@/features/channels/channelService';
import { createDashboardService } from '@/features/dashboard/dashboardService';
import { createMediaService } from '@/features/media/mediaService';
import { createPostService } from '@/features/posts/postService';
import { createSearchService } from '@/features/search/searchService';
import { createSettingsService } from '@/features/settings/settingsService';
import { type Clock, systemClock } from '@/lib/clock';
import type { RuntimeMode } from '@/lib/runtime';
import { createAIProvider } from '@/services/ai';
import type { DesktopBridge } from '@/services/desktop/DesktopBridge';
import { probeVideoMetadata } from '@/services/media/videoMetadata';
import { createVideoProcessor } from '@/services/media/VideoProcessor';
import { createSocialProviders } from '@/services/social';

/**
 * Composition root: o único lugar que conhece todas as implementações concretas.
 * Componentes acessam os serviços via `useServices()`.
 */
export function createAppServices(options: {
  db: DbClient;
  desktop: DesktopBridge;
  mode: RuntimeMode;
  clock?: Clock;
}) {
  const { db, desktop, mode } = options;
  const clock = options.clock ?? systemClock;
  const repositories = createRepositories(db);
  const social = createSocialProviders();

  async function probeMetadata(path: string) {
    const url = desktop.toAssetUrl(path);
    return url ? probeVideoMetadata(url) : null;
  }

  return {
    mode,
    clock,
    desktop,
    social,
    ai: createAIProvider(),
    videoProcessor: createVideoProcessor(desktop),
    channels: createChannelService({ repositories, social, clock }),
    media: createMediaService({ repositories, desktop, probeMetadata, clock }),
    posts: createPostService({ repositories, clock }),
    settings: createSettingsService({ repositories, clock }),
    dashboard: createDashboardService({ repositories }),
    search: createSearchService({ repositories }),
    demo: createDemoDataService({ db, repositories, clock }),
  };
}

export type AppServices = ReturnType<typeof createAppServices>;
