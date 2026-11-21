import type { ReactNode } from 'react';
import { useAccessState } from './AccessProvider';
import { permissionForPath } from './registry';
import { ImportWorkspace } from '../features/onboarding/ImportWorkspace';

export function HomePage() {
  const a = useAccessState();
  const name = a.phase === 'ready' ? a.payload.user.name : '';
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold text-fg">{name ? `Welcome, ${name}` : 'Welcome'}</h1>
      <p className="text-fg-muted">Your tools will appear here as your school turns them on.</p>
    </section>
  );
}

export function ProfilePage() {
  const a = useAccessState();
  if (a.phase !== 'ready') return null;
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold text-fg">{a.payload.user.name}</h1>
      {a.payload.tenant ? <p className="text-fg-muted">{a.payload.tenant.name}</p> : null}
    </section>
  );
}

export function OnboardingPage() {
  const a = useAccessState();
  if (a.phase === 'ready' && a.access.can('onb.imports.view')) return <ImportWorkspace />;
  return (
    <section className="space-y-2">
      <h1 className="text-2xl font-semibold text-fg">Onboarding</h1>
      <p className="text-fg-muted">Data onboarding tasks will appear here.</p>
    </section>
  );
}

export function NotAvailablePage() {
  return (
    <section className="space-y-2" role="alert">
      <h1 className="text-2xl font-semibold text-fg">Not available</h1>
      <p className="text-fg-muted">This page is not available to you. If you think it should be, ask your school administrator.</p>
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
