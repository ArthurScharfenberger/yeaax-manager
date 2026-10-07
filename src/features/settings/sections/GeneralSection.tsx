import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';
import { useId, useState } from 'react';

import { useServices } from '@/app/ServicesContext';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Select } from '@/components/ui/Input';
import { SettingRow } from '@/components/ui/SettingRow';
import { useToast } from '@/components/ui/toastContext';
import { queryKeys } from '@/lib/queryKeys';

import { useSettingValue, useUpdateSetting } from '../hooks';
import { WEEK_STARTS_ON_SETTING } from '../settingsService';

export function GeneralSection() {
  const weekStartId = useId();
  const languageId = useId();
  const { demo } = useServices();
  const queryClient = useQueryClient();
  const toast = useToast();
  const weekStartsOn = useSettingValue(WEEK_STARTS_ON_SETTING);
  const updateWeekStart = useUpdateSetting(WEEK_STARTS_ON_SETTING);
  const [confirmRemove, setConfirmRemove] = useState(false);

  const hasDemoData = useQuery({
    queryKey: queryKeys.system.demoData,
    queryFn: () => demo.hasDemoData(),
  });
  const removeDemo = useMutation({
    mutationFn: () => demo.remove(),
    // Afeta praticamente todas as telas: invalida tudo.
    onSuccess: () => queryClient.invalidateQueries(),
  });

  return (
    <>
      <SettingRow
        label="Semana começa em"
        description="Usado no calendário e nas métricas semanais."
        htmlFor={weekStartId}
      >
        <Select
          id={weekStartId}
          value={weekStartsOn}
          onChange={(event) =>
            updateWeekStart.mutate(event.target.value === 'sunday' ? 'sunday' : 'monday', {
              onError: (error) => toast.error(error),
            })
          }
          className="w-40"
        >
          <option value="monday">Segunda-feira</option>
          <option value="sunday">Domingo</option>
        </Select>
      </SettingRow>
      <SettingRow
        label="Idioma"
        description="Outros idiomas da interface estão fora do escopo atual."
        htmlFor={languageId}
      >
        <Select id={languageId} value="pt-BR" disabled className="w-40">
          <option value="pt-BR">Português (Brasil)</option>
        </Select>
      </SettingRow>
      <SettingRow label="Fuso horário" description="Definido pelo sistema operacional.">
        <span className="text-sm text-ink-2">
          {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </span>
      </SettingRow>
      <SettingRow
        label="Dados de demonstração"
        description="Canais, vídeos e posts fictícios (@yeaxx, @techfix.rs…) criados na primeira execução. Posts criados em canais de demonstração também são removidos."
      >
        <Button
          size="sm"
          variant="danger"
          icon={Trash2}
          disabled={!hasDemoData.data}
          onClick={() => setConfirmRemove(true)}
        >
          {hasDemoData.data === false ? 'Já removidos' : 'Remover'}
        </Button>
      </SettingRow>

      {confirmRemove && (
        <ConfirmDialog
          title="Remover dados de demonstração?"
          description="Canais, vídeos, tags e posts de demonstração serão excluídos. Seus dados reais não são afetados. Esta ação não pode ser desfeita."
          confirmLabel="Remover dados"
          onClose={() => setConfirmRemove(false)}
          onConfirm={async () => {
            await removeDemo.mutateAsync();
            toast.success('Dados de demonstração removidos');
          }}
        />
      )}
    </>
  );
}
