import { useQuery } from '@tanstack/react-query';

import { useServices } from '@/app/ServicesContext';
import { SettingRow } from '@/components/ui/SettingRow';
import { DATABASE_FILENAME } from '@/db/tauriClient';
import { queryKeys } from '@/lib/queryKeys';

export function StorageSection() {
  const { desktop, mode } = useServices();
  const directory = useQuery({
    queryKey: queryKeys.system.dataDirectory,
    queryFn: () => desktop.getDataDirectory(),
  });

  return (
    <>
      <SettingRow label="Banco de dados" description="SQLite local. Nunca versione este arquivo.">
        <span className="max-w-80 text-right font-mono text-2xs break-all text-ink-2">
          {mode === 'preview'
            ? 'Em memória (modo preview — some ao recarregar)'
            : directory.data
              ? `${directory.data}${directory.data.includes('/') ? '/' : '\\'}${DATABASE_FILENAME}`
              : '…'}
        </span>
      </SettingRow>
      <SettingRow
        label="Vídeos"
        description="Os arquivos não são copiados: o app guarda apenas o caminho original (DEC-006). Mover ou renomear um arquivo o torna indisponível."
      >
        <span className="text-sm text-ink-2">Referência ao original</span>
      </SettingRow>
      <SettingRow
        label="Miniaturas"
        description="Serão geradas pelo FFmpeg em uma pasta do app (Fase 2)."
      >
        <span className="text-sm text-ink-3">Não configurado</span>
      </SettingRow>
    </>
  );
}
