import { MockSocialProvider } from './MockSocialProvider';

/**
 * Integração com o TikTok.
 *
 * Status: MOCK — nenhuma chamada real é feita.
 * Implementação real planejada: Login Kit (OAuth) + Content Posting API, com tokens
 * guardados no lado Rust. Ao implementar, troque `extends MockSocialProvider` por
 * `implements SocialProvider` e atualize docs/INTEGRATIONS.md e docs/API_NOTES.md.
 */
export class TikTokProvider extends MockSocialProvider {
  constructor() {
    super({ platform: 'tiktok' });
  }
}
