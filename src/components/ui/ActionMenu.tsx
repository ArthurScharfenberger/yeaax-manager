import { type LucideIcon, MoreHorizontal } from 'lucide-react';
import { type KeyboardEvent, type ToggleEvent, useId, useRef, useState } from 'react';

import { cn } from '@/utils/cn';

export interface MenuAction {
  label: string;
  icon?: LucideIcon;
  onSelect: () => void;
  tone?: 'danger';
  disabled?: boolean;
}

export type MenuItem = MenuAction | 'separator';

interface ActionMenuProps {
  items: readonly MenuItem[];
  /** Rótulo acessível do botão. */
  label?: string;
  size?: 'sm' | 'md';
}

const GAP_PX = 4;

/**
 * Menu de ações ("⋯") com a Popover API nativa: fecha com Esc e clique fora, fica na
 * camada superior (inclusive sobre modais). Navegação por setas, Home/End e Tab.
 */
export function ActionMenu({ items, label = 'Mais ações', size = 'sm' }: ActionMenuProps) {
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  function enabledItems(): HTMLButtonElement[] {
    return Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ??
        [],
    );
  }

  function handleBeforeToggle(event: ToggleEvent<HTMLDivElement>) {
    const menu = menuRef.current;
    const trigger = triggerRef.current;
    if (event.newState !== 'open' || !menu || !trigger) return;
    const rect = trigger.getBoundingClientRect();
    menu.style.top = `${rect.bottom + GAP_PX}px`;
    menu.style.right = `${window.innerWidth - rect.right}px`;
  }

  function handleToggle(event: ToggleEvent<HTMLDivElement>) {
    const isOpen = event.newState === 'open';
    setOpen(isOpen);
    const menu = menuRef.current;
    const trigger = triggerRef.current;
    if (!isOpen || !menu || !trigger) return;

    // Abre para cima se não couber abaixo.
    const rect = trigger.getBoundingClientRect();
    if (rect.bottom + GAP_PX + menu.offsetHeight > window.innerHeight) {
      menu.style.top = `${Math.max(GAP_PX, rect.top - GAP_PX - menu.offsetHeight)}px`;
    }
    enabledItems()[0]?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const elements = enabledItems();
    const index = elements.indexOf(document.activeElement as HTMLButtonElement);
    const focusAt = (next: number) => elements[(next + elements.length) % elements.length]?.focus();

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        focusAt(index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        focusAt(index - 1);
        break;
      case 'Home':
        event.preventDefault();
        focusAt(0);
        break;
      case 'End':
        event.preventDefault();
        focusAt(elements.length - 1);
        break;
      case 'Tab':
        menuRef.current?.hidePopover();
        break;
    }
  }

  function select(action: MenuAction) {
    menuRef.current?.hidePopover();
    triggerRef.current?.focus();
    action.onSelect();
  }

  return (
    // O menu fica dentro de linhas clicáveis: impede que o clique "vaze" para a linha.
    <span className="inline-flex" onClick={(event) => event.stopPropagation()}>
      <button
        ref={triggerRef}
        type="button"
        popoverTarget={menuId}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        className={cn(
          'inline-flex items-center justify-center rounded text-ink-3 transition-colors hover:bg-hover hover:text-ink',
          open && 'bg-pressed text-ink',
          size === 'sm' ? 'size-7' : 'size-8',
        )}
      >
        <MoreHorizontal size={16} aria-hidden />
      </button>
      <div
        ref={menuRef}
        id={menuId}
        popover="auto"
        role="menu"
        aria-label={label}
        onBeforeToggle={handleBeforeToggle}
        onToggle={handleToggle}
        onKeyDown={handleKeyDown}
        className="fixed min-w-44 rounded-md border border-line bg-canvas p-1 shadow-overlay"
      >
        {items.map((item, index) =>
          item === 'separator' ? (
            <div key={`separator-${index}`} role="separator" className="my-1 h-px bg-line" />
          ) : (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              disabled={item.disabled}
              onClick={() => select(item)}
              className={cn(
                'flex h-8 w-full items-center gap-2 rounded-sm px-2 text-left text-sm whitespace-nowrap',
                'hover:bg-hover focus-visible:bg-hover focus-visible:outline-none disabled:opacity-40',
                item.tone === 'danger' ? 'text-danger' : 'text-ink',
              )}
            >
              {item.icon && <item.icon size={14} aria-hidden className="shrink-0" />}
              {item.label}
            </button>
          ),
        )}
      </div>
    </span>
  );
}
