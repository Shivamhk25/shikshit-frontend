import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Circle, LogOut, Menu, X } from 'lucide-react';
import { buildNavigation, type NavNode } from '@shikshit/shared/access';
import { Button, Logo, ThemeProvider, cx } from '../design-system';
import { useAccessState } from './AccessProvider';
import { useAuth } from './AuthProvider';
import { NAV_ICONS } from './navIcons';
import { registry } from './registry';

const CLIENT = { name: 'web', version: '0.1.0' } as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : '')).toUpperCase() || '?';
}

function NavItems({ nodes, depth = 0 }: { nodes: NavNode[]; depth?: number }) {
  return (
    <ul className={cx('space-y-0.5', depth > 0 && 'mt-0.5')}>
      {nodes.map((n) => {
        const Icon = NAV_ICONS[n.screenId] ?? Circle;
        return (
          <li key={n.screenId}>
            {n.target ? (
              <NavLink
                to={n.target}
                end={n.target === '/'}
                className={({ isActive }) =>
                  cx(
                    'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors duration-150',
                    isActive ? 'bg-white/10 font-medium text-white' : 'text-white/65 hover:bg-white/5 hover:text-white',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <span aria-hidden="true" className={cx('absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand-gold transition-opacity', isActive ? 'opacity-100' : 'opacity-0')} />
                    <Icon aria-hidden="true" className={cx('size-4 shrink-0', isActive ? 'text-brand-gold-soft' : 'text-white/45 group-hover:text-white/75')} />
                    <span className="truncate">{n.label}</span>
                  </>
                )}
              </NavLink>
            ) : (
              <span className="mt-5 block px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">{n.label}</span>
            )}
            {n.children.length > 0 ? <NavItems nodes={n.children} depth={depth + 1} /> : null}
          </li>
        );
      })}
    </ul>
  );
}

function Sidebar({ nav, tenantName, userName, onSignOut }: { nav: NavNode[]; tenantName: string; userName: string; onSignOut: () => void }) {
  return (
    <div className="flex h-full flex-col bg-brand-ink text-white" style={{ backgroundImage: 'radial-gradient(140% 50% at 0% 0%, rgba(184,147,90,0.10), transparent 60%)' }}>
      <div className="px-5 pb-6 pt-6">
        <Logo tone="light" size={32} />
        <p className="mt-4 truncate border-t border-white/10 pt-4 text-xs font-medium uppercase tracking-[0.12em] text-white/50">{tenantName}</p>
      </div>
      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-3 pb-6">
        <NavItems nodes={nav} />
      </nav>
      <div className="flex items-center gap-3 border-t border-white/10 px-4 py-4">
        <span aria-hidden="true" className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand-gold-soft text-xs font-semibold text-brand-ink-deep">
          {initials(userName)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{userName}</span>
          <span className="block truncate text-xs text-white/50">Signed in</span>
        </span>
        <button
          type="button"
          onClick={onSignOut}
          className="flex size-9 items-center justify-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut aria-hidden="true" className="size-4" />
        </button>
      </div>
    </div>
  );
}

/** Sign-in gate and layout. Navigation comes from the server's access payload, filtered by what this build can render. */
export function AppShell() {
  const access = useAccessState();
  const { signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  useEffect(() => setMenuOpen(false), [location.pathname]);

  const nav = useMemo(
    () => (access.phase === 'ready' ? buildNavigation(access.access, access.payload.workspace.navigation, registry, CLIENT) : []),
    [access],
  );

  if (access.phase === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-canvas" role="status">
        <Logo size={40} />
        <p className="text-sm text-fg-muted">Loading your workspace…</p>
      </div>
    );
  }
  if (access.phase === 'error') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-canvas px-6 text-center">
        <Logo size={40} />
        <p className="text-fg">We could not load your workspace.</p>
        <Button onClick={access.retry}>Try again</Button>
      </div>
    );
  }

  const { payload } = access;
  const tenantName = payload.tenant?.name ?? 'Shikshit';
  const sidebar = <Sidebar nav={nav} tenantName={tenantName} userName={payload.user.name} onSignOut={() => void signOut()} />;
  return (
    <ThemeProvider accent={payload.tenant?.brand.primary}>
      <div className="min-h-screen bg-canvas text-fg">
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>
        {menuOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div className="absolute inset-0 bg-overlay" onClick={() => setMenuOpen(false)} aria-hidden="true" />
            <div className="relative h-full w-72 max-w-[85%] shadow-float">{sidebar}</div>
          </div>
        ) : null}
        <div className="flex min-h-screen flex-col lg:pl-64">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-line-subtle bg-canvas/85 px-4 backdrop-blur-sm sm:px-8 lg:hidden">
            <button type="button" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} className="flex size-9 items-center justify-center rounded-md text-fg-muted hover:bg-subtle hover:text-fg">
              {menuOpen ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
            </button>
            <Logo size={28} />
          </header>
          <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-8 lg:px-12 lg:py-12">
            <Outlet />
          </main>
        </div>
      </div>
    </ThemeProvider>
  );
}
