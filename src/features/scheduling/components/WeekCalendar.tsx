import { type DragEvent, useEffect, useRef, useState } from 'react';

import { isEditable } from '@/features/posts/postRules';
import type { PostWithRelations } from '@/types';
import { cn } from '@/utils/cn';
import { addMinutes, isSameDay } from '@/utils/date';
import { formatWeekday } from '@/utils/format';

import { dayKey, groupByDayAndHour, HOURS_OF_DAY, moveToSlot, slotKey } from '../calendarLayout';
import { POST_DRAG_TYPE, PostChip } from './PostChip';

const INITIAL_SCROLL_HOUR = 7;

interface WeekCalendarProps {
  days: Date[];
  posts: PostWithRelations[];
  now: Date;
  onOpenPost: (post: PostWithRelations) => void;
  onMovePost: (postId: string, day: Date, hour: number) => void;
  onCreateAt: (date: Date) => void;
}

/**
 * Grade semanal (dias × horas). Posts editáveis podem ser arrastados para outra célula;
 * duplo clique em uma célula cria um post naquele horário.
 * Requer `dragDropEnabled: false` na janela do Tauri (ver DEC-010).
 */
export function WeekCalendar({
  days,
  posts,
  now,
  onOpenPost,
  onMovePost,
  onCreateAt,
}: WeekCalendarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const bySlot = groupByDayAndHour(posts);

  // Abre a grade no início da manhã, logo abaixo do cabeçalho fixo dos dias.
  useEffect(() => {
    const container = scrollRef.current;
    const row = container?.querySelector<HTMLElement>(`[data-hour="${INITIAL_SCROLL_HOUR}"]`);
    const header = container?.querySelector<HTMLElement>('[role="columnheader"]');
    if (container && row) container.scrollTop = row.offsetTop - (header?.offsetHeight ?? 0);
  }, []);

  function isPostDrag(event: DragEvent) {
    return event.dataTransfer.types.includes(POST_DRAG_TYPE);
  }

  function handleDrop(event: DragEvent, day: Date, hour: number) {
    event.preventDefault();
    setDropTarget(null);
    const postId = event.dataTransfer.getData(POST_DRAG_TYPE);
    if (postId) onMovePost(postId, day, hour);
  }

  return (
    // `relative` torna este contêiner o offsetParent das linhas (usado na rolagem inicial).
    <div ref={scrollRef} className="relative min-h-0 flex-1 overflow-auto">
      <div
        role="grid"
        aria-label="Calendário semanal"
        className="grid min-w-[960px] grid-cols-[56px_repeat(7,minmax(120px,1fr))]"
      >
        <div role="row" className="contents">
          <div className="sticky top-0 z-10 border-b border-line bg-canvas" />
          {days.map((day) => {
            const isToday = isSameDay(day, now);
            return (
              <div
                key={dayKey(day)}
                role="columnheader"
                className="sticky top-0 z-10 flex items-baseline gap-1.5 border-b border-l border-line bg-canvas px-2 py-2"
              >
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
                    'text-base tabular',
                    isToday ? 'rounded-sm bg-accent px-1 font-semibold text-white' : 'text-ink',
                  )}
                >
                  {day.getDate()}
                </span>
              </div>
            );
          })}
        </div>

        {HOURS_OF_DAY.map((hour) => (
          <div key={hour} role="row" className="contents">
            <div
              data-hour={hour}
              role="rowheader"
              className="border-b border-line pt-1 pr-2 text-right text-2xs text-ink-3 tabular"
            >
              {String(hour).padStart(2, '0')}:00
            </div>
            {days.map((day) => {
              const key = slotKey(day, hour);
              const slotStart = moveToSlot(null, day, hour);
              const isPast = addMinutes(slotStart, 60) <= now;
              const items = bySlot.get(key) ?? [];
              return (
                <div
                  key={key}
                  role="gridcell"
                  aria-label={`${formatWeekday(day)} ${day.getDate()}, ${hour}h`}
                  onDoubleClick={(event) => {
                    if (event.target === event.currentTarget) onCreateAt(slotStart);
                  }}
                  onDragOver={(event) => {
                    if (!isPostDrag(event)) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    if (dropTarget !== key) setDropTarget(key);
                  }}
                  onDragLeave={() => {
                    if (dropTarget === key) setDropTarget(null);
                  }}
                  onDrop={(event) => handleDrop(event, day, hour)}
                  className={cn(
                    'flex min-h-12 flex-col gap-1 border-b border-l border-line p-1 transition-colors',
                    isPast && 'bg-sunken/70',
                    dropTarget === key && 'bg-accent-subtle ring-1 ring-accent ring-inset',
                  )}
                >
                  {items.map((post) => (
                    <PostChip
                      key={post.id}
                      post={post}
                      draggable={isEditable(post.status)}
                      onOpen={() => onOpenPost(post)}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
