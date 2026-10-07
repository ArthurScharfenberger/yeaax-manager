/**
 * Status das integrações externas exibido na UI (Configurações → Integrações).
 * Manter em sincronia com docs/INTEGRATIONS.md.
 */
export const INTEGRATION_STATUSES = [
  'NOT_STARTED',
  'MOCK',
  'IN_PROGRESS',
  'ACTIVE',
  'BLOCKED',
] as const;

export type IntegrationStatus = (typeof INTEGRATION_STATUSES)[number];

export type IntegrationId = 'tiktok' | 'instagram' | 'openai' | 'ffmpeg';

export interface IntegrationInfo {
  id: IntegrationId;
  name: string;
  status: IntegrationStatus;
  description: string;
}

export const INTEGRATIONS: readonly IntegrationInfo[] = [
  {
    id: 'tiktok',
    name: 'TikTok',
    status: 'MOCK',
    description: 'Login Kit + Content Posting API. Provider simulado, sem chamadas reais.',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    status: 'MOCK',
    description:
      'Instagram Graph API (contas profissionais). Provider simulado, sem chamadas reais.',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    status: 'IN_PROGRESS',
    description:
      'Legendas e "Postar com IA". Ativa quando a chave estiver em Configurações → IA; sem chave, usa o simulador local.',
  },
  {
    id: 'ffmpeg',
    name: 'FFmpeg',
    status: 'NOT_STARTED',
    description:
      'Miniaturas, metadados, adaptação de formato e watermark. Apenas detecção no PATH.',
  },
];

export const INTEGRATION_STATUS_LABELS: Record<IntegrationStatus, string> = {
  NOT_STARTED: 'Não iniciada',
  MOCK: 'Simulada',
  IN_PROGRESS: 'Em desenvolvimento',
  ACTIVE: 'Ativa',
  BLOCKED: 'Bloqueada',
};
