import { useMemo, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, Circle, Monitor, Moon, ShieldOff, Sun } from 'lucide-react';
import { THEME_MODE_LABELS, THEME_MODES, type ThemeMode } from '@shikshit/shared/tokens';
import { buildNavigation, type NavNode } from '@shikshit/shared/access';
import { Card, PageHeader, cx, useTheme } from '../design-system';
import { useAccessState } from './AccessProvider';
import { NAV_BLURBS, NAV_ICONS } from './navIcons';
import { permissionForPath, registry } from './registry';
import { ImportWorkspace } from '../features/onboarding/ImportWorkspace';
import { TwoStepCard } from './mfa';

const CLIENT = { name: 'web', version: '0.1.0' } as const;

function flatten(nodes: NavNode[]): NavNode[] {
  return nodes.flatMap((n) => [...(n.target ? [n] : []), ...flatten(n.children)]);
}

function greeting(now: Date): string {
  const h = now.getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function HomePage() {
  const a = useAccessState();
  const destinations = useMemo(
    () => (a.phase === 'ready' ? flatten(buildNavigation(a.access, a.payload.workspace.navigation, registry, CLIENT)).filter((n) => n.screenId !== 'home' && n.screenId !== 'profile') : []),
    [a],
  );
  if (a.phase !== 'ready') return null;
  const now = new Date();
  const name = a.payload.user.name;
  return (
    <section className="space-y-10">
      <PageHeader
        eyebrow={`${greeting(now)} · ${now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}`}
        title={name ? `Welcome, ${name}` : 'Welcome'}
        description={a.payload.tenant ? `${a.payload.tenant.name}. Everything you look after is one click away.` : 'Everything you look after is one click away.'}
      />
      {destinations.length === 0 ? (
        <Card className="p-8 text-sm text-fg-muted">Your tools will appear here as your school turns them on.</Card>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {destinations.map((n) => {
            const Icon = NAV_ICONS[n.screenId] ?? Circle;
            return (
              <li key={n.screenId}>
                <Link to={n.target ?? "/"} className="group block h-full rounded-lg border border-line-subtle bg-surface p-5 shadow-soft transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-line hover:shadow-card">
                  <span className="flex items-start justify-between">
                    <span className="flex size-10 items-center justify-center rounded-md bg-accent-subtle text-accent-fg">
                      <Icon aria-hidden="true" className="size-5" />
                    </span>
                    <ArrowUpRight aria-hidden="true" className="size-4 text-fg-subtle transition-colors group-hover:text-accent-fg" />
                  </span>
                  <span className="mt-4 block font-display text-lg font-semibold text-fg">{n.label}</span>
                  {NAV_BLURBS[n.screenId] ? <span className="mt-1 block text-sm text-fg-muted">{NAV_BLURBS[n.screenId]}</span> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function ProfilePage() {
  const a = useAccessState();
  if (a.phase !== 'ready') return null;
  return (
    <section className="space-y-8">
      <PageHeader eyebrow="Your account" title={a.payload.user.name} description={a.payload.tenant?.name} />
      <ThemeModeCard />
      <TwoStepCard />
    </section>
  );
}

const MODE_ICONS: Record<ThemeMode, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

/** Light, dark or the device's setting: each person's own choice (decision 0005), saved to their account. */
function ThemeModeCard() {
  const { choice, setChoice } = useTheme();
  return (
    <Card className="max-w-2xl space-y-4 p-6">
      <div>
        <h2 id="mode-heading" className="font-display text-lg font-semibold text-fg">Light or dark</h2>
        <p className="text-sm text-fg-muted">How Shikshit looks for you, on every device you sign in on.</p>
      </div>
      <div role="radiogroup" aria-labelledby="mode-heading" className="inline-flex flex-wrap gap-1 rounded-lg border border-line-subtle bg-canvas p-1">
        {THEME_MODES.map((m) => {
          const Icon = MODE_ICONS[m];
          const selected = choice === m;
          return (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setChoice(m)}
              className={cx(
                'flex items-center gap-2 rounded-md px-3.5 py-2 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle',
                selected ? 'bg-surface font-medium text-fg shadow-soft' : 'text-fg-muted hover:text-fg',
              )}
            >
              <Icon aria-hidden="true" className="size-4" />
              {THEME_MODE_LABELS[m]}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

export function OnboardingPage() {
  const a = useAccessState();
  if (a.phase === 'ready' && a.access.can('onb.imports.view')) return <ImportWorkspace />;
  return (
    <section className="space-y-8">
      <PageHeader eyebrow="Setup" title="Onboarding" description="Data onboarding tasks will appear here." />
    </section>
  );
}

export function NotAvailablePage() {
  return (
    <section role="alert" className="mx-auto mt-16 max-w-md text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-subtle text-fg-muted">
        <ShieldOff aria-hidden="true" className="size-5" />
      </span>
      <h1 className="mt-5 font-display text-2xl font-semibold text-fg">Not available</h1>
      <p className="mt-2 text-sm text-fg-muted">This page is not available to you. If you think it should be, ask your school administrator.</p>
    </section>
  );
}

/**
 * Renders children only when the user holds the permission the registry requires for this path. The server checks
 * every request again; this only keeps people from landing on screens that would show nothing.
 */
export function RequirePermission({ path, children }: { path: string; children: ReactNode }) {
  const a = useAccessState();
  if (a.phase !== 'ready') return null;
  const needed = permissionForPath(path);
  if (needed && !a.access.can(needed)) return <NotAvailablePage />;
  return <>{children}</>;
}
