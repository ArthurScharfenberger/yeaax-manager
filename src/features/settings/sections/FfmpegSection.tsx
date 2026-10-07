import { useQuery } from '@tanstack/react-query';
import { RefreshCw } from 'lucide-react';

import { useServices } from '@/app/ServicesContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { SettingRow } from '@/components/ui/SettingRow';
import { queryKeys } from '@/lib/queryKeys';

export function FfmpegSection() {
  const { videoProcessor, mode } = useServices();
  const status = useQuery({
    queryKey: queryKeys.system.ffmpeg,
    queryFn: () => videoProcessor.getStatus(),
    staleTime: Infinity,
  });

  return (
    <>
      <SettingRow
        label="Status"
        description={
          mode === 'preview'
            ? 'A detecção só funciona no app desktop.'
            : (status.data?.version ?? 'Procura o executável `ffmpeg` no PATH do sistema.')
        }
      >
        {status.data?.available ? (
          <Badge tone="success" dot>
            Detectado
          </Badge>
        ) : (
          <Badge dot>{status.isPending ? 'Verificando…' : 'Não encontrado'}</Badge>
        )}
        <Button
          size="sm"
          icon={RefreshCw}
          loading={status.isFetching}
          onClick={() => void status.refetch()}
        >
          Verificar
        </Button>
      </SettingRow>
      <SettingRow
        label="Instalação"
        description="Recomendado: build oficial via winget. Reinicie o app após instalar."
      >
        <code className="rounded-sm border border-line bg-sunken px-2 py-1 font-mono text-xs text-ink">
          winget install Gyan.FFmpeg
        </code>
      </SettingRow>
      <SettingRow
        label="Usos planejados"
        description="Miniaturas, leitura de metadados (ffprobe), adaptação para 9:16, compressão e watermark."
      >
        <Badge>Fase 2</Badge>
      </SettingRow>
    </>
  );
}
