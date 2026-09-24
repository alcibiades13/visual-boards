import { useEffect, useId, useRef, useState, type ReactNode } from 'react';

export interface MenuItem {
  label: string;
  onSelect(): void;
  danger?: boolean;
}

interface MenuProps {
  /** Renders the trigger; spread the props onto a <button>. */
  trigger(props: {
    'aria-haspopup': 'menu';
    'aria-expanded': boolean;
    'aria-controls': string;
    onClick(): void;
  }): ReactNode;
  items: MenuItem[];
  align?: 'left' | 'right';
}

/** A small dropdown menu: click or tap to open, Esc or outside click to close, arrow keys to move. */
export function Menu({ trigger, items, align = 'right' }: MenuProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const entries = Array.from(list.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
    const index = entries.indexOf(document.activeElement as HTMLElement);
    if (e.key === 'Escape') {
      e.stopPropagation();
      setOpen(false);
      root.current?.querySelector<HTMLElement>('[aria-haspopup]')?.focus();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = (index + (e.key === 'ArrowDown' ? 1 : -1) + entries.length) % entries.length;
      entries[next]?.focus();
    }
  };

  return (
    <div ref={root} className="relative" onKeyDown={onKeyDown}>
      {trigger({ 'aria-haspopup': 'menu', 'aria-expanded': open, 'aria-controls': id, onClick: () => setOpen((o) => !o) })}
      {open && (
        <div
          ref={list}
          id={id}
          role="menu"
          className={`absolute top-full z-30 mt-1 min-w-44 rounded-lg border border-line bg-surface p-1 shadow-lifted ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onSelect();
              }}
              className={`flex w-full items-center rounded-md px-3 py-2 text-left text-sm hover:bg-surface-2 focus:bg-surface-2 focus:outline-none ${item.danger ? 'text-danger' : 'text-ink'}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
