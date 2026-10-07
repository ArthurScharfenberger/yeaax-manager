import { Link } from 'react-router';

import { ROUTES } from '@/app/routes';
import { LoadingBlock } from '@/components/ui/Spinner';
import { usePosts } from '@/features/posts/hooks';
import { usePostDialogs } from '@/features/posts/postDialogsContext';
import { useSettingValue } from '@/features/settings/hooks';
import { WEEK_STARTS_ON_SETTING } from '@/features/settings/settingsService';
import { cn } from '@/utils/cn';
import { addDays, getWeekDays, isSameDay, startOfWeek } from '@/utils/date';
import { formatWeekday } from '@/utils/format';

import { CALENDAR_STATUSES, dayKey, groupByDay } from '../calendarLayout';
import { PostChip } from './PostChip';

const MAX_PER_DAY = 5;

/** Visão semanal compacta (sem grade de horas) usada no Dashboard. */
export function WeekAgenda({ now }: { now: Date }) {
  const weekStartsOn = useSettingValue(WEEK_STARTS_ON_SETTING);
  const weekStart = startOfWeek(now, weekStartsOn);
  const days = getWeekDays(weekStart);
  const posts = usePosts({
    statuses: CALENDAR_STATUSES,
    scheduledFrom: weekStart.toISOString(),
    scheduledTo: addDays(weekStart, 7).toISOString(),
    order: 'scheduled_asc',
  });
  const { openDetails } = usePostDialogs();

  if (posts.isPending) return <LoadingBlock />;
  const byDay = groupByDay(posts.data ?? []);

  return (
    <div className="grid grid-cols-7 divide-x divide-line">
      {days.map((day) => {
        const items = byDay.get(dayKey(day)) ?? [];
        const isToday = isSameDay(day, now);
        return (
          <div
            key={dayKey(day)}
            className={cn('flex min-w-0 flex-col', isToday && 'bg-accent-subtle/40')}
          >
            <div className="flex items-baseline gap-1.5 border-b border-line px-2 py-1.5">
              <span
                className={cn(
                  'text-2xs uppercase',
                  isToday ? 'font-semibold text-accent' : 'text-ink-3',
                )}
              >
                {formatWeekday(day).replace('.', '')}
              </span>
              <span
                className={cn(
                  'text-sm tabular',
                  isToday ? 'font-semibold text-accent' : 'text-ink-2',
                )}
              >
                {day.getDate()}
              </span>
            </div>
            <div className="flex min-h-36 flex-col gap-1 p-1.5">
              {items.slice(0, MAX_PER_DAY).map((post) => (
                <PostChip key={post.id} post={post} onOpen={() => openDetails(post.id)} />
              ))}
              {items.length > MAX_PER_DAY && (
                <Link to={ROUTES.calendar} className="px-1 text-2xs text-accent hover:underline">
                  +{items.length - MAX_PER_DAY} mais
                </Link>
              )}
              {items.length === 0 && <span className="px-1 pt-1 text-2xs text-ink-4">—</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
