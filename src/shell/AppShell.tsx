import { useMemo } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { buildNavigation, type NavNode } from '@shikshit/shared/access';
import { Button, ThemeProvider } from '../design-system';
import { useAccessState } from './AccessProvider';
import { useAuth } from './AuthProvider';
import { registry } from './registry';

const CLIENT = { name: 'web', version: '0.1.0' } as const;

function NavItems({ nodes }: { nodes: NavNode[] }) {
  return (
    <ul className="space-y-1">
      {nodes.map((n) => (
        <li key={n.screenId}>
          {n.target ? (
            <NavLink
              to={n.target}
              end={n.target === '/'}
              className={({ isActive }) =>
                `block rounded-md px-3 py-2 text-sm ${isActive ? 'bg-accent-subtle font-medium text-accent-fg' : 'text-fg-muted hover:bg-subtle hover:text-fg'}`
              }
            >
              {n.label}
            </NavLink>
          ) : (
            <span className="block px-3 py-2 text-xs font-medium uppercase tracking-wide text-fg-subtle">{n.label}</span>
          )}
          {n.children.length > 0 ? (
            <div className="ml-3">
              <NavItems nodes={n.children} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Sign-in gate and layout. Navigation comes from the server's access payload, filtered by what this build can render. */
export function AppShell() {
  const access = useAccessState();
  const { signOut } = useAuth();

  const nav = useMemo(
    () => (access.phase === 'ready' ? buildNavigation(access.access, access.payload.workspace.navigation, registry, CLIENT) : []),
    [access],
  );

  if (access.phase === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-fg-muted" role="status">
        Loading your workspace…
      </div>
    );
  }
  if (access.phase === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-canvas">
        <p className="text-fg">We could not load your workspace.</p>
        <Button onClick={access.retry}>Try again</Button>
      </div>
    );
  }

  const { payload } = access;
  return (
    <ThemeProvider accent={payload.tenant?.brand.primary}>
      <div className="flex min-h-screen bg-canvas text-fg">
        <aside className="hidden w-60 shrink-0 border-r border-line bg-surface p-4 md:block" aria-label="Main navigation">
          <p className="mb-4 px-3 text-sm font-semibold">{payload.tenant?.name ?? 'Shikshit'}</p>
          <nav>
            <NavItems nodes={nav} />
          </nav>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between border-b border-line bg-surface px-6 py-3">
            <span className="text-sm text-fg-muted">{payload.user.name}</span>
            <Button variant="secondary" size="sm" onClick={() => void signOut()}>
              Sign out
            </Button>
          </header>
          <main className="flex-1 p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}
