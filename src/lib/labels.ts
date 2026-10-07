import type { ChannelStatus, MediaStatus, PostHistoryEvent, PostStatus } from '@/types';

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
