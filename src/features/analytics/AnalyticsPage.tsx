import { BarChart3 } from 'lucide-react';

import { PlatformMark } from '@/components/PlatformMark';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { Table, Td, Th, THead, Tr } from '@/components/ui/Table';
import { useChannels } from '@/features/channels/hooks';
import { formatHandle } from '@/utils/format';

/** Métricas planejadas. Nenhum valor é estimado ou inventado. */
const PLANNED_METRICS = [
  'Visualizações',
  'Curtidas',
  'Comentários',
  'Compartilhamentos',
  'Novos seguidores',
  'Retenção média',
];

export function AnalyticsPage() {
  const channels = useChannels();

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Analytics"
        description="Desempenho dos conteúdos por canal e plataforma."
      />
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-5 p-6">
          <div className="rounded-md border border-line">
            <EmptyState
              icon={BarChart3}
              title="Analytics ainda não conectado"
              description="As métricas serão importadas das APIs oficiais do TikTok e do Instagram quando as integrações forem ativadas. Até lá, nenhum número é exibido — nada é estimado ou inventado."
            />
          </div>

          <Panel title="Métricas planejadas">
            <dl className="grid grid-cols-2 divide-line md:grid-cols-3 md:divide-x">
              {PLANNED_METRICS.map((metric) => (
                <div key={metric} className="flex flex-col gap-1 border-b border-line px-5 py-4">
                  <dt className="text-xs text-ink-3">{metric}</dt>
                  <dd className="text-2xl font-semibold text-ink-4 tabular">—</dd>
                  <dd className="text-xs text-ink-3">Sem dados</dd>
                </div>
              ))}
            </dl>
          </Panel>

          <Panel title="Fontes de dados por canal">
            <Table>
              <THead>
                <tr>
                  <Th>Canal</Th>
                  <Th>Plataforma</Th>
                  <Th>Integração</Th>
                  <Th>Analytics</Th>
                </tr>
              </THead>
              <tbody>
                {channels.data?.map((channel) => (
                  <Tr key={channel.id}>
                    <Td>
                      <span className="font-medium text-ink">{channel.displayName}</span>{' '}
                      <span className="text-xs text-ink-3">{formatHandle(channel.username)}</span>
                    </Td>
                    <Td>
                      <PlatformMark platform={channel.platform} withLabel />
                    </Td>
                    <Td>
                      <Badge>Simulada</Badge>
                    </Td>
                    <Td className="text-ink-3">Não disponível</Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          </Panel>
        </div>
      </div>
    </div>
  );
}
