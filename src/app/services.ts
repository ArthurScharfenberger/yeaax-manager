import { type DbClient } from '@/db/client';
import { createDemoDataService } from '@/db/demoData';
import { createRepositories } from '@/db/repositories';
import { AI_MODEL_SETTING } from '@/features/ai/aiSettings';
import { createPostPlanner } from '@/features/ai/postPlanner';
import { createChannelService } from '@/features/channels/channelService';
import { createDashboardService } from '@/features/dashboard/dashboardService';
import { createMediaService } from '@/features/media/mediaService';
import { createPostService } from '@/features/posts/postService';
import { createPublishService } from '@/features/publishing/publishService';
import { createSearchService } from '@/features/search/searchService';
import { createSettingsService } from '@/features/settings/settingsService';
import { type Clock, systemClock } from '@/lib/clock';
import type { RuntimeMode } from '@/lib/runtime';
import { createAIService } from '@/services/ai';
import type { DesktopBridge } from '@/services/desktop/DesktopBridge';
import { loadImageAsDataUrl } from '@/services/media/imageData';
import { analyzeVideo } from '@/services/media/videoAnalysis';
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
  const social = createSocialProviders(desktop);

  // Adapta a análise do WebView2 (Blob) ao contrato do serviço (bytes).
  async function analyzeLocalVideo(path: string) {
    const url = desktop.toAssetUrl(path);
    const analysis = url ? await analyzeVideo(url) : null;
    if (!analysis) return null;
    const { thumbnail, ...metadata } = analysis;
    return {
      ...metadata,
      thumbnail: thumbnail ? new Uint8Array(await thumbnail.arrayBuffer()) : null,
    };
  }

  const settings = createSettingsService({ repositories, clock });
  const posts = createPostService({ repositories, clock });
  const ai = createAIService({ desktop, getModel: () => settings.get(AI_MODEL_SETTING) });

  return {
    mode,
    clock,
    desktop,
    social,
    ai,
    postPlanner: createPostPlanner({
      ai,
      repositories,
      settings,
      posts,
      desktop,
      loadImage: loadImageAsDataUrl,
      clock,
    }),
    videoProcessor: createVideoProcessor(desktop),
    channels: createChannelService({ repositories, social, clock }),
    media: createMediaService({ repositories, desktop, analyzeVideo: analyzeLocalVideo, clock }),
    posts,
    publishing: createPublishService({ repositories, social, clock }),
    settings,
    dashboard: createDashboardService({ repositories }),
    search: createSearchService({ repositories }),
    demo: createDemoDataService({ db, repositories, clock }),
  };
}

export type AppServices = ReturnType<typeof createAppServices>;
