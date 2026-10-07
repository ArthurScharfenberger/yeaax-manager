import { NavLink } from 'react-router';

import { APP_NAME, APP_VERSION } from '@/lib/runtime';
import { cn } from '@/utils/cn';

import { type NavItem, PRIMARY_NAV, ROUTES, SECONDARY_NAV } from '../routes';
import { useServices } from '../ServicesContext';

function AppMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-6 shrink-0" aria-hidden>
      <rect width="24" height="24" rx="5" fill="var(--color-accent)" />
      <rect x="5.5" y="6.5" width="13" height="2.4" rx="1.2" fill="#fff" />
      <rect x="5.5" y="10.8" width="10" height="2.4" rx="1.2" fill="#fff" fillOpacity="0.82" />
      <rect x="5.5" y="15.1" width="7" height="2.4" rx="1.2" fill="#fff" fillOpacity="0.64" />
    </svg>
  );
}

function SidebarLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <li>
      <NavLink
        to={item.to}
        end={item.to === ROUTES.dashboard}
        className={({ isActive }) =>
          cn(
            'group flex h-8 items-center gap-2.5 rounded px-2.5 text-sm transition-colors select-none',
            isActive
              ? 'bg-pressed font-medium text-ink'
              : 'text-ink-2 hover:bg-hover hover:text-ink',
          )
        }
      >
        {({ isActive }) => (
          <>
            <Icon
              size={16}
              aria-hidden
              className={isActive ? 'text-accent' : 'text-ink-3 group-hover:text-ink-2'}
            />
            {item.label}
          </>
        )}
      </NavLink>
    </li>
  );
}

export function Sidebar() {
  const { mode } = useServices();

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-line bg-sunken">
      <div className="flex h-14 items-center gap-2.5 border-b border-line px-4">
        <AppMark />
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-semibold text-ink">{APP_NAME}</p>
          <p className="text-2xs text-ink-3 tabular">v{APP_VERSION}</p>
        </div>
      </div>

      <nav aria-label="Navegação principal" className="flex flex-1 flex-col justify-between p-2">
        <ul className="flex flex-col gap-0.5">
          {PRIMARY_NAV.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </ul>
        <ul className="flex flex-col gap-0.5">
          {SECONDARY_NAV.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </ul>
      </nav>

      <div className="flex items-center gap-2 border-t border-line px-4 py-3 text-2xs text-ink-3">
        <span
          aria-hidden
          className={cn('size-1.5 rounded-full', mode === 'desktop' ? 'bg-success' : 'bg-warning')}
        />
        {mode === 'desktop' ? 'Local · SQLite' : 'Preview · dados em memória'}
      </div>
    </aside>
  );
}
