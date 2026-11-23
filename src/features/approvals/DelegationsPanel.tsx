import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowRightLeft, HandHelping, Inbox, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, ConfirmDialog, Sheet, cx } from '../../design-system';
import { ApiError } from '../../crud/client';
import { SearchPicker } from '../../crud/SearchPicker';
import { createUsersApi } from '../iam/usersApi';
import { useAccessState } from '../../shell/AccessProvider';
import { useAuth } from '../../shell/AuthProvider';
import { API_BASE } from '../../shell/web-session';
import type { ApprovalsApi, Delegation, DelegationInput } from './approvalsApi';
import { DELEGATION_LABEL, DELEGATION_TONE, MAX_HANDOVER_DAYS, REASON_MAX, isCurrent, latestEnd, parseLocal, scopeText, toLocalInput, validateHandover, when, type HandoverErrors, type HandoverForm } from './logic';

export const NO_RIGHTS_MESSAGE = 'You can hand over approvals only when you can decide some yourself. Right now there is nothing you can decide, so there is nothing to hand over.';
export const NO_LOOKUP_MESSAGE = 'Your account cannot look up colleagues yet. Ask an administrator to give you access to the user list, or to hand over for you.';

function StatusPill({ d }: { d: Delegation }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium', DELEGATION_TONE[d.status])}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {DELEGATION_LABEL[d.status]}
    </span>
  );
}

/** One handover: who, the period, the reason, and (for ones I gave that are still running) a way to end it now. */
function HandoverRow({ d, direction, onEnd }: { d: Delegation; direction: 'given' | 'received'; onEnd?: () => void }) {
  const who = direction === 'given' ? d.delegateName : d.delegatorName;
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 border-b border-line-subtle px-4 py-4 last:border-0 sm:px-5">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-medium text-fg">
            <span className="font-normal text-fg-muted">{direction === 'given' ? 'To ' : 'From '}</span>
            {who}
          </span>
          <StatusPill d={d} />
        </p>
        <p className="text-sm text-fg-muted">
          {when(d.startsAt)} to {when(d.endsAt)}
        </p>
        <p className="text-xs text-fg-subtle">
          {scopeText(d)}
          {d.status === 'ended' && d.endedAt ? ` · Ended ${when(d.endedAt)}` : ''}
        </p>
        {d.reason ? <p className="text-sm text-fg-muted">“{d.reason}”</p> : null}
      </div>
      {onEnd && isCurrent(d) ? (
        <Button variant="secondary" size="sm" onClick={onEnd} aria-label={`End handover to ${d.delegateName} now`}>
          End now
        </Button>
      ) : null}
    </li>
  );
}

function Group({ title, empty, items, direction, onEnd }: { title: string; empty: string; items: Delegation[]; direction: 'given' | 'received'; onEnd?: (d: Delegation) => void }) {
  const current = items.filter(isCurrent);
  const past = items.filter((d) => !isCurrent(d));
  const headId = useId();
  return (
    <section aria-labelledby={headId} className="space-y-3">
      <h2 id={headId} className="font-display text-xl font-semibold text-fg">
        {title}
      </h2>
      {items.length === 0 ? (
        <Card className="px-6 py-10 text-center">
          <span className="mx-auto flex size-11 items-center justify-center rounded-full bg-accent-subtle text-accent-fg">
            {direction === 'given' ? <ArrowRightLeft aria-hidden="true" className="size-5" /> : <Inbox aria-hidden="true" className="size-5" />}
          </span>
          <p className="mx-auto mt-3 max-w-sm text-sm text-fg-muted">{empty}</p>
        </Card>
      ) : (
        <Card>
          <ul aria-label={title}>
            {current.map((d) => (
              <HandoverRow key={d.id} d={d} direction={direction} onEnd={onEnd ? () => onEnd(d) : undefined} />
            ))}
          </ul>
          {past.length > 0 ? (
            <>
              <h3 className={cx('px-4 pb-1 pt-4 text-xs font-semibold uppercase tracking-[0.12em] text-fg-subtle sm:px-5', current.length > 0 && 'border-t border-line-subtle')}>Past</h3>
              <ul aria-label={`${title}, past`}>
                {past.map((d) => (
                  <HandoverRow key={d.id} d={d} direction={direction} />
                ))}
              </ul>
            </>
          ) : null}
        </Card>
      )}
    </section>
  );
}

const fieldClass = (bad: boolean) =>
  cx(
    'h-10 w-full rounded-md border bg-surface px-3 text-md text-fg shadow-soft hover:border-line-strong focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle',
    bad ? 'border-danger' : 'border-line',
  );

/**
 * The form to hand my approvals to a colleague. The colleague is found through the users list, which only people with
 * the user-list permission may read; without it the person is told so instead of seeing an empty picker. The limit to
 * some request types is left out because the server does not list the types yet.
 */
function HandoverSheet({ api, onClose, onCreated }: { api: ApprovalsApi; onClose: () => void; onCreated: () => void }) {
  const { session } = useAuth();
  const access = useAccessState();
  const me = access.phase === 'ready' ? access.payload.user.id : '';
  const canLookup = access.phase === 'ready' && access.access.can('iam.users.view');
  const users = useMemo(() => createUsersApi(session, API_BASE), [session]);
  const [form, setForm] = useState<HandoverForm>({ delegateId: '', startMode: 'now', startsAt: toLocalInput(new Date(Date.now() + 3_600_000)), endsAt: '', reason: '' });
  const [errors, setErrors] = useState<HandoverErrors>({});
  const [problem, setProblem] = useState('');
  const [busy, setBusy] = useState(false);
  const live = useRef(true);
  const ids = { start: useId(), end: useId(), reason: useId() };
  useEffect(() => {
    live.current = true;
    return () => void (live.current = false);
  }, []);

  const set = <K extends keyof HandoverForm>(k: K, v: HandoverForm[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const startBase = form.startMode === 'later' ? (parseLocal(form.startsAt) ?? new Date()) : new Date();
  const endHint = `At most ${MAX_HANDOVER_DAYS} days after the start (by ${latestEnd(startBase).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}).`;

  const submit = async () => {
    const found = validateHandover(form);
    setErrors(found);
    setProblem('');
    if (Object.keys(found).length > 0) return;
    const body: DelegationInput = {
      delegateId: form.delegateId,
      endsAt: (parseLocal(form.endsAt) as Date).toISOString(),
      ...(form.startMode === 'later' ? { startsAt: (parseLocal(form.startsAt) as Date).toISOString() } : {}),
      ...(form.reason.trim() ? { reason: form.reason.trim() } : {}),
    };
    setBusy(true);
    try {
      await api.delegate(body);
      if (!live.current) return;
      toast.success('Handover set. Your colleague has been told.');
      onCreated();
    } catch (e) {
      if (!live.current) return;
      if (e instanceof ApiError && e.status === 403) setProblem(e.code === 'read_only_visit' ? 'A support visit is read-only, so nothing can be handed over.' : NO_RIGHTS_MESSAGE);
      else if (e instanceof ApiError && e.status === 400) {
        const next: HandoverErrors = {};
        for (const k of ['delegateId', 'startsAt', 'endsAt', 'reason'] as const) if (e.fields[k]) next[k] = e.fields[k];
        setErrors(next);
        if (Object.keys(next).length === 0) setProblem(e.message);
      } else setProblem(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      if (live.current) setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onClose} title="Hand over my approvals" description="A colleague can decide what you could decide, at your scope, for the period you choose. You can still decide too.">
      <form
        noValidate
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        {problem ? (
          <div role="alert" className="flex gap-3 rounded-md border border-warning-line bg-warning-bg px-3 py-3 text-sm text-fg">
            <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
            <p>{problem}</p>
          </div>
        ) : null}

        {canLookup ? (
          <SearchPicker
            label="Colleague"
            required
            hint="They must be an active user of this school."
            error={errors.delegateId}
            value={form.delegateId}
            onChange={(v) => set('delegateId', v)}
            search={async (q) => {
              const r = await users.list({ page: 1, pageSize: 10, q: q || undefined, filters: { status: 'active' } });
              return r.items.filter((u) => u.id !== me).map((u) => ({ value: u.id, label: u.email ? `${u.displayName} (${u.email})` : u.displayName }));
            }}
            describe={() => Promise.resolve(null)}
          />
        ) : (
          <p role="note" className="rounded-md border border-line-subtle bg-canvas px-3 py-3 text-sm text-fg-muted">
            {NO_LOOKUP_MESSAGE}
          </p>
        )}

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-fg">Starts</legend>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-fg">
            {(['now', 'later'] as const).map((m) => (
              <label key={m} className="flex min-h-8 items-center gap-2">
                <input type="radio" name="handover-start" checked={form.startMode === m} onChange={() => set('startMode', m)} className="size-4 accent-[var(--color-accent)]" />
                {m === 'now' ? 'Now' : 'Later'}
              </label>
            ))}
          </div>
          {form.startMode === 'later' ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={ids.start} className="sr-only">
                Start date and time
              </label>
              <input id={ids.start} type="datetime-local" value={form.startsAt} onChange={(e) => set('startsAt', e.target.value)} aria-invalid={errors.startsAt ? true : undefined} aria-describedby={errors.startsAt ? `${ids.start}-e` : undefined} className={fieldClass(Boolean(errors.startsAt))} />
              {errors.startsAt ? (
                <p id={`${ids.start}-e`} role="alert" className="text-sm text-danger">
                  {errors.startsAt}
                </p>
              ) : null}
            </div>
          ) : null}
        </fieldset>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.end} className="text-sm font-medium text-fg">
            Ends *
          </label>
          <input id={ids.end} type="datetime-local" required value={form.endsAt} onChange={(e) => set('endsAt', e.target.value)} aria-invalid={errors.endsAt ? true : undefined} aria-describedby={`${ids.end}-h${errors.endsAt ? ` ${ids.end}-e` : ''}`} className={fieldClass(Boolean(errors.endsAt))} />
          <p id={`${ids.end}-h`} className="text-sm text-fg-muted">
            {endHint}
          </p>
          {errors.endsAt ? (
            <p id={`${ids.end}-e`} role="alert" className="text-sm text-danger">
              {errors.endsAt}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={ids.reason} className="text-sm font-medium text-fg">
            Reason <span className="font-normal text-fg-subtle">(optional)</span>
          </label>
          <textarea id={ids.reason} rows={3} maxLength={REASON_MAX + 50} value={form.reason} onChange={(e) => set('reason', e.target.value)} aria-invalid={errors.reason ? true : undefined} aria-describedby={errors.reason ? `${ids.reason}-e` : undefined} className={cx(fieldClass(Boolean(errors.reason)), 'h-auto resize-y py-2')} />
          {errors.reason ? (
            <p id={`${ids.reason}-e`} role="alert" className="text-sm text-danger">
              {errors.reason}
            </p>
          ) : null}
        </div>

        <p className="text-sm text-fg-muted">This covers every kind of request you can decide. Limiting it to some request types will come when the server lists them.</p>

        <div className="flex gap-2">
          <Button type="submit" loading={busy} disabled={!canLookup}>
            Hand over
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

/** FND-20 handovers: the ones I gave (with End now) and the ones I received, and the form to give a new one. */
export function DelegationsPanel({ api, onChanged }: { api: ApprovalsApi; onChanged: () => void }) {
  const [state, setState] = useState<{ phase: 'loading' } | { phase: 'error'; message: string } | { phase: 'ready'; given: Delegation[]; received: Delegation[] }>({ phase: 'loading' });
  const [creating, setCreating] = useState(false);
  const [ending, setEnding] = useState<Delegation | null>(null);
  const [endBusy, setEndBusy] = useState(false);
  const [endProblem, setEndProblem] = useState('');
  const live = useRef(true);

  const load = useCallback(async () => {
    try {
      const l = await api.delegations();
      if (live.current) setState({ phase: 'ready', given: l.given, received: l.received });
    } catch (e) {
      if (live.current) setState({ phase: 'error', message: e instanceof Error ? e.message : 'Something went wrong.' });
    }
  }, [api]);

  useEffect(() => {
    live.current = true;
    void load();
    return () => void (live.current = false);
  }, [load]);

  const endNow = async () => {
    if (!ending) return;
    setEndBusy(true);
    setEndProblem('');
    try {
      await api.endDelegation(ending.id);
      if (!live.current) return;
      toast.success(`Handover to ${ending.delegateName} ended.`);
      setEnding(null);
      await load();
      onChanged();
    } catch (e) {
      if (!live.current) return;
      if (e instanceof ApiError && e.status === 409) {
        setEnding(null);
        toast.message('That handover is already over.');
        await load();
      } else setEndProblem(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      if (live.current) setEndBusy(false);
    }
  };

  if (state.phase === 'error')
    return (
      <div role="alert" className="space-y-3 rounded-lg border border-danger-line bg-surface p-6 shadow-soft">
        <p className="text-fg">{state.message}</p>
        <Button variant="secondary" size="sm" onClick={() => void load()}>
          Try again
        </Button>
      </div>
    );
  if (state.phase === 'loading')
    return (
      <Card aria-busy="true" role="status" className="divide-y divide-line-subtle">
        <span className="sr-only">Loading handovers…</span>
        {[0, 1].map((i) => (
          <div key={i} aria-hidden="true" className="space-y-2 px-5 py-4">
            <div className="h-4 w-1/3 animate-pulse rounded bg-subtle" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-subtle" />
          </div>
        ))}
      </Card>
    );

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-fg-muted">Going away? Hand your approvals to a colleague for a period of up to {MAX_HANDOVER_DAYS} days. It ends by itself, or you can end it sooner.</p>
        <Button onClick={() => setCreating(true)}>
          <HandHelping aria-hidden="true" className="size-4" />
          Hand over my approvals
        </Button>
      </div>
      <Group title="Handed over by me" empty="You have not handed your approvals to anyone." items={state.given} direction="given" onEnd={(d) => { setEndProblem(''); setEnding(d); }} />
      <Group title="Handed to me" empty="Nobody has handed their approvals to you. When someone does, their requests appear under To decide, marked with their name." items={state.received} direction="received" />

      {creating ? (
        <HandoverSheet
          api={api}
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            void load();
            onChanged();
          }}
        />
      ) : null}
      {ending ? (
        <ConfirmDialog open title={`End the handover to ${ending.delegateName}?`} onClose={() => setEnding(null)}>
          <p className="text-sm text-fg-muted">{ending.delegateName} will stop being able to decide for you right away, and will be told. Requests they already decided stay as they are.</p>
          {endProblem ? (
            <p role="alert" className="mt-3 text-sm text-danger">
              {endProblem}
            </p>
          ) : null}
          <div className="mt-5 flex gap-2">
            <Button variant="destructive" loading={endBusy} onClick={() => void endNow()}>
              End handover
            </Button>
            <Button variant="secondary" onClick={() => setEnding(null)}>
              Keep it
            </Button>
          </div>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
