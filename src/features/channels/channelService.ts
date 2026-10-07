import { z } from 'zod';

import type { Repositories } from '@/db/repositories';
import type { Clock } from '@/lib/clock';
import { AppError } from '@/lib/errors';
import { createId } from '@/lib/ids';
import { logger } from '@/lib/logger';
import { PLATFORM_INFO } from '@/lib/platforms';
import type { SocialAccountRef, SocialProviderRegistry } from '@/services/social';
import { type Channel, type Id, platformSchema } from '@/types';

export const newChannelSchema = z.object({
  platform: platformSchema,
  username: z
    .string()
    .trim()
    .transform((value) => value.replace(/^@/, ''))
    .pipe(
      z
        .string()
        .min(2, 'O usuário precisa ter ao menos 2 caracteres.')
        .max(30, 'O usuário pode ter no máximo 30 caracteres.')
        .regex(/^[a-zA-Z0-9._]+$/, 'Use apenas letras, números, ponto e sublinhado.'),
    ),
  displayName: z.string().trim().max(60, 'Nome muito longo.'),
});

export type NewChannelInput = z.input<typeof newChannelSchema>;

interface ChannelServiceDeps {
  repositories: Pick<Repositories, 'channels' | 'posts'>;
  social: SocialProviderRegistry;
  clock: Clock;
}

function toAccountRef(channel: Channel): SocialAccountRef {
  return { channelId: channel.id, platform: channel.platform, username: channel.username };
}

/** Casos de uso de canais. Toda comunicação com a plataforma passa pelo `SocialProvider`. */
export function createChannelService({ repositories, social, clock }: ChannelServiceDeps) {
  const { channels, posts } = repositories;

  async function requireChannel(id: Id): Promise<Channel> {
    const channel = await channels.getById(id);
    if (!channel) throw new AppError('NOT_FOUND', 'Canal não encontrado.');
    return channel;
  }

  return {
    list: () => channels.list(),

    /** Conecta uma conta nova (fluxo simulado enquanto o OAuth não existe). */
    async connectNew(input: NewChannelInput): Promise<Channel> {
      const data = newChannelSchema.parse(input);
      if (await channels.findByHandle(data.platform, data.username)) {
        throw new AppError(
          'CONFLICT',
          `@${data.username} já está cadastrado no ${PLATFORM_INFO[data.platform].label}.`,
        );
      }

      const { profile } = await social[data.platform].connect({
        usernameHint: data.username,
        displayNameHint: data.displayName || data.username,
      });

      const now = clock.now().toISOString();
      const channel: Channel = {
        id: createId(),
        platform: data.platform,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        status: 'connected',
        lastSyncedAt: now,
        createdAt: now,
        updatedAt: now,
      };
      await channels.insert(channel);
      logger.info('Canal conectado', { platform: channel.platform, username: channel.username });
      return channel;
    },

    async connect(id: Id): Promise<void> {
      const channel = await requireChannel(id);
      const { profile } = await social[channel.platform].connect({
        usernameHint: channel.username,
        displayNameHint: channel.displayName,
      });
      const now = clock.now().toISOString();
      await channels.update(id, {
        status: 'connected',
        displayName: profile.displayName,
        avatarUrl: profile.avatarUrl,
        lastSyncedAt: now,
        updatedAt: now,
      });
    },

    async disconnect(id: Id): Promise<void> {
      const channel = await requireChannel(id);
      await social[channel.platform].disconnect(toAccountRef(channel));
      await channels.update(id, { status: 'disconnected', updatedAt: clock.now().toISOString() });
    },

    /** Atualiza nome/avatar a partir da plataforma. */
    async sync(id: Id): Promise<void> {
      const channel = await requireChannel(id);
      if (channel.status !== 'connected') {
        throw new AppError('VALIDATION', 'Conecte o canal antes de sincronizar.');
      }
      const profile = await social[channel.platform].getProfile(toAccountRef(channel));
      const now = clock.now().toISOString();
      await channels.update(id, {
        displayName: profile.displayName || channel.displayName,
        avatarUrl: profile.avatarUrl,
        lastSyncedAt: now,
        updatedAt: now,
      });
    },

    async remove(id: Id): Promise<void> {
      const total = await posts.count({ channelId: id });
      if (total > 0) {
        throw new AppError(
          'CHANNEL_HAS_POSTS',
          `Este canal possui ${total} post(s). Exclua-os antes de remover o canal.`,
        );
      }
      await channels.delete(id);
    },
  };
}

export type ChannelService = ReturnType<typeof createChannelService>;
