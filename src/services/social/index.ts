import type { Platform } from '@/types';

import { InstagramProvider } from './InstagramProvider';
import type { SocialProvider } from './SocialProvider';
import { TikTokProvider } from './TikTokProvider';

/** Um provider por plataforma. É o único ponto que conhece as classes concretas. */
export type SocialProviderRegistry = Readonly<Record<Platform, SocialProvider>>;

export function createSocialProviders(): SocialProviderRegistry {
  return {
    tiktok: new TikTokProvider(),
    instagram: new InstagramProvider(),
  };
}

export type * from './SocialProvider';
export { MockSocialProvider } from './MockSocialProvider';
