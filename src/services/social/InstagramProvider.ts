import { MockSocialProvider } from './MockSocialProvider';

/**
 * Integração com o Instagram.
 *
 * Status: MOCK — nenhuma chamada real é feita.
 * Implementação real planejada: Instagram Graph API (contas profissionais), com OAuth
 * via Meta e tokens guardados no lado Rust. Ao implementar, troque
 * `extends MockSocialProvider` por `implements SocialProvider` e atualize
 * docs/INTEGRATIONS.md e docs/API_NOTES.md.
 */
export class InstagramProvider extends MockSocialProvider {
  constructor() {
    super({ platform: 'instagram' });
  }
}
