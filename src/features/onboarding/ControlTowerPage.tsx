import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, CircleAlert, Lock, Inbox, User } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, Input, PageHeader, Sheet, cx } from '../../design-system';
import { SearchPicker } from '../../crud/SearchPicker';
import { useAccessState } from '../../shell/AccessProvider';
import { useAuth } from '../../shell/AuthProvider';
import { formatDate, formatDateTime } from '../adm/dates';
import { blockedText, COLUMNS, createTowerApi, nextAction, readyBlock, reviewBlock, STATUS_LABEL, TowerError, type ControlTower, type DomainMark, type TowerApi, type TowerDomain } from './controlTower';

const TONE: Record<string, string> = {
  not_started: 'border-line bg-subtle text-fg-muted',
  in_progress: 'border-info-line bg-info-bg text-info',
  needs_review: 'border-warning-line bg-warning-bg text-warning',
  ready: 'border-success-line bg-success-bg text-success',
};

/** Where a domain's records can be opened, when the person may open them. */
const RECORDS: Record<string, { to: string; label: string; permission: string }> = {
  academic: { to: '/classes', label: 'Open classes', permission: 'aca.classes.view' },
  students: { to: '/students', label: 'Open students', permission: 'stu.students.view' },
};

function Pill({ status }: { status: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium', TONE[status])}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status as keyof typeof STATUS_LABEL]}
    </span>
  );
}

function Progress({ percent, label }: { percent: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent} className="h-2 flex-1 overflow-hidden rounded-full bg-subtle">
        <div className="h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
      </div>
      <span className="w-10 text-right text-sm tabular-nums text-fg-muted">{percent} %</span>
    </div>
  );
}

function DomainCard({ d, canEdit, onOpen }: { d: TowerDomain; canEdit: boolean; onOpen: () => void }) {
  const blocked = blockedText(d);
  return (
    <Card className="space-y-3 p-4" data-testid={`domain-${d.id}`}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-lg font-semibold text-fg">{d.title}</h3>
        {d.overdue ? (
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-danger-line bg-danger-bg px-2 py-0.5 text-xs font-medium text-danger">
            <CircleAlert aria-hidden="true" className="size-3" />
            Overdue
          </span>
        ) : null}
      </div>
      {d.hasSource ? <Progress percent={d.percent} label={`${d.title} readiness`} /> : <p className="text-sm text-fg-muted">{d.note || 'No data source yet'}</p>}
      {blocked ? (
        <p className="flex items-start gap-1.5 text-sm text-warning">
          <Lock aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          {blocked}
        </p>
      ) : null}
      <p className="text-sm text-fg">
        <span className="text-fg-subtle">Next: </span>
        {nextAction(d, canEdit)}
      </p>
      <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
        <span className="inline-flex items-center gap-1">
          <User aria-hidden="true" className="size-3.5" />
          {d.ownerName || 'No owner'}
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarClock aria-hidden="true" className="size-3.5" />
          {d.dueDate ? `Due ${formatDate(d.dueDate)}` : 'No due date'}
        </span>
      </p>
      <Button size="sm" variant="secondary" onClick={onOpen} aria-label={`Details of ${d.title}`}>
        Details
      </Button>
    </Card>
  );
}

function DomainSheet({ d, api, canEdit, canRecords, canImport, onClose, onChanged }: { d: TowerDomain; api: TowerApi; canEdit: boolean; canRecords: (p: string) => boolean; canImport: boolean; onClose: () => void; onChanged: (d: TowerDomain) => void }) {
  const [owner, setOwner] = useState(d.ownerId ?? '');
  const [due, setDue] = useState(d.dueDate ?? '');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const records = RECORDS[d.id];

  const run = async (fn: () => Promise<TowerDomain>, done: string) => {
    setBusy(true);
    setFailure('');
    try {
      onChanged(await fn());
      toast.success(done);
    } catch (e) {
      setFailure(e instanceof TowerError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  const move = (to: DomainMark, done: string) => run(() => api.move(d.id, to), done);
  const rb = reviewBlock(d);
  const yb = readyBlock(d);
  const blocked = blockedText(d);

  const action = (label: string, to: DomainMark, reason: string | null, done: string, variant: 'primary' | 'secondary' = 'secondary') => (
    <div className="space-y-1">
      <Button variant={variant} disabled={busy || reason !== null} aria-describedby={reason ? `why-${to}` : undefined} onClick={() => void move(to, done)}>
        {label}
      </Button>
      {reason ? (
        <p id={`why-${to}`} className="text-xs text-fg-muted">
          {reason}
        </p>
      ) : null}
    </div>
  );

  return (
    <Sheet open onClose={onClose} title={d.title} description={STATUS_LABEL[d.status]}>
      <div data-testid="domain-detail" className="space-y-6">
        <div className="flex items-center gap-2">
          <Pill status={d.status} />
          {d.overdue ? <span className="text-sm font-medium text-danger">Overdue</span> : null}
        </div>
        {d.hasSource ? <Progress percent={d.percent} label={`${d.title} readiness`} /> : <p className="text-sm text-fg-muted">{d.note || 'No data source yet'}</p>}
        {blocked ? <p className="text-sm text-warning">{blocked}</p> : null}

        {d.hasSource ? (
          <section aria-labelledby="tower-checks" className="space-y-2">
            <h3 id="tower-checks" className="text-xs font-semibold uppercase tracking-[0.1em] text-fg-subtle">
              Readiness rules
            </h3>
            <ul className="space-y-2 text-sm">
              {d.checks.map((c) => (
                <li key={c.key} className="flex justify-between gap-3">
                  <span className="text-fg">{c.label}</span>
                  <span className={cx('whitespace-nowrap tabular-nums', c.done >= c.total ? 'text-success' : 'text-fg-muted')}>
                    {c.done} of {c.total}
                  </span>
                </li>
              ))}
            </ul>
            {d.openImports > 0 ? <p className="text-sm text-fg-muted">{d.openImports} import {d.openImports === 1 ? 'file is' : 'files are'} still open.</p> : null}
          </section>
        ) : null}

        <p className="text-sm text-fg">
          <span className="text-fg-subtle">Next: </span>
          {nextAction(d, canEdit)}
        </p>
        <dl className="grid grid-cols-[8rem_1fr] gap-x-4 gap-y-2 text-sm">
          <dt className="text-fg-subtle">Owner</dt>
          <dd className="text-fg">{d.ownerName || 'No owner'}</dd>
          <dt className="text-fg-subtle">Due</dt>
          <dd className="text-fg">{d.dueDate ? formatDate(d.dueDate) : 'No due date'}</dd>
          {d.reviewRequestedAt ? (
            <>
              <dt className="text-fg-subtle">Review asked</dt>
              <dd className="text-fg">{formatDateTime(d.reviewRequestedAt)}</dd>
            </>
          ) : null}
          {d.readyAt ? (
            <>
              <dt className="text-fg-subtle">Ready since</dt>
              <dd className="text-fg">{formatDateTime(d.readyAt)}</dd>
            </>
          ) : null}
        </dl>

        {(records && canRecords(records.permission)) || (d.hasSource && canImport) ? (
          <div className="flex flex-wrap gap-3 text-sm">
            {records && canRecords(records.permission) ? (
              <Link className="font-medium text-accent underline-offset-2 hover:underline" to={records.to}>
                {records.label}
              </Link>
            ) : null}
            {d.hasSource && canImport ? (
              <Link className="font-medium text-accent underline-offset-2 hover:underline" to="/onboarding">
                Import data
              </Link>
            ) : null}
          </div>
        ) : null}

        {canEdit ? (
          <>
            <section aria-labelledby="tower-assign" className="space-y-3">
              <h3 id="tower-assign" className="text-xs font-semibold uppercase tracking-[0.1em] text-fg-subtle">
                Owner and due date
              </h3>
              <SearchPicker
                label="Owner"
                hint="Type at least 2 letters of a name."
                value={owner}
                onChange={setOwner}
                search={async (q) => (q.length === 1 ? [] : (await api.colleagues(q)).map((c) => ({ value: c.id, label: `${c.displayName} (${c.label})` })))}
                describe={(id) => Promise.resolve(id === d.ownerId && d.ownerName ? { value: id, label: d.ownerName } : null)}
              />
              <Input label="Due date" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
              <Button variant="secondary" disabled={busy} onClick={() => void run(() => api.assign(d.id, { ownerId: owner || null, dueDate: due || null }), 'Owner and due date saved.')}>
                Save owner and due date
              </Button>
            </section>

            <section aria-labelledby="tower-mark" className="space-y-3">
              <h3 id="tower-mark" className="text-xs font-semibold uppercase tracking-[0.1em] text-fg-subtle">
                Mark
              </h3>
              {d.state === 'open' ? action('Mark for review', 'review', rb, 'Marked for review.', 'primary') : null}
              {d.state === 'review' ? (
                <>
                  {action('Confirm ready', 'ready', yb, 'Domain confirmed ready.', 'primary')}
                  {action('Withdraw review', 'open', null, 'Review withdrawn.')}
                </>
              ) : null}
              {d.state === 'ready' ? action('Reopen', 'open', null, 'Domain reopened.') : null}
            </section>
          </>
        ) : null}
        {failure ? (
          <p role="alert" className="rounded-md border border-danger-line bg-danger-bg p-3 text-sm text-danger">
            {failure}
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}

/** ONB-01 Control tower: the readiness of every data domain of the institute, as a board by status. */
export function ControlTowerPage() {
  const { session } = useAuth();
  const api = useMemo(() => createTowerApi(session), [session]);
  const access = useAccessState();
  const can = (p: string) => access.phase === 'ready' && access.access.can(p);
  const canView = can('onb.control_tower.view');
  const canEdit = can('onb.control_tower.edit');

  const [tower, setTower] = useState<ControlTower | null>(null);
  const [load, setLoad] = useState<'loading' | 'ready' | 'error' | 'denied'>('loading');
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++latest.current;
    setLoad('loading');
    try {
      const t = await api.get();
      if (mine !== latest.current) return;
      setTower(t);
      setLoad('ready');
    } catch (e) {
      if (mine !== latest.current) return;
      setError(e instanceof TowerError ? e.message : 'Something went wrong. Please try again.');
      setLoad(e instanceof TowerError && e.status === 403 ? 'denied' : 'error');
    }
  }, [api]);
  useEffect(() => {
    if (access.phase === 'ready' && canView) void reload();
  }, [reload, access.phase, canView]);

  // A change to one domain can unblock or reopen others, so the whole tower is read again.
  const changed = (d: TowerDomain) => {
    setTower((t) => (t ? { ...t, domains: t.domains.map((x) => (x.id === d.id ? d : x)) } : t));
    void api.get().then(setTower).catch(() => undefined);
  };

  if (access.phase !== 'ready') return null;
  const open = tower?.domains.find((d) => d.id === openId) ?? null;

  return (
    <section className="space-y-6">
      <PageHeader title="Control tower" description={tower && tower.total > 0 ? `${tower.ready} of ${tower.total} domains ready` : 'How ready each part of your data is for go-live.'} />

      {!canView || load === 'denied' ? (
        <div role="alert" className="rounded-lg border border-line bg-surface p-6 shadow-soft">
          <p className="font-medium text-fg">You do not have access to the control tower.</p>
          <p className="mt-1 text-sm text-fg-muted">Ask an administrator for the “view control tower” permission.</p>
        </div>
      ) : load === 'error' ? (
        <div role="alert" className="space-y-3 rounded-lg border border-danger-line bg-surface p-6 shadow-soft">
          <p className="text-fg">{error}</p>
          <Button variant="secondary" onClick={() => void reload()}>
            Try again
          </Button>
        </div>
      ) : load === 'loading' && !tower ? (
        <p role="status" className="py-16 text-center text-fg-muted">
          Loading…
        </p>
      ) : tower && tower.domains.length === 0 ? (
        <div className="rounded-lg border border-line bg-surface px-5 py-16 text-center text-fg-muted shadow-soft">
          <Inbox aria-hidden="true" className="mx-auto mb-3 size-6 text-fg-subtle" />
          No data areas to track yet. They appear here when modules are switched on for your school.
        </div>
      ) : tower ? (
        <>
          <Card className="space-y-2 p-5">
            <p className="text-sm font-medium text-fg">Overall readiness</p>
            <Progress percent={tower.percent} label="Overall readiness" />
          </Card>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {COLUMNS.map((col) => {
              const items = tower.domains.filter((d) => d.status === col.status);
              return (
                <section key={col.status} aria-labelledby={`col-${col.status}`} className="space-y-3 rounded-lg bg-subtle/60 p-3">
                  <div>
                    <h2 id={`col-${col.status}`} className="flex items-center justify-between text-sm font-semibold text-fg">
                      {col.label}
                      <span className="rounded-full bg-surface px-2 text-xs tabular-nums text-fg-muted">{items.length}</span>
                    </h2>
                    <p className="text-xs text-fg-muted">{col.hint}</p>
                  </div>
                  {items.map((d) => (
                    <DomainCard key={d.id} d={d} canEdit={canEdit} onOpen={() => setOpenId(d.id)} />
                  ))}
                  {items.length === 0 ? <p className="py-4 text-center text-xs text-fg-muted">None</p> : null}
                </section>
              );
            })}
          </div>
        </>
      ) : null}

      {open ? <DomainSheet key={open.id} d={open} api={api} canEdit={canEdit} canRecords={can} canImport={can('onb.workspace.view')} onClose={() => setOpenId(null)} onChanged={changed} /> : null}
    </section>
  );
}
