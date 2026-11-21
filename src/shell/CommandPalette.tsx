import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Command } from 'cmdk';
import * as D from '@radix-ui/react-dialog';
import { Circle, LogOut, Search } from 'lucide-react';
import type { NavNode } from '@shikshit/shared/access';
import { NAV_BLURBS, NAV_ICONS } from './navIcons';
import { isPaletteShortcut } from './shortcuts';

function flatten(nodes: NavNode[]): NavNode[] {
  return nodes.flatMap((n) => [...(n.target ? [n] : []), ...flatten(n.children)]);
}

/**
 * Jump to any screen by typing its name. Only screens the person may open are listed (the same navigation the
 * sidebar shows), so the palette never offers a dead end.
 */
export function CommandPalette({ nav, open, onOpenChange, onSignOut }: { nav: NavNode[]; open: boolean; onOpenChange: (o: boolean) => void; onSignOut: () => void }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isPaletteShortcut(e)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);
  useEffect(() => {
    if (!open) setQ('');
  }, [open]);

  const go = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };
  const items = flatten(nav);
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-40 bg-overlay backdrop-blur-[2px]" />
        <D.Content className="fixed left-1/2 top-[14vh] z-50 w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-xl border border-line-subtle bg-surface shadow-float outline-none">
          <D.Title className="sr-only">Go to a page</D.Title>
          <D.Description className="sr-only">Type the name of a page, then press Enter.</D.Description>
          <Command label="Go to a page" loop>
            <div className="flex items-center gap-3 border-b border-line-subtle px-4">
              <Search aria-hidden="true" className="size-4 text-fg-subtle" />
              <Command.Input value={q} onValueChange={setQ} placeholder="Go to a page…" className="h-14 flex-1 bg-transparent text-md text-fg outline-none placeholder:text-fg-subtle" />
              <kbd className="rounded border border-line px-1.5 py-0.5 text-[11px] text-fg-subtle">Esc</kbd>
            </div>
            <Command.List className="max-h-[50vh] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-8 text-center text-sm text-fg-muted">No page matches “{q}”.</Command.Empty>
              <Command.Group heading="Pages" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.12em] [&_[cmdk-group-heading]]:text-fg-subtle">
                {items.map((n) => {
                  const Icon = NAV_ICONS[n.screenId] ?? Circle;
                  return (
                    <Command.Item
                      key={n.screenId}
                      value={`${n.label} ${NAV_BLURBS[n.screenId] ?? ''}`}
                      onSelect={() => go(n.target ?? '/')}
                      className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm text-fg data-[selected=true]:bg-accent-subtle data-[selected=true]:text-accent-fg"
                    >
                      <Icon aria-hidden="true" className="size-4 shrink-0 text-fg-subtle" />
                      <span className="font-medium">{n.label}</span>
                      {NAV_BLURBS[n.screenId] ? <span className="truncate text-fg-subtle">{NAV_BLURBS[n.screenId]}</span> : null}
                    </Command.Item>
                  );
                })}
              </Command.Group>
              <Command.Group heading="Account" className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.12em] [&_[cmdk-group-heading]]:text-fg-subtle">
                <Command.Item
                  value="Sign out log out"
                  onSelect={() => {
                    onOpenChange(false);
                    onSignOut();
                  }}
                  className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2.5 text-sm text-fg data-[selected=true]:bg-accent-subtle data-[selected=true]:text-accent-fg"
                >
                  <LogOut aria-hidden="true" className="size-4 text-fg-subtle" />
                  <span className="font-medium">Sign out of Shikshit</span>
                </Command.Item>
              </Command.Group>
            </Command.List>
          </Command>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
