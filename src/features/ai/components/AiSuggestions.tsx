import { Clock, Languages, type LucideIcon, Recycle } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import { ROUTES } from '@/app/routes';
import { AUTO_SCHEDULE_SETTING, planDailySlots } from '@/features/automation/autoSchedule';
import { useTags } from '@/features/media/hooks';
import { useSettingValue } from '@/features/settings/hooks';
import { timeToMinutes } from '@/utils/date';

interface SuggestionProps {
  icon: LucideIcon;
  title: ReactNode;
  description: string;
  action?: ReactNode;
}

function Suggestion({ icon: Icon, title, description, action }: SuggestionProps) {
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded border border-line bg-sunken text-ink-3">
        <Icon size={14} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink">{title}</p>
        <p className="text-xs text-ink-3">{description}</p>
      </div>
      {action}
    </li>
  );
}

const linkClass = 'shrink-0 self-center text-xs font-medium text-accent hover:underline';

/**
 * Sugestões exibidas no Dashboard. O "melhor horário" é uma estimativa simulada a
 * partir da configuração do Auto Schedule — não há IA nem analytics reais ainda.
 */
export function AiSuggestions({ now }: { now: Date }) {
  const config = useSettingValue(AUTO_SCHEDULE_SETTING);
  const tags = useTags();

  const minutesNow = now.getHours() * 60 + now.getMinutes();
  const slots = planDailySlots(config).slots;
  const nextSlot = slots.find((slot) => (timeToMinutes(slot) ?? 0) > minutesNow);
  const reuseTag = tags.data?.find((tag) => tag.name === 'reaproveitar');

  return (
    <ul className="divide-y divide-line">
      <Suggestion
        icon={Clock}
        title={
          nextSlot ? (
            <>
              Melhor horário para hoje:{' '}
              <strong className="font-semibold tabular">{nextSlot}</strong>
            </>
          ) : (
            <>
              Próximo horário sugerido:{' '}
              <strong className="font-semibold tabular">amanhã {slots[0] ?? '—'}</strong>
            </>
          )
        }
        description="Estimativa simulada com base no Auto Schedule."
        action={
          <Link to={ROUTES.automation} className={linkClass}>
            Ajustar
          </Link>
        }
      />
      <Suggestion
        icon={Languages}
        title="Gerar legenda em inglês"
        description="Amplie o alcance com uma versão em inglês."
        action={
          <Link to={`${ROUTES.captions}?lang=en`} className={linkClass}>
            Gerar
          </Link>
        }
      />
      <Suggestion
        icon={Recycle}
        title={
          reuseTag && reuseTag.usageCount > 0
            ? `${reuseTag.usageCount} vídeo(s) marcados para reaproveitar`
            : 'Nenhum vídeo marcado para reaproveitar'
        }
        description="Use a tag “reaproveitar” na biblioteca."
        action={
          reuseTag && reuseTag.usageCount > 0 ? (
            <Link to={`${ROUTES.library}?tag=${reuseTag.id}`} className={linkClass}>
              Ver
            </Link>
          ) : undefined
        }
      />
    </ul>
  );
}
