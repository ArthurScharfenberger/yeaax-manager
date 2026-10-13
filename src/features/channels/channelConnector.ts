import { z } from 'zod';

import type { Repositories } from '@/db/repositories';
import type { Clock } from '@/lib/clock';
import { AppError } from '@/lib/errors';
import { createId } from '@/lib/ids';
import { logger } from '@/lib/logger';
import { PLATFORM_INFO } from '@/lib/platforms';
import type { ConnectionSession, SocialProfile, SocialProviderRegistry } from '@/services/social';
import { type Channel, type Id, type Platform, platformSchema } from '@/types';

import { isSameAccount, profilePatch } from './channelRules';

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

export interface ConnectAccountResult {
  channel: Channel;
  /** `false` quando a conta já existia e o canal foi reconectado. */
  created: boolean;
}

interface Deps {
  repositories: Pick<Repositories, 'channels'>;
  social: SocialProviderRegistry;
  clock: Clock;
}

/**
 * Conexão de contas. Com login oficial (TikTok — DEC-027) a conexão tem duas fases: o canal é gravado no banco e
 * só então as credenciais vão para o cofre (`session.commit`). Se qualquer passo falhar, o banco volta ao que era
 * e a conexão pendente é descartada — nada fica pela metade.
 */
export function createChannelConnector({ repositories, social, clock }: Deps) {
  const { channels } = repositories;

  async function requireChannel(id: Id): Promise<Channel> {
    const channel = await channels.getById(id);
    if (!channel) throw new AppError('NOT_FOUND', 'Canal não encontrado.');
    return channel;
  }

  async function ensureHandleAvailable(platform: Platform, username: string) {
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

  /** Cria o canal a partir do perfil e confirma as credenciais. */
  async function createFromProfile(
    platform: Platform,
    profile: SocialProfile,
    session: ConnectionSession | undefined,
  ): Promise<Channel> {
    const now = clock.now().toISOString();
    const channel: Channel = {
      id: createId(),
      platform,
      username: profile.username,
      externalId: profile.externalId,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      status: 'connected',
      lastSyncedAt: now,
      createdAt: now,
      updatedAt: now,
    };
    let inserted = false;
    try {
      await ensureHandleAvailable(platform, profile.username);
      await channels.insert(channel);
      inserted = true;
      await session?.commit(channel.id);
    } catch (error) {
      await rollback(session, inserted ? () => channels.delete(channel.id) : null);
      throw error;
    }
    logger.info('Canal conectado', { platform, username: channel.username });
    return channel;
  }

  /** Atualiza um canal existente com o perfil recém-autorizado e confirma as credenciais. */
  async function reconnectWithProfile(
    channel: Channel,
    profile: SocialProfile,
    session: ConnectionSession | undefined,
  ): Promise<Channel> {
    const now = clock.now().toISOString();
    let updated = false;
    try {
      if (!isSameAccount(channel, profile)) {
        throw new AppError(
          'CONFLICT',
          `Você entrou como @${profile.username}, mas este canal é @${channel.username}. Entre com a conta certa ou adicione um canal novo.`,
        );
      }
      await channels.update(channel.id, {
        ...profilePatch(channel, profile),
        status: 'connected',
        lastSyncedAt: now,
        updatedAt: now,
      });
      updated = true;
      await session?.commit(channel.id);
    } catch (error) {
      await rollback(
        session,
        updated
          ? () =>
              channels.update(channel.id, {
                username: channel.username,
                externalId: channel.externalId,
                displayName: channel.displayName,
                avatarUrl: channel.avatarUrl,
                status: channel.status,
                lastSyncedAt: channel.lastSyncedAt,
                updatedAt: channel.updatedAt,
              })
          : null,
      );
      throw error;
    }
    return requireChannel(channel.id);
  }

  return {
    /** Providers simulados: o usuário informa o @ (o login oficial descobre a conta sozinho). */
    async connectNew(input: NewChannelInput): Promise<Channel> {
      const data = newChannelSchema.parse(input);
      await ensureHandleAvailable(data.platform, data.username);
      const { profile, session } = await social[data.platform].connect({
        usernameHint: data.username,
        displayNameHint: data.displayName || data.username,
      });
      return createFromProfile(data.platform, profile, session);
    },

    /**
     * Login oficial: a conta vem da plataforma. Se ela já estiver cadastrada (pelo open_id ou, em canais antigos,
     * pelo @), o canal existente é reconectado em vez de duplicado.
     */
    async connectAccount(platform: Platform): Promise<ConnectAccountResult> {
      const { profile, session } = await social[platform].connect({});
      let existing: Channel | null;
      try {
        existing =
          (profile.externalId
            ? await channels.findByExternalId(platform, profile.externalId)
            : null) ?? (await channels.findByHandle(platform, profile.username));
      } catch (error) {
        await rollback(session, null);
        throw error;
      }
      if (existing) {
        return { channel: await reconnectWithProfile(existing, profile, session), created: false };
      }
      return { channel: await createFromProfile(platform, profile, session), created: true };
    },

    /** Reconecta um canal existente (precisa ser a mesma conta). */
    async connect(id: Id): Promise<void> {
      const channel = await requireChannel(id);
      const { profile, session } = await social[channel.platform].connect({
        usernameHint: channel.username,
        displayNameHint: channel.displayName,
      });
      await reconnectWithProfile(channel, profile, session);
    },

    /** Cancela um login oficial em andamento (fecha a porta local do app). */
    async cancelConnect(platform: Platform): Promise<void> {
      await social[platform].cancelConnect?.();
    },
  };
}

export type ChannelConnector = ReturnType<typeof createChannelConnector>;
