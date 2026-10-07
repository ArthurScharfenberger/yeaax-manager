import { createHashRouter } from 'react-router';

import { AnalyticsPage } from '@/features/analytics/AnalyticsPage';
import { AutomationPage } from '@/features/automation/AutomationPage';
import { CaptionsPage } from '@/features/ai/CaptionsPage';
import { ChannelsPage } from '@/features/channels/ChannelsPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { LibraryPage } from '@/features/media/LibraryPage';
import { CalendarPage } from '@/features/scheduling/CalendarPage';
import { SettingsPage } from '@/features/settings/SettingsPage';

import { AppLayout } from './layout/AppLayout';
import { NotFoundPage } from './NotFoundPage';
import { RouteError } from './RouteError';

/** HashRouter: o app desktop é servido como arquivos estáticos, sem servidor. */
export function createAppRouter() {
  return createHashRouter([
    {
      path: '/',
      element: <AppLayout />,
      errorElement: <RouteError />,
      children: [
        { index: true, element: <DashboardPage /> },
        { path: 'channels', element: <ChannelsPage /> },
        { path: 'library', element: <LibraryPage /> },
        { path: 'calendar', element: <CalendarPage /> },
        { path: 'automation', element: <AutomationPage /> },
        { path: 'captions', element: <CaptionsPage /> },
        { path: 'analytics', element: <AnalyticsPage /> },
        { path: 'settings', element: <SettingsPage /> },
        { path: '*', element: <NotFoundPage /> },
      ],
    },
  ]);
}
