import type { Repositories } from '@/db/repositories';
import type { Clock } from '@/lib/clock';
import { AppError, isSessionLostError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import type { SocialAccountRef, SocialProviderRegistry } from '@/services/social';
import type { Channel, Id } from '@/types';

import { createChannelConnector } from './channelConnector';
import { isSameAccount, profilePatch } from './channelRules';

export { type NewChannelInput, newChannelSchema } from './channelConnector';

interface ChannelServiceDeps {
  repositories: Pick<Repositories, 'channels' | 'posts'>;
  social: SocialProviderRegistry;
  clock: Clock;
}

/** Resultado da verificação das contas ao abrir o app. */
export interface ConnectionCheckResult {
  checked: number;
  expired: number;
  /** Falhas que não indicam credencial inválida (ex.: sem internet): o status não muda. */
  skipped: number;
}

function toAccountRef(channel: Channel): SocialAccountRef {
  return { channelId: channel.id, platform: channel.platform, username: channel.username };
}

/** Casos de uso de canais. Toda comunicação com a plataforma passa pelo `SocialProvider`. */
export function createChannelService({ repositories, social, clock }: ChannelServiceDeps) {
  const { channels, posts } = repositories;
  const connector = createChannelConnector({ repositories, social, clock });

  async function requireChannel(id: Id): Promise<Channel> {
    const channel = await channels.getById(id);
    if (!channel) throw new AppError('NOT_FOUND', 'Canal não encontrado.');
    return channel;
  }

  /**
   * Atualiza o canal com o perfil da plataforma (renovando a credencial no Rust, se preciso). Se a credencial
   * deixou de valer, marca o canal como "Sessão expirada" e relança o erro.
   */
  async function refreshProfile(channel: Channel): Promise<void> {
    try {
      const profile = await social[channel.platform].getProfile(toAccountRef(channel));
      if (!isSameAccount(channel, profile)) {
        throw new AppError('CONFLICT', 'A credencial guardada é de outra conta. Conecte de novo.');
      }
      const now = clock.now().toISOString();
      await channels.update(channel.id, {
        ...profilePatch(channel, profile),
        lastSyncedAt: now,
        updatedAt: now,
      });
    } catch (error) {
      if (isSessionLostError(error)) {
        await channels.update(channel.id, {
          status: 'expired',
          updatedAt: clock.now().toISOString(),
        });
      }
      throw error;
    }
  }

  return {
    list: () => channels.list(),
    // connectNew, connectAccount, connect, cancelConnect (ver channelConnector.ts).
    ...connector,

    async disconnect(id: Id): Promise<void> {
      const channel = await requireChannel(id);
      await social[channel.platform].disconnect(toAccountRef(channel));
      await channels.update(id, { status: 'disconnected', updatedAt: clock.now().toISOString() });
    },

    /** Atualiza nome, @ e avatar a partir da plataforma. */
    async sync(id: Id): Promise<void> {
      const channel = await requireChannel(id);
      if (channel.status !== 'connected') {
        throw new AppError('VALIDATION', 'Conecte o canal antes de sincronizar.');
      }
      await refreshProfile(channel);
    },

    /**
     * Ao abrir o app: confere cada conta conectada por login oficial (renova o token, atualiza o perfil). Credencial
     * inválida → "Sessão expirada"; falha de rede → nada muda (o app funciona offline).
     */
    async verifyConnections(): Promise<ConnectionCheckResult> {
      const result: ConnectionCheckResult = { checked: 0, expired: 0, skipped: 0 };
      const connected = (await channels.list()).filter(
        (channel) =>
          channel.status === 'connected' && social[channel.platform].capabilities.officialLogin,
      );
      for (const channel of connected) {
        result.checked += 1;
        try {
          await refreshProfile(channel);
        } catch (error) {
          if (isSessionLostError(error)) {
            result.expired += 1;
            logger.warn('Sessão expirada', { platform: channel.platform, channel: channel.id });
          } else {
            result.skipped += 1;
            logger.warn('Não foi possível verificar a conta', { channel: channel.id, error });
          }
        }
      }
      return result;
    },

    /** Remove o canal. Com login oficial, apaga (e tenta revogar) a credencial guardada antes. */
    async remove(id: Id): Promise<void> {
      const channel = await requireChannel(id);
      const total = await posts.count({ channelId: id });
      if (total > 0) {
        throw new AppError(
          'CHANNEL_HAS_POSTS',
          `Este canal possui ${total} post(s). Exclua-os antes de remover o canal.`,
        );
      }
      if (social[channel.platform].capabilities.officialLogin) {
        // Sem isso a credencial ficaria órfã no cofre do Windows.
        await social[channel.platform].disconnect(toAccountRef(channel));
      }
      await channels.delete(id);
    },
  };
}

export type ChannelService = ReturnType<typeof createChannelService>;
