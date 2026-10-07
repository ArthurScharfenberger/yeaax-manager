import { useId } from 'react';

import { useServices } from '@/app/ServicesContext';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { SettingRow } from '@/components/ui/SettingRow';

export function AiSection() {
  const { ai } = useServices();
  const keyId = useId();

  return (
    <>
      <SettingRow
        label="Provedor atual"
        description="Gera legendas a partir de modelos de texto locais."
      >
        <Badge tone="warning">{ai.label}</Badge>
      </SettingRow>
      <SettingRow
        label="OpenAI"
        description="Integração planejada para geração de legendas e hashtags."
      >
        <Badge>Não iniciada</Badge>
      </SettingRow>
      <SettingRow
        label="Chave de API"
        description="Quando implementada, será guardada no Gerenciador de Credenciais do Windows — nunca no banco, no .env do frontend ou nos logs."
        htmlFor={keyId}
      >
        <Input id={keyId} type="password" placeholder="Não configurada" disabled className="w-56" />
      </SettingRow>
    </>
  );
}
