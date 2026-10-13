import type {
  ChannelStatus,
  MediaStatus,
  PostHistoryEvent,
  PostStatus,
  TikTokPrivacyLevel,
} from '@/types';

/** Rótulos em pt-BR para enums do domínio. Centralizados para evitar strings soltas na UI. */

export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  draft: 'Rascunho',
  review: 'Em revisão',
  scheduled: 'Agendado',
  publishing: 'Publicando',
  published: 'Publicado',
  failed: 'Falhou',
  cancelled: 'Cancelado',
};

export const CHANNEL_STATUS_LABELS: Record<ChannelStatus, string> = {
  connected: 'Conectado',
  disconnected: 'Desconectado',
  expired: 'Sessão expirada',
  error: 'Erro',
};

/** Privacidade do TikTok, na ordem e com os nomes que o app do TikTok usa em pt-BR. */
export const TIKTOK_PRIVACY_LABELS: Record<TikTokPrivacyLevel, string> = {
  PUBLIC_TO_EVERYONE: 'Todos',
  FOLLOWER_OF_CREATOR: 'Seguidores',
  MUTUAL_FOLLOW_FRIENDS: 'Amigos (seguidores que você segue de volta)',
  SELF_ONLY: 'Somente eu',
};

/** Rótulo aplicado pelo TikTok conforme a divulgação comercial (DEC-029). */
export const TIKTOK_COMMERCIAL_LABELS = {
  promotional: 'Conteúdo promocional',
  paid_partnership: 'Parceria paga',
} as const;

export const MEDIA_STATUS_LABELS: Record<MediaStatus, string> = {
  imported: 'Importado',
  processing: 'Processando',
  ready: 'Pronto',
  used: 'Utilizado',
  error: 'Erro',
};

export const POST_HISTORY_EVENT_LABELS: Record<PostHistoryEvent, string> = {
  created: 'Post criado',
  updated: 'Post alterado',
  status_changed: 'Status alterado',
  scheduled: 'Agendado',
  rescheduled: 'Reagendado',
  publish_attempt: 'Tentativa de publicação',
  published: 'Publicado',
  failed: 'Falha na publicação',
  cancelled: 'Cancelado',
};
