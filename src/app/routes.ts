import {
  BarChart3,
  CalendarDays,
  Clapperboard,
  LayoutDashboard,
  type LucideIcon,
  PenLine,
  Settings,
  Users,
  Workflow,
} from 'lucide-react';

/** Caminhos das páginas (HashRouter). Use sempre estas constantes em links e navegação. */
export const ROUTES = {
  dashboard: '/',
  channels: '/channels',
  library: '/library',
  calendar: '/calendar',
  automation: '/automation',
  captions: '/captions',
  analytics: '/analytics',
  settings: '/settings',
} as const;

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const PRIMARY_NAV: readonly NavItem[] = [
  { to: ROUTES.dashboard, label: 'Dashboard', icon: LayoutDashboard },
  { to: ROUTES.channels, label: 'Canais', icon: Users },
  { to: ROUTES.library, label: 'Biblioteca', icon: Clapperboard },
  { to: ROUTES.calendar, label: 'Calendário', icon: CalendarDays },
  { to: ROUTES.automation, label: 'Automação', icon: Workflow },
  { to: ROUTES.captions, label: 'Legendas IA', icon: PenLine },
  { to: ROUTES.analytics, label: 'Analytics', icon: BarChart3 },
];

export const SECONDARY_NAV: readonly NavItem[] = [
  { to: ROUTES.settings, label: 'Configurações', icon: Settings },
];
