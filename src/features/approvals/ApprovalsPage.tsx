import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CircleChevronRight, ClipboardCheck, Eye, HandHelping, Send } from 'lucide-react';
import { Button, Card, PageHeader, cx } from '../../design-system';
import { ApiError } from '../../crud/client';
import { useAccessState } from '../../shell/AccessProvider';
import { useAuth } from '../../shell/AuthProvider';
import { API_BASE } from '../../shell/web-session';
import { createApprovalsApi, type Approval, type ApprovalsApi, type ApprovalStatus } from './approvalsApi';
import { ApprovalSheet, StatusChip } from './ApprovalSheet';
import { DelegationsPanel } from './DelegationsPanel';
import { STATUS_LABEL, forText, money, rowTiming, stepText } from './logic';

const PAGE_SIZE = 20;
type Tab = 'inbox' | 'mine' | 'handovers';
const TABS: { id: Tab; label: string }[] = [
  { id: 'inbox', label: 'To decide' },
  { id: 'mine', label: 'My requests' },
  { id: 'handovers', label: 'Handovers' },
];
const STATUSES: ApprovalStatus[] = ['pending', 'approved', 'rejected', 'cancelled'];

type Load = { phase: 'loading' } | { phase: 'error'; message: string } | { phase: 'visit' } | { phase: 'ready'; items: Approval[]; total: number };

/** What a read-only support visit sees: the server refuses approvals there, so there is nothing to load. */
function VisitNotice() {
  return (
    <Card className="mx-auto max-w-lg p-10 text-center" role="status">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-subtle text-fg-muted">
        <Eye aria-hidden="true" className="size-5" />
      </span>
      <h2 className="mt-4 font-display text-xl font-semibold text-fg">Approvals are not shown in a support visit</h2>
      <p className="mt-1.5 text-sm text-fg-muted">A visit is read-only and approvals are private to the people involved.</p>
    </Card>
  );
}

function EmptyState({ tab, status }: { tab: 'inbox' | 'mine'; status: ApprovalStatus | '' }) {
  const Icon = tab === 'inbox' ? ClipboardCheck : Send;
  const [title, text] =
    tab === 'inbox'
      ? ['Nothing is waiting for you', 'When someone sends a request that needs your approval, such as a fee concession, it appears here.']
      : status
        ? [`No ${STATUS_LABEL[status].toLowerCase()} requests`, 'Try another status to see the rest.']
        : ['You have not sent any requests', 'Requests you send for approval show up here, with who has decided each step.'];
  return (
    <div className="px-6 py-16 text-center">
      <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent-subtle text-accent-fg">
        <Icon aria-hidden="true" className="size-5" />
      </span>
      <h2 className="mt-4 font-display text-xl font-semibold text-fg">{title}</h2>
      <p className="mx-auto mt-1.5 max-w-sm text-sm text-fg-muted">{text}</p>
    </div>
  );
}

function Row({ a, onOpen }: { a: Approval; onOpen: () => void }) {
  const amount = money(a.amount);
  return (
    <li className="border-b border-line-subtle last:border-0">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${a.typeTitle}: ${a.summary}`}
        className="group flex min-h-14 w-full items-start gap-3 px-4 py-4 text-left transition-colors hover:bg-canvas focus-visible:bg-canvas focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring sm:px-5"
      >
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="font-medium text-fg">{a.typeTitle}</span>
            <StatusChip status={a.status} />
            {amount ? <span className="text-sm font-semibold text-fg">{amount}</span> : null}
          </span>
          <span className="block text-sm text-fg-muted">{a.summary}</span>
          <span className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-fg-subtle">
            <span>From {a.requesterName}</span>
            <span aria-hidden="true">·</span>
            <span>
              Step {stepText(a)}: {a.stepName}
            </span>
            <span aria-hidden="true">·</span>
            <span>{rowTiming(a)}</span>
          </span>
          {forText(a) ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-gold/50 bg-accent-subtle px-2 py-0.5 text-xs font-medium text-accent-fg">
              <HandHelping aria-hidden="true" className="size-3.5" />
              {forText(a)}
            </span>
          ) : null}
        </span>
        <CircleChevronRight aria-hidden="true" className="mt-1 size-5 shrink-0 text-fg-subtle transition-colors group-hover:text-accent-fg" />
      </button>
    </li>
  );
}

/**
 * FND-20 approvals: "To decide" (requests whose current step I may decide) and "My requests" (ones I sent, with a status
 * filter). A row opens the request in a sheet; the open request is kept in the address (?id=) so a link or a notification
 * can point at it. "Handovers" is where I hand my approvals to a colleague for a period, and see the ones handed to me.
 */
export function ApprovalsPage() {
  const { session } = useAuth();
  const access = useAccessState();
  const api: ApprovalsApi = useMemo(() => createApprovalsApi(session, API_BASE), [session]);
  const [params, setParams] = useSearchParams();
  const tab: Tab = params.get('tab') === 'mine' ? 'mine' : params.get('tab') === 'handovers' ? 'handovers' : 'inbox';
  const openId = params.get('id');
  const inVisit = access.phase === 'ready' && Boolean(access.payload.visit);

  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ApprovalStatus | ''>('');
  const [load, setLoad] = useState<Load>({ phase: 'loading' });
  const [inboxTotal, setInboxTotal] = useState<number | null>(null);
  const seq = useRef(0);
  const tabRefs = useRef<Record<Tab, HTMLButtonElement | null>>({ inbox: null, mine: null, handovers: null });

  const fetchList = useCallback(async () => {
    if (inVisit) return setLoad({ phase: 'visit' });
    if (tab === 'handovers') return;
    const mine = ++seq.current;
    try {
      const r = tab === 'inbox' ? await api.inbox({ page, pageSize: PAGE_SIZE }) : await api.mine({ page, pageSize: PAGE_SIZE, status: status || undefined });
      if (mine !== seq.current) return;
      setLoad({ phase: 'ready', items: r.items, total: r.page.total });
      if (tab === 'inbox') setInboxTotal(r.page.total);
    } catch (e) {
      if (mine !== seq.current) return;
      if (e instanceof ApiError && e.status === 403 && e.code === 'read_only_visit') return setLoad({ phase: 'visit' });
      setLoad({ phase: 'error', message: e instanceof Error ? e.message : 'Something went wrong.' });
    }
  }, [api, tab, page, status, inVisit]);

  useEffect(() => {
    setLoad((l) => (l.phase === 'ready' ? l : { phase: 'loading' }));
    void fetchList();
  }, [fetchList]);

  const go = (next: Tab) => {
    setPage(1);
    setLoad({ phase: 'loading' });
    setParams(next === 'inbox' ? {} : { tab: next }, { replace: true });
  };
  const onTabKey = (e: KeyboardEvent, i: number) => {
    const target = e.key === 'ArrowRight' ? (i + 1) % TABS.length : e.key === 'ArrowLeft' ? (i + TABS.length - 1) % TABS.length : e.key === 'Home' ? 0 : e.key === 'End' ? TABS.length - 1 : -1;
    if (target < 0) return;
    e.preventDefault();
    const t = TABS[target];
    go(t.id);
    tabRefs.current[t.id]?.focus();
  };
  const open = (id: string | null) => {
    const next = new URLSearchParams(params);
    if (id) next.set('id', id);
    else next.delete('id');
    setParams(next, { replace: false });
  };

  const showVisit = load.phase === 'visit' || inVisit;
  const pages = load.phase === 'ready' ? Math.max(1, Math.ceil(load.total / PAGE_SIZE)) : 1;

  return (
    <section className="space-y-6">
      <PageHeader eyebrow="Workflow" title="Approvals" description="Requests waiting for your decision, the ones you have sent, and handovers to a colleague." />
      {showVisit ? (
        <VisitNotice />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div role="tablist" aria-label="Approvals" className="inline-flex gap-1 rounded-lg border border-line-subtle bg-canvas p-1">
              {TABS.map((t, i) => (
                <button
                  key={t.id}
                  ref={(el) => void (tabRefs.current[t.id] = el)}
                  type="button"
                  role="tab"
                  id={`approvals-tab-${t.id}`}
                  aria-selected={tab === t.id}
                  aria-controls="approvals-panel"
                  tabIndex={tab === t.id ? 0 : -1}
                  onClick={() => go(t.id)}
                  onKeyDown={(e) => onTabKey(e, i)}
                  className={cx(
                    'flex min-h-10 items-center gap-2 rounded-md px-4 py-2 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle',
                    tab === t.id ? 'bg-surface font-medium text-fg shadow-soft' : 'text-fg-muted hover:text-fg',
                  )}
                >
                  {t.label}
                  {t.id === 'inbox' && inboxTotal ? (
                    <span className="rounded-full bg-accent px-1.5 text-[11px] font-semibold leading-5 text-on-accent">
                      {inboxTotal > 99 ? '99+' : inboxTotal}
                      <span className="sr-only"> waiting</span>
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
            {tab === 'mine' ? (
              <div className="flex items-center gap-2">
                <label htmlFor="approvals-status" className="text-sm text-fg-muted">
                  Status
                </label>
                <select
                  id="approvals-status"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value as ApprovalStatus | '');
                    setPage(1);
                  }}
                  className="h-10 rounded-md border border-line bg-surface px-3 text-sm text-fg shadow-soft hover:border-line-strong focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle"
                >
                  <option value="">All</option>
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </div>

          <div id="approvals-panel" role="tabpanel" aria-labelledby={`approvals-tab-${tab}`} className="space-y-4">
            {tab === 'handovers' ? (
              <DelegationsPanel api={api} onChanged={() => void fetchList()} />
            ) : load.phase === 'error' ? (
              <div role="alert" className="space-y-3 rounded-lg border border-danger-line bg-surface p-6 shadow-soft">
                <p className="text-fg">{load.message}</p>
                <Button variant="secondary" size="sm" onClick={() => void fetchList()}>
                  Try again
                </Button>
              </div>
            ) : load.phase === 'loading' ? (
              <Card aria-busy="true" role="status" className="divide-y divide-line-subtle">
                <span className="sr-only">Loading approvals…</span>
                {[0, 1, 2].map((i) => (
                  <div key={i} aria-hidden="true" className="space-y-2 px-5 py-4">
                    <div className="h-4 w-1/3 animate-pulse rounded bg-subtle" />
                    <div className="h-3 w-2/3 animate-pulse rounded bg-subtle" />
                  </div>
                ))}
              </Card>
            ) : load.items.length === 0 ? (
              <Card>
                <EmptyState tab={tab} status={status} />
              </Card>
            ) : (
              <Card>
                <ul aria-label={tab === 'inbox' ? 'Requests to decide' : 'My requests'}>
                  {load.items.map((a) => (
                    <Row key={a.id} a={a} onOpen={() => open(a.id)} />
                  ))}
                </ul>
              </Card>
            )}

            {tab !== 'handovers' && load.phase === 'ready' && load.total > PAGE_SIZE ? (
              <nav className="flex items-center justify-between text-sm text-fg-muted" aria-label="Pagination">
                <span>
                  Page {page} of {pages} · {load.total} requests
                </span>
                <span className="flex items-center gap-2">
                  <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page">
                    <ChevronLeft aria-hidden="true" className="size-4" />
                  </Button>
                  <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Next page">
                    <ChevronRight aria-hidden="true" className="size-4" />
                  </Button>
                </span>
              </nav>
            ) : null}
          </div>
        </>
      )}
      {openId && !showVisit ? <ApprovalSheet key={openId} api={api} id={openId} onClose={() => open(null)} onChanged={() => void fetchList()} /> : null}
    </section>
  );
}
