import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { IconButton } from '@/components/ui/IconButton';
import { Notice } from '@/components/ui/Notice';
import { PageHeader } from '@/components/ui/PageHeader';
import { LoadingBlock } from '@/components/ui/Spinner';
import { useToast } from '@/components/ui/toastContext';
import { usePosts, useReschedulePost } from '@/features/posts/hooks';
import { usePostDialogs } from '@/features/posts/postDialogsContext';
import { useSettingValue } from '@/features/settings/hooks';
import { WEEK_STARTS_ON_SETTING } from '@/features/settings/settingsService';
import { useNow } from '@/hooks/useNow';
import { getErrorMessage } from '@/lib/errors';
import { addDays, getWeekDays, startOfWeek } from '@/utils/date';
import { formatScheduleLabel, formatWeekRange } from '@/utils/format';

import { CALENDAR_STATUSES, moveToSlot } from './calendarLayout';
import { WeekCalendar } from './components/WeekCalendar';

export function CalendarPage() {
  const now = useNow();
  const weekStartsOn = useSettingValue(WEEK_STARTS_ON_SETTING);
  const [anchor, setAnchor] = useState(() => new Date());
  const [showDrafts, setShowDrafts] = useState(true);
  const { openComposer, openDetails } = usePostDialogs();
  const reschedule = useReschedulePost();
  const toast = useToast();

  const weekStart = startOfWeek(anchor, weekStartsOn);
  const posts = usePosts({
    statuses: showDrafts
      ? CALENDAR_STATUSES
      : CALENDAR_STATUSES.filter((status) => status !== 'draft'),
    scheduledFrom: weekStart.toISOString(),
    scheduledTo: addDays(weekStart, 7).toISOString(),
    order: 'scheduled_asc',
  });

  function movePost(postId: string, day: Date, hour: number) {
    const post = posts.data?.find((item) => item.id === postId);
    if (!post) return;
    const original = post.scheduledAt ? new Date(post.scheduledAt) : null;
    const target = moveToSlot(original, day, hour);
    if (original?.getTime() === target.getTime()) return;

    reschedule.mutate(
      { id: postId, scheduledAt: target },
      {
        onSuccess: () => toast.success('Post reagendado', formatScheduleLabel(target, now)),
        onError: (error) => toast.error(error, 'Não foi possível reagendar'),
      },
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Calendário"
        description="Arraste um post para reagendar · duplo clique em um horário para criar"
        actions={
          <>
            <Checkbox
              label="Rascunhos"
              checked={showDrafts}
              onChange={(event) => setShowDrafts(event.target.checked)}
              className="mr-2"
            />
            <div className="flex items-center gap-1">
              <IconButton
                icon={ChevronLeft}
                label="Semana anterior"
                onClick={() => setAnchor((date) => addDays(date, -7))}
              />
              <Button size="sm" onClick={() => setAnchor(new Date())}>
                Hoje
              </Button>
              <IconButton
                icon={ChevronRight}
                label="Próxima semana"
                onClick={() => setAnchor((date) => addDays(date, 7))}
              />
            </div>
            <span
              className="min-w-44 text-center text-sm font-medium text-ink tabular"
              aria-live="polite"
            >
              {formatWeekRange(weekStart)}
            </span>
            <Button variant="primary" icon={Plus} onClick={() => openComposer()}>
              Novo post
            </Button>
          </>
        }
      />

      {posts.isPending && <LoadingBlock />}
      {posts.isError && (
        <Notice tone="danger" className="m-6">
          {getErrorMessage(posts.error)}
        </Notice>
      )}
      {posts.isSuccess && (
        <WeekCalendar
          days={getWeekDays(weekStart)}
          posts={posts.data}
          now={now}
          onOpenPost={(post) => openDetails(post.id)}
          onMovePost={movePost}
          onCreateAt={(date) => openComposer({ scheduledAt: date })}
        />
      )}
    </div>
  );
}
