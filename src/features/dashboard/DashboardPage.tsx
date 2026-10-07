import { Plus, Upload, Workflow } from 'lucide-react';
import { Link, useNavigate } from 'react-router';

import { ROUTES } from '@/app/routes';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { AiSuggestions } from '@/features/ai/components/AiSuggestions';
import { ConnectedAccountsList } from '@/features/channels/components/ConnectedAccountsList';
import { LibraryPreview } from '@/features/media/components/LibraryPreview';
import { useImportMedia } from '@/features/media/hooks';
import { PublicationQueue } from '@/features/posts/components/PublicationQueue';
import { usePostDialogs } from '@/features/posts/postDialogsContext';
import { WeekAgenda } from '@/features/scheduling/components/WeekAgenda';
import { GlobalSearch } from '@/features/search/GlobalSearch';
import { useNow } from '@/hooks/useNow';
import { formatLongDay } from '@/utils/format';

import { MetricsBar } from './components/MetricsBar';

const panelLink = 'px-2 text-xs font-medium text-accent hover:underline';

export function DashboardPage() {
  const now = useNow();
  const navigate = useNavigate();
  const { openComposer } = usePostDialogs();
  const importMedia = useImportMedia();

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-line px-6">
        <GlobalSearch />
        <div className="ml-auto flex items-center gap-2">
          <Button
            icon={Upload}
            loading={importMedia.isPending}
            onClick={() => importMedia.mutate()}
          >
            Importar Vídeo
          </Button>
          <Button variant="primary" icon={Plus} onClick={() => openComposer()}>
            Novo Post
          </Button>
          <Button
            icon={Workflow}
            onClick={() => void navigate(ROUTES.automation)}
            title="Configurar Auto Schedule (execução automática em breve)"
          >
            Auto Schedule
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-5 p-6">
          <div>
            <h1 className="text-xl font-semibold text-ink">Visão geral</h1>
            <p className="text-xs text-ink-3 first-letter:uppercase">{formatLongDay(now)}</p>
          </div>

          <MetricsBar now={now} />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <Panel
              title="Fila de publicação"
              meta="próximos 7 dias"
              actions={
                <Link to={ROUTES.calendar} className={panelLink}>
                  Abrir calendário
                </Link>
              }
            >
              <PublicationQueue now={now} />
            </Panel>
            <Panel
              title="Contas conectadas"
              actions={
                <Link to={ROUTES.channels} className={panelLink}>
                  Gerenciar
                </Link>
              }
            >
              <ConnectedAccountsList />
            </Panel>
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
            <Panel
              title="Agenda da semana"
              actions={
                <Link to={ROUTES.calendar} className={panelLink}>
                  Ver calendário
                </Link>
              }
            >
              <WeekAgenda now={now} />
            </Panel>
            <Panel title="Sugestões IA" actions={<Badge>Simulado</Badge>}>
              <AiSuggestions now={now} />
            </Panel>
          </div>

          <Panel
            title="Biblioteca de conteúdo"
            meta="mais recentes"
            actions={
              <Link to={ROUTES.library} className={panelLink}>
                Abrir biblioteca
              </Link>
            }
          >
            <LibraryPreview />
          </Panel>
        </div>
      </div>
    </div>
  );
}
