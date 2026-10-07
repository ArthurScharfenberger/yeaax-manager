import { KeyRound, PlugZap, Trash2 } from 'lucide-react';
import { type SubmitEvent, useId, useState } from 'react';

import { useServices } from '@/app/ServicesContext';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Input } from '@/components/ui/Input';
import { Notice } from '@/components/ui/Notice';
import { SettingRow } from '@/components/ui/SettingRow';
import { useToast } from '@/components/ui/toastContext';
import { AI_MODEL_SETTING, DEFAULT_OPENAI_MODEL } from '@/features/ai/aiSettings';
import { useAiStatus, useOpenAiKey, useTestAiConnection } from '@/features/ai/hooks';

import { useSettingValue, useUpdateSetting } from '../hooks';

export function AiSection() {
  const { mode } = useServices();
  const keyId = useId();
  const modelId = useId();
  const status = useAiStatus();
  const { save, remove } = useOpenAiKey();
  const test = useTestAiConnection();
  const toast = useToast();
  const model = useSettingValue(AI_MODEL_SETTING);
  const updateModel = useUpdateSetting(AI_MODEL_SETTING);
  const [key, setKey] = useState('');
  const [modelDraft, setModelDraft] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const configured = status.data?.provider === 'openai';

  if (mode === 'preview') {
    return (
      <Notice>
        A chave da OpenAI só pode ser configurada no app desktop (Gerenciador de Credenciais do
        Windows). No modo preview, a IA usa o simulador local.
      </Notice>
    );
  }

  function saveKey(event: SubmitEvent) {
    event.preventDefault();
    save.mutate(key, {
      onSuccess: () => {
        setKey('');
        toast.success(
          'Chave da OpenAI salva',
          'Guardada no Gerenciador de Credenciais do Windows.',
        );
      },
      onError: (error) => toast.error(error, 'Não foi possível salvar a chave'),
    });
  }

  return (
    <>
      <SettingRow
        label="IA ativa"
        description={
          configured
            ? 'Legendas e "Postar com IA" usam a OpenAI.'
            : 'Sem chave configurada: o app usa o simulador local (regras e modelos de texto).'
        }
      >
        {status.data && (
          <Badge tone={configured ? 'success' : 'warning'} dot>
            {status.data.label}
          </Badge>
        )}
      </SettingRow>

      <SettingRow
        label="Chave de API da OpenAI"
        description="Crie em platform.openai.com → API keys. Fica no Gerenciador de Credenciais do Windows — nunca no banco, em arquivos ou nos logs, e não é exibida de volta."
        htmlFor={keyId}
      >
        <form onSubmit={saveKey} className="flex items-center gap-2">
          <Input
            id={keyId}
            type="password"
            autoComplete="off"
            spellCheck={false}
            placeholder={configured ? '•••••••• (configurada)' : 'sk-…'}
            value={key}
            onChange={(event) => setKey(event.target.value)}
            className="w-56"
          />
          <Button
            type="submit"
            size="sm"
            variant="primary"
            icon={KeyRound}
            loading={save.isPending}
            disabled={!key.trim()}
          >
            {configured ? 'Substituir' : 'Salvar'}
          </Button>
        </form>
      </SettingRow>

      <SettingRow
        label="Modelo"
        description={`Padrão: ${DEFAULT_OPENAI_MODEL} (o mais econômico com leitura de imagem). Custo típico: frações de centavo por post.`}
        htmlFor={modelId}
      >
        <Input
          id={modelId}
          value={modelDraft ?? model}
          onChange={(event) => setModelDraft(event.target.value)}
          className="w-44 font-mono text-xs"
          spellCheck={false}
        />
        <Button
          size="sm"
          disabled={modelDraft === null || modelDraft.trim() === model}
          loading={updateModel.isPending}
          onClick={() =>
            updateModel.mutate(modelDraft?.trim() ?? model, {
              onSuccess: () => {
                setModelDraft(null);
                toast.success('Modelo atualizado');
              },
              onError: (error) => toast.error(error),
            })
          }
        >
          Salvar
        </Button>
      </SettingRow>

      <SettingRow
        label="Conexão"
        description="Faz um pedido mínimo para validar chave, créditos e modelo."
      >
        <Button
          size="sm"
          icon={PlugZap}
          disabled={!configured}
          loading={test.isPending}
          onClick={() =>
            test.mutate(undefined, {
              onSuccess: () => toast.success('Conexão com a OpenAI funcionando'),
              onError: (error) => toast.error(error, 'Falha ao conectar à OpenAI'),
            })
          }
        >
          Testar conexão
        </Button>
        <Button
          size="sm"
          variant="danger"
          icon={Trash2}
          disabled={!configured}
          onClick={() => setConfirmRemove(true)}
        >
          Remover chave
        </Button>
      </SettingRow>

      {confirmRemove && (
        <ConfirmDialog
          title="Remover a chave da OpenAI?"
          description="A chave será apagada do Gerenciador de Credenciais. O app volta a usar o simulador local até uma nova chave ser salva."
          confirmLabel="Remover chave"
          onClose={() => setConfirmRemove(false)}
          onConfirm={async () => {
            await remove.mutateAsync();
            toast.success('Chave removida');
          }}
        />
      )}
    </>
  );
}
