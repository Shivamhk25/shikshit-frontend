import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, CircleAlert, Rocket } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, PageHeader, Sheet, cx } from '../../design-system';
import { useAccessState } from '../../shell/AccessProvider';
import { useAuth } from '../../shell/AuthProvider';
import { formatDateTime } from '../adm/dates';
import { createGoLiveApi, domainVerdict, GoLiveError, type GoLiveGate } from './goLive';

const STATUS_TEXT: Record<string, string> = { onboarding: 'Onboarding', live: 'Live', suspended: 'Suspended', archived: 'Archived' };

function ActionSheet({ title, label, field, required, confirm, onClose, onDone }: { title: string; label: string; field: string; required: boolean; confirm: string; onClose: () => void; onDone: (text: string) => Promise<void> }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const submit = async () => {
    setBusy(true);
    setFailure('');
    try {
      await onDone(text.trim());
    } catch (e) {
      setFailure(e instanceof GoLiveError ? e.message : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title={title}>
      <div className="space-y-4">
        <label className="block space-y-1.5 text-sm font-medium text-fg">
          {label}
          <textarea
            name={field}
            value={text}
            maxLength={2000}
            rows={4}
            onChange={(e) => setText(e.target.value)}
            className="block w-full rounded-md border border-line bg-surface p-3 text-sm text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
          />
        </label>
        {failure ? (
          <p role="alert" className="rounded-md border border-danger-line bg-danger-bg p-3 text-sm text-danger">
            {failure}
          </p>
        ) : null}
        <Button disabled={busy || (required && text.trim() === '')} onClick={() => void submit()}>
          {confirm}
        </Button>
      </div>
    </Sheet>
  );
}

/** ONB-23 Go-live gate: every domain must be ready; the Admin or Principal signs off, or revokes the sign-off. */
export function GoLivePage() {
  const { session } = useAuth();
  const api = useMemo(() => createGoLiveApi(session), [session]);
  const access = useAccessState();
  const can = (p: string) => access.phase === 'ready' && access.access.can(p);
  const canView = can('onb.golive.view');
  const canSign = can('onb.golive.signoff');

  const [gate, setGate] = useState<GoLiveGate | null>(null);
  const [load, setLoad] = useState<'loading' | 'ready' | 'error' | 'denied'>('loading');
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState<'sign' | 'revoke' | null>(null);
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++latest.current;
    setLoad('loading');
    try {
      const g = await api.get();
      if (mine !== latest.current) return;
      setGate(g);
      setLoad('ready');
    } catch (e) {
      if (mine !== latest.current) return;
      setError(e instanceof GoLiveError ? e.message : 'Something went wrong. Please try again.');
      setLoad(e instanceof GoLiveError && e.status === 403 ? 'denied' : 'error');
    }
  }, [api]);
  useEffect(() => {
    if (access.phase === 'ready' && canView) void reload();
  }, [reload, access.phase, canView]);

  if (access.phase !== 'ready') return null;
  const live = gate?.tenantStatus === 'live';

  return (
    <section className="space-y-6">
      <PageHeader title="Go-live" description="Every part of your data must be ready before the school goes live." />
      {!canView || load === 'denied' ? (
        <div role="alert" className="rounded-lg border border-line bg-surface p-6 shadow-soft">
          <p className="font-medium text-fg">You do not have access to the go-live gate.</p>
          <p className="mt-1 text-sm text-fg-muted">Ask an administrator for the “view go-live” permission.</p>
        </div>
      ) : load === 'error' ? (
        <div role="alert" className="space-y-3 rounded-lg border border-danger-line bg-surface p-6 shadow-soft">
          <p className="text-fg">{error}</p>
          <Button variant="secondary" onClick={() => void reload()}>
            Try again
          </Button>
        </div>
      ) : load === 'loading' && !gate ? (
        <p role="status" className="py-16 text-center text-fg-muted">
          Loading…
        </p>
      ) : gate ? (
        <>
          <Card className="space-y-3 p-5">
            <p className="text-sm text-fg-muted">
              Status: <span className="font-semibold text-fg">{STATUS_TEXT[gate.tenantStatus] ?? gate.tenantStatus}</span>
            </p>
            {live && gate.active ? (
              <p className="text-sm text-fg">
                Signed off by {gate.active.signedByName || 'an administrator'} on {formatDateTime(gate.active.signedAt)}.
                {gate.active.notes ? ` Notes: ${gate.active.notes}` : ''}
              </p>
            ) : gate.open ? (
              <p className="flex items-center gap-1.5 text-sm text-success">
                <CheckCircle2 aria-hidden="true" className="size-4" /> Every part is ready. You can go live.
              </p>
            ) : (
              <div role="status" className="space-y-1">
                <p className="flex items-center gap-1.5 text-sm font-medium text-warning">
                  <CircleAlert aria-hidden="true" className="size-4" /> Go-live is blocked
                </p>
                <ul className="list-disc pl-6 text-sm text-fg-muted">
                  {gate.reasons.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
            {canSign ? (
              <div className="flex gap-3 pt-1">
                {gate.tenantStatus === 'onboarding' ? (
                  <Button disabled={!gate.open} onClick={() => setSheet('sign')}>
                    <Rocket aria-hidden="true" className="mr-1.5 size-4" /> Sign off and go live
                  </Button>
                ) : null}
                {live && gate.active ? (
                  <Button variant="secondary" onClick={() => setSheet('revoke')}>
                    Revoke sign-off
                  </Button>
                ) : null}
              </div>
            ) : null}
          </Card>

          <section aria-labelledby="golive-domains" className="space-y-2">
            <h2 id="golive-domains" className="text-sm font-semibold text-fg">
              Checklist
            </h2>
            <ul className="divide-y divide-line-subtle rounded-lg border border-line bg-surface shadow-soft">
              {gate.domains.map((d) => (
                <li key={d.id} data-testid={`golive-${d.id}`} className="flex items-center justify-between gap-4 p-4">
                  <span className="font-medium text-fg">{d.title}</span>
                  <span className={cx('text-sm', d.ready ? 'text-success' : 'text-warning')}>{domainVerdict(d)}</span>
                </li>
              ))}
            </ul>
          </section>

          {gate.history.length > 0 ? (
            <section aria-labelledby="golive-history" className="space-y-2">
              <h2 id="golive-history" className="text-sm font-semibold text-fg">
                Sign-offs so far
              </h2>
              <ul className="space-y-2 text-sm text-fg-muted">
                {gate.history.map((h) => (
                  <li key={h.id}>
                    {formatDateTime(h.signedAt)} by {h.signedByName || 'an administrator'}
                    {h.revokedAt ? `, revoked ${formatDateTime(h.revokedAt)}${h.revokeReason ? `: ${h.revokeReason}` : ''}` : ', active'}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}

      {sheet === 'sign' ? (
        <ActionSheet
          title="Sign off and go live"
          label="Notes (optional)"
          field="notes"
          required={false}
          confirm="Confirm go-live"
          onClose={() => setSheet(null)}
          onDone={async (t) => {
            await api.signOff(t);
            toast.success('The school is live.');
            setSheet(null);
            await reload();
          }}
        />
      ) : null}
      {sheet === 'revoke' ? (
        <ActionSheet
          title="Revoke sign-off"
          label="Reason"
          field="reason"
          required
          confirm="Revoke and return to onboarding"
          onClose={() => setSheet(null)}
          onDone={async (t) => {
            await api.revoke(t);
            toast.success('Sign-off revoked.');
            setSheet(null);
            await reload();
          }}
        />
      ) : null}
    </section>
  );
}
