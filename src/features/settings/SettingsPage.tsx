import type { ComponentType } from 'react';
import { useSearchParams } from 'react-router';

import { PageHeader } from '@/components/ui/PageHeader';
import { cn } from '@/utils/cn';

import { AboutSection } from './sections/AboutSection';
import { AiSection } from './sections/AiSection';
import { AppearanceSection } from './sections/AppearanceSection';
import { FfmpegSection } from './sections/FfmpegSection';
import { GeneralSection } from './sections/GeneralSection';
import { IntegrationsSection } from './sections/IntegrationsSection';
import { StorageSection } from './sections/StorageSection';

interface SectionDefinition {
  id: string;
  label: string;
  component: ComponentType;
}

const SECTIONS: readonly SectionDefinition[] = [
  { id: 'general', label: 'Geral', component: GeneralSection },
  { id: 'storage', label: 'Armazenamento', component: StorageSection },
  { id: 'integrations', label: 'Integrações', component: IntegrationsSection },
  { id: 'ai', label: 'IA', component: AiSection },
  { id: 'ffmpeg', label: 'FFmpeg', component: FfmpegSection },
  { id: 'appearance', label: 'Aparência', component: AppearanceSection },
  { id: 'about', label: 'Sobre', component: AboutSection },
];

export function SettingsPage() {
  const [params, setParams] = useSearchParams();
  const active = SECTIONS.find((section) => section.id === params.get('section')) ?? SECTIONS[0];
  if (!active) return null;
  const Section = active.component;

  return (
    <div className="flex h-full flex-col">
      <PageHeader title="Configurações" description="Preferências locais deste computador." />
      <div className="flex min-h-0 flex-1">
        <nav aria-label="Seções de configuração" className="w-52 shrink-0 border-r border-line p-2">
          <ul className="flex flex-col gap-0.5">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <button
                  type="button"
                  aria-current={section.id === active.id ? 'page' : undefined}
                  onClick={() => setParams({ section: section.id }, { replace: true })}
                  className={cn(
                    'flex h-8 w-full items-center rounded px-2.5 text-left text-sm transition-colors',
                    section.id === active.id
                      ? 'bg-pressed font-medium text-ink'
                      : 'text-ink-2 hover:bg-hover hover:text-ink',
                  )}
                >
                  {section.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
        <div className="min-w-0 flex-1 overflow-y-auto">
          <section aria-labelledby="settings-section-title" className="max-w-3xl px-8 py-6">
            <h2 id="settings-section-title" className="mb-2 text-base font-semibold text-ink">
              {active.label}
            </h2>
            <Section />
          </section>
        </div>
      </div>
    </div>
  );
}
