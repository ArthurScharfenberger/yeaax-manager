import type { SocialProfile } from '@/services/social';
import type { Channel } from '@/types';

/**
 * A conta autorizada é a deste canal? Compara pelo id da plataforma (open_id) quando os dois lados o têm — ele
 * não muda quando o @ muda. Sem id (canais simulados ou antigos), compara o @ sem diferenciar maiúsculas.
 */
export function isSameAccount(
  channel: Pick<Channel, 'externalId' | 'username'>,
  profile: Pick<SocialProfile, 'externalId' | 'username'>,
): boolean {
  if (channel.externalId && profile.externalId) return channel.externalId === profile.externalId;
  return channel.username.toLowerCase() === profile.username.toLowerCase();
}

/** Campos do canal que vêm do perfil da plataforma (nome, @, avatar, id). */
export function profilePatch(channel: Channel, profile: SocialProfile) {
  return {
    username: profile.username || channel.username,
    externalId: profile.externalId ?? channel.externalId,
    displayName: profile.displayName || channel.displayName,
    avatarUrl: profile.avatarUrl,
  };
}
