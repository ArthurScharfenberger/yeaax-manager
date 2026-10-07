import { useId } from 'react';

import { SettingRow } from '@/components/ui/SettingRow';

export function AppearanceSection() {
  const name = useId();
  return (
    <>
      <SettingRow
        label="Tema"
        description="O tema escuro está planejado e usará os mesmos tokens de cor."
      >
        <fieldset className="flex items-center gap-4">
          <legend className="sr-only">Tema</legend>
          <label className="flex items-center gap-1.5 text-sm">
            <input
              type="radio"
              name={name}
              value="light"
              defaultChecked
              className="accent-accent"
            />
            Claro
          </label>
          <label className="flex items-center gap-1.5 text-sm text-ink-3">
            <input type="radio" name={name} value="dark" disabled className="accent-accent" />
            Escuro (em breve)
          </label>
        </fieldset>
      </SettingRow>
      <SettingRow label="Densidade" description="Interface compacta, pensada para uso em desktop.">
        <span className="text-sm text-ink-2">Padrão</span>
      </SettingRow>
    </>
  );
}
