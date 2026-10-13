import type { DesktopBridge } from '@/services/desktop/DesktopBridge';
import type { Platform } from '@/types';

import { InstagramProvider } from './InstagramProvider';
import { MockSocialProvider } from './MockSocialProvider';
import type { SocialProvider } from './SocialProvider';
import { TikTokProvider } from './TikTokProvider';

/** Um provider por plataforma. É o único ponto que conhece as classes concretas. */
export type SocialProviderRegistry = Readonly<Record<Platform, SocialProvider>>;

/** No app desktop o TikTok é real (DEC-027); no preview do navegador continua simulado. */
export function createSocialProviders(desktop: DesktopBridge): SocialProviderRegistry {
  return {
    tiktok:
      desktop.mode === 'desktop'
        ? new TikTokProvider(desktop)
        : new MockSocialProvider({ platform: 'tiktok' }),
    instagram: new InstagramProvider(),
  };
}

export type * from './SocialProvider';
export { MockSocialProvider } from './MockSocialProvider';
