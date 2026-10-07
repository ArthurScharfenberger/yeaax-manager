import type { Repositories } from '@/db/repositories';
import { addDays, startOfDay, startOfWeek, type WeekStart } from '@/utils/date';

export interface DashboardMetrics {
  activeChannels: number;
  totalChannels: number;
  postsToday: number;
  drafts: number;
  publishedThisWeek: number;
}

interface DashboardServiceDeps {
  repositories: Pick<Repositories, 'channels' | 'posts'>;
}

export function createDashboardService({ repositories }: DashboardServiceDeps) {
  const { channels, posts } = repositories;

  return {
    async getMetrics(now: Date, weekStartsOn: WeekStart): Promise<DashboardMetrics> {
      const today = startOfDay(now);
      const weekStart = startOfWeek(now, weekStartsOn);

      const [allChannels, activeChannels, postsToday, drafts, publishedThisWeek] =
        await Promise.all([
          channels.list(),
          channels.countByStatus('connected'),
          posts.countByEffectiveDate({
            statuses: ['scheduled', 'publishing', 'published', 'failed'],
            from: today.toISOString(),
            to: addDays(today, 1).toISOString(),
          }),
          posts.count({ statuses: ['draft'] }),
          posts.countByEffectiveDate({
            statuses: ['published'],
            from: weekStart.toISOString(),
            to: addDays(weekStart, 7).toISOString(),
          }),
        ]);

      return {
        activeChannels,
        totalChannels: allChannels.length,
        postsToday,
        drafts,
        publishedThisWeek,
      };
    },
  };
}

export type DashboardService = ReturnType<typeof createDashboardService>;
