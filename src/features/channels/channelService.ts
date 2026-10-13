import { z } from 'zod';

import type { Repositories } from '@/db/repositories';
import type { Clock } from '@/lib/clock';
import { AppError } from '@/lib/errors';
import { createId } from '@/lib/ids';
import { logger } from '@/lib/logger';
import { PLATFORM_INFO } from '@/lib/platforms';
import type {
  ConnectionSession,
  SocialAccountRef,
  SocialProviderRegistry,
} from '@/services/social';
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

  async function ensureHandleAvailable(platform: Channel['platform'], username: string) {
    if (await channels.findByHandle(platform, username)) {
      throw new AppError(
        'CONFLICT',
        `@${username} já está cadastrado no ${PLATFORM_INFO[platform].label}.`,
      );
    }
  }

  /** Desfaz o banco (se algo foi gravado) e descarta a conexão pendente. Falhas aqui só vão para o log. */
  async function rollback(
    session: ConnectionSession | undefined,
    undoDatabase: (() => Promise<void>) | null,
  ) {
    try {
      if (undoDatabase) await undoDatabase();
    } catch (error) {
      logger.error('Falha ao desfazer o canal após erro na conexão', { error });
    }
    try {
      await session?.discard();
    } catch (error) {
      logger.warn('Falha ao descartar a conexão pendente', { error });
    }
  }

  return {
    list: () => channels.list(),

    /**
     * Conecta uma conta nova. Com o TikTok real (DEC-027) a conexão tem duas fases: o canal é gravado e só então
     * as credenciais vão para o cofre (`session.commit`); se qualquer passo falhar, o canal criado é removido e a
     * conexão pendente descartada — nada fica pela metade.
     */
    async connectNew(input: NewChannelInput): Promise<Channel> {
      const data = newChannelSchema.parse(input);
      await ensureHandleAvailable(data.platform, data.username);

      const { profile, session } = await social[data.platform].connect({
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
      let inserted = false;
      try {
        // O OAuth real pode devolver outra conta que não a digitada.
        if (profile.username.toLowerCase() !== data.username.toLowerCase()) {
          await ensureHandleAvailable(data.platform, profile.username);
        }
        await channels.insert(channel);
        inserted = true;
        await session?.commit(channel.id);
      } catch (error) {
        await rollback(session, inserted ? () => channels.delete(channel.id) : null);
        throw error;
      }
      logger.info('Canal conectado', { platform: channel.platform, username: channel.username });
      return channel;
    },

    /** Reconecta um canal existente (mesma conta). Falhas restauram o canal como estava. */
    async connect(id: Id): Promise<void> {
      const channel = await requireChannel(id);
      const { profile, session } = await social[channel.platform].connect({
        usernameHint: channel.username,
        displayNameHint: channel.displayName,
      });
      const now = clock.now().toISOString();
      let updated = false;
      try {
        if (profile.username.toLowerCase() !== channel.username.toLowerCase()) {
          throw new AppError(
            'CONFLICT',
            `Você entrou como @${profile.username}, mas este canal é @${channel.username}. Entre com a conta certa ou adicione um canal novo.`,
          );
        }
        await channels.update(id, {
          status: 'connected',
          displayName: profile.displayName,
          avatarUrl: profile.avatarUrl,
          lastSyncedAt: now,
          updatedAt: now,
        });
        updated = true;
        await session?.commit(id);
      } catch (error) {
        await rollback(
          session,
          updated
            ? () =>
                channels.update(id, {
                  status: channel.status,
                  displayName: channel.displayName,
                  avatarUrl: channel.avatarUrl,
                  lastSyncedAt: channel.lastSyncedAt,
                  updatedAt: channel.updatedAt,
                })
            : null,
        );
        throw error;
      }
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
