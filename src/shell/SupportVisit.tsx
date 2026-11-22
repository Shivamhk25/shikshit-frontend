import { useEffect, useState } from 'react';
import { Eye, ShieldCheck } from 'lucide-react';
import { redeemSupportVisit, type Session } from '@shikshit/shared/session';
import { Logo } from '../design-system';
import { API_BASE } from './web-session';
import { ShellApp } from './ShellApp';

/**
 * A read-only support visit (SAD-05, decision 0018), opened from the platform console on the school's own address:
 * /support-visit?code=... The code is taken out of the address bar straight away, redeemed once, and the normal app
 * runs on the visit's session. The server refuses every change; the banner says who is visiting and why.
 */
export function SupportVisitApp({ fetchFn = (...a) => fetch(...a) }: { fetchFn?: typeof fetch }) {
  const [state, setState] = useState<{ kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'open'; session: Session } | { kind: 'ended' }>({ kind: 'loading' });

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('code') ?? '';
    // never leave the code in the address bar or the history
    window.history.replaceState(null, '', '/');
    if (!code) {
      setState({ kind: 'error', message: 'This visit link has no code. Start a new visit from the console.' });
      return;
    }
    void redeemSupportVisit({ baseUrl: API_BASE, fetchFn, client: { name: 'web', version: '0.1.0' } }, code).then((r) => {
      if (!r.ok) return setState({ kind: 'error', message: r.message });
      r.session.onStatus((s) => s === 'signedOut' && setState({ kind: 'ended' }));
      setState({ kind: 'open', session: r.session });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (state.kind === 'open') return <ShellApp session={state.session} />;
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-6">
      <div role={state.kind === 'loading' ? 'status' : 'alert'} className="w-full max-w-md space-y-5 rounded-xl border border-line-subtle bg-surface p-8 text-center shadow-card">
        <Logo size={32} />
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-subtle text-fg-muted">
          {state.kind === 'ended' ? <ShieldCheck aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}
        </span>
        <h1 className="font-display text-2xl font-semibold text-fg">
          {state.kind === 'loading' ? 'Opening the support visit…' : state.kind === 'ended' ? 'The support visit has ended' : 'This visit cannot be opened'}
        </h1>
        <p className="text-sm text-fg-muted">
          {state.kind === 'loading'
            ? 'One moment.'
            : state.kind === 'ended'
              ? 'Nothing was changed. You can close this tab.'
              : state.message}
        </p>
      </div>
    </div>
  );
}
