import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { SettingRow } from '@/components/ui/SettingRow';
import {
  INTEGRATION_STATUS_LABELS,
  INTEGRATIONS,
  type IntegrationStatus,
} from '@/lib/integrations';

const STATUS_TONES: Record<IntegrationStatus, BadgeTone> = {
  NOT_STARTED: 'neutral',
  MOCK: 'warning',
  IN_PROGRESS: 'info',
  ACTIVE: 'success',
  BLOCKED: 'danger',
};

export function IntegrationsSection() {
  return (
    <>
      {INTEGRATIONS.map((integration) => (
        <SettingRow
          key={integration.id}
          label={integration.name}
          description={integration.description}
        >
          <Badge tone={STATUS_TONES[integration.status]}>
            {INTEGRATION_STATUS_LABELS[integration.status]}
          </Badge>
        </SettingRow>
      ))}
      <p className="pt-3 text-xs text-ink-3">
        Apenas APIs oficiais serão usadas — sem scraping ou automação de navegador. Detalhes em
        docs/INTEGRATIONS.md.
      </p>
    </>
  );
}
