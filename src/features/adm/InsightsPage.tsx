import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlarmClock, ArrowUpRight, BarChart3, Download, Printer, RefreshCw } from 'lucide-react';
import { Button, Card, PageHeader, cx } from '../../design-system';
import { createCrudClient } from '../../crud/client';
import { useAccessState } from '../../shell/AccessProvider';
import { useAuth } from '../../shell/AuthProvider';
import { API_BASE } from '../../shell/web-session';
import { SOURCES, STATUSES } from './enquiries';
import { REGISTRATION_STATUSES } from './registrations';
import { formatDate } from './dates';
import {
  NO_FILTERS, createInsightsApi, drillHref, formatCount, formatRate, insightsCsv, monthLabel, monthShort, rangeProblem,
  type AdmissionInsights, type Conversion, type InsightsApi, type InsightsFilters,
} from './insights';

type Option = { value: string; label: string };
type Load = { phase: 'loading' } | { phase: 'error'; message: string } | { phase: 'ready'; data: AdmissionInsights };

const CONTROL = 'h-10 rounded-md border border-line bg-surface px-3 text-sm text-fg shadow-soft hover:border-line-strong focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle';

/** A figure that opens its list when the person may see that list, and is plain text when they may not. */
function Drill({ to, label, children, className }: { to: string | null; label: string; children: ReactNode; className?: string }) {
  if (!to) return <div className={className}>{children}</div>;
  return (
    <Link to={to} aria-label={label} className={cx('focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle', className)}>
      {children}
    </Link>
  );
}

function Kpi({ label, value, hint, to, drillLabel }: { label: string; value: string; hint?: string; to?: string | null; drillLabel?: string }) {
  const body = (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="text-sm text-fg-muted">{label}</span>
        {to ? <ArrowUpRight aria-hidden="true" className="size-4 text-fg-subtle transition-colors group-hover:text-accent-fg print:hidden" /> : null}
      </span>
      <span className="mt-2 block font-display text-4xl font-semibold tracking-tight text-fg">{value}</span>
      {hint ? <span className="mt-1 block text-sm text-fg-muted">{hint}</span> : null}
    </>
  );
  const box = 'group block h-full rounded-lg border border-line-subtle bg-surface p-5 shadow-card';
  return (
    <li>
      {to ? (
        <Link to={to} aria-label={drillLabel ?? label} className={cx(box, 'transition-[box-shadow,border-color] duration-200 hover:border-line hover:shadow-float focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle')}>
          {body}
        </Link>
      ) : (
        <div className={box}>{body}</div>
      )}
    </li>
  );
}

/** One row of a bar list: label, a proportional bar, the count. The count is always written, so colour is never the only signal. */
function BarRow({ label, value, max, to, drillLabel, tone = 'bg-info' }: { label: string; value: number; max: number; to: string | null; drillLabel: string; tone?: string }) {
  const pct = max > 0 ? Math.max(value > 0 ? 3 : 0, Math.round((value / max) * 100)) : 0;
  return (
    <li>
      <Drill to={to} label={drillLabel} className="group -mx-2 block rounded-md px-2 py-1.5 hover:bg-subtle">
        <span className="flex items-baseline justify-between gap-3 text-sm">
          <span className="text-fg">{label}</span>
          <span className="font-medium tabular-nums text-fg">{formatCount(value)}</span>
        </span>
        <span aria-hidden="true" className="mt-1.5 block h-2 overflow-hidden rounded-full bg-subtle">
          <span className={cx('block h-full rounded-full transition-[width] duration-200', tone)} style={{ width: `${pct}%` }} />
        </span>
      </Drill>
    </li>
  );
}

function StepNote({ c, noun }: { c: Conversion; noun: string }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 border-l-2 border-brand-gold py-1 pl-4 text-sm text-fg-muted">
      <span className="font-semibold tabular-nums text-fg">{formatRate(c.rate)}</span>
      <span>{c.rate === null ? `No ${noun} yet to measure.` : `${formatCount(c.converted)} of ${formatCount(c.of)} ${noun}`}</span>
    </p>
  );
}

function FunnelBar({ label, value, max, tone, to, drillLabel }: { label: string; value: number; max: number; tone: string; to: string | null; drillLabel: string }) {
  const pct = max > 0 ? Math.max(value > 0 ? 4 : 0, Math.round((value / max) * 100)) : 0;
  return (
    <Drill to={to} label={drillLabel} className="group block rounded-md">
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium text-fg">{label}</span>
        <span className="font-display text-2xl font-semibold tabular-nums text-fg">{formatCount(value)}</span>
      </span>
      <span aria-hidden="true" className="mt-1.5 block h-5 overflow-hidden rounded-md bg-subtle">
        <span className={cx('block h-full rounded-md transition-[width] duration-200', tone)} style={{ width: `${pct}%` }} />
      </span>
    </Drill>
  );
}

function Funnel({ d, links }: { d: AdmissionInsights; links: { enquiries: string | null; registrations: string | null; accepted: string | null; admitted: string | null } }) {
  const accepted = d.registrations.byStatus.accepted;
  const admitted = d.registrations.admitted;
  const max = Math.max(d.enquiries.total, d.registrations.total, accepted, admitted);
  return (
    <Card className="space-y-4 p-6" aria-labelledby="funnel-title" role="region">
      <div>
        <h2 id="funnel-title" className="font-display text-lg font-semibold text-fg">From enquiry to a place</h2>
        <p className="text-sm text-fg-muted">How many families move on at each step. Accepted includes the families already admitted.</p>
      </div>
      <FunnelBar label="Enquiries" value={d.enquiries.total} max={max} tone="bg-brand-ink" to={links.enquiries} drillLabel="Open all enquiries" />
      <StepNote c={d.conversion.enquiryToRegistration} noun="enquiries have a registration" />
      <FunnelBar label="Registrations" value={d.registrations.total} max={max} tone="bg-info" to={links.registrations} drillLabel="Open all registrations" />
      <StepNote c={d.conversion.registrationToAccepted} noun="registrations accepted" />
      <FunnelBar label="Accepted" value={accepted} max={max} tone="bg-success" to={links.accepted} drillLabel="Open accepted registrations" />
      {d.conversion.acceptedToAdmitted ? <StepNote c={d.conversion.acceptedToAdmitted} noun="accepted registrations admitted" /> : null}
      <div data-testid="funnel-admitted">
        <FunnelBar label="Admitted" value={admitted} max={max} tone="bg-brand-gold" to={links.admitted} drillLabel="Open admitted students" />
      </div>
    </Card>
  );
}

function FollowUps({ d, to }: { d: AdmissionInsights['followUps']; to: string | null }) {
  const urgent = d.overdue > 0;
  const text = d.due === 0 ? 'No follow-ups are due.' : `${formatCount(d.overdue)} overdue, ${formatCount(d.dueToday)} due today.`;
  return (
    <Card className={cx('flex flex-wrap items-center gap-4 p-5', urgent ? 'border-warning-line bg-warning-bg' : '')} role="region" aria-label="Follow-ups">
      <span className={cx('flex size-10 shrink-0 items-center justify-center rounded-full', urgent ? 'bg-surface text-warning' : 'bg-accent-subtle text-accent-fg')}>
        <AlarmClock aria-hidden="true" className="size-5" />
      </span>
      <div className="min-w-[12rem] flex-1">
        <h2 className="font-display text-lg font-semibold text-fg">{d.due === 0 ? 'Follow-ups are up to date' : `${formatCount(d.due)} follow-up${d.due === 1 ? '' : 's'} to make`}</h2>
        <p className="text-sm text-fg-muted">{text}</p>
      </div>
      {to && d.due > 0 ? (
        <Link to={to} className="inline-flex h-10 items-center gap-2 rounded-md border border-line bg-surface px-4 text-sm font-medium text-fg shadow-soft hover:border-line-strong focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle print:hidden">
          See these enquiries <ArrowUpRight aria-hidden="true" className="size-4" />
        </Link>
      ) : null}
    </Card>
  );
}

/** Two bars per month, drawn with plain CSS so there is no chart library. The same figures are in the table below it. */
function Trend({ d }: { d: AdmissionInsights }) {
  const [showTable, setShowTable] = useState(false);
  const max = Math.max(1, ...d.trend.flatMap((t) => [t.enquiries, t.registrations]));
  const h = (n: number) => (n > 0 ? Math.max(4, Math.round((n / max) * 100)) : 0);
  const summary = `Monthly enquiries and registrations from ${monthLabel(d.trendFrom)} to ${monthLabel(d.trendTo)}. The same figures are in the table.`;
  return (
    <Card className="space-y-4 p-6" role="region" aria-labelledby="trend-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="trend-title" className="font-display text-lg font-semibold text-fg">Month by month</h2>
          <p className="text-sm text-fg-muted">{monthLabel(d.trendFrom)} to {monthLabel(d.trendTo)}</p>
        </div>
        <ul className="flex items-center gap-4 text-sm text-fg-muted" aria-label="Key">
          <li className="flex items-center gap-2"><span aria-hidden="true" className="size-3 rounded-sm bg-brand-ink" />Enquiries</li>
          <li className="flex items-center gap-2"><span aria-hidden="true" className="size-3 rounded-sm bg-info" />Registrations</li>
        </ul>
      </div>
      <div role="img" aria-label={summary} className="flex h-44 items-end gap-1 border-b border-line sm:gap-2" data-testid="trend-chart">
        {d.trend.map((t) => (
          <div key={t.month} className="flex h-full min-w-0 flex-1 items-end justify-center gap-px sm:gap-1">
            <span className="block w-full max-w-4 rounded-t-sm bg-brand-ink transition-[height] duration-200" style={{ height: `${h(t.enquiries)}%` }} />
            <span className="block w-full max-w-4 rounded-t-sm bg-info transition-[height] duration-200" style={{ height: `${h(t.registrations)}%` }} />
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="flex gap-1 text-xs text-fg-muted sm:gap-2">
        {d.trend.map((t) => (
          <span key={t.month} className="min-w-0 flex-1 text-center">
            <span className="sm:hidden">{monthShort(t.month).charAt(0)}</span>
            <span className="hidden sm:inline">{monthShort(t.month)}</span>
          </span>
        ))}
      </div>
      <Button type="button" variant="ghost" size="sm" aria-expanded={showTable} aria-controls="trend-table" onClick={() => setShowTable(!showTable)} className="print:hidden">
        {showTable ? 'Hide the table' : 'Show as a table'}
      </Button>
      <div id="trend-table" className={cx('overflow-x-auto', showTable ? '' : 'sr-only print:not-sr-only')}>
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Enquiries and registrations for each month</caption>
          <thead>
            <tr className="border-b border-line text-fg-muted">
              <th scope="col" className="py-2 pr-4 font-medium">Month</th>
              <th scope="col" className="py-2 pr-4 text-right font-medium">Enquiries</th>
              <th scope="col" className="py-2 text-right font-medium">Registrations</th>
            </tr>
          </thead>
          <tbody>
            {d.trend.map((t) => (
              <tr key={t.month} className="border-b border-line-subtle last:border-0">
                <th scope="row" className="py-2 pr-4 font-normal text-fg">{monthLabel(t.month)}</th>
                <td className="py-2 pr-4 text-right tabular-nums">{formatCount(t.enquiries)}</td>
                <td className="py-2 text-right tabular-nums">{formatCount(t.registrations)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Skeleton() {
  return (
    <div role="status" aria-live="polite" className="space-y-6">
      <span className="sr-only">Loading admission insights…</span>
      <div aria-hidden="true" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-32 animate-pulse rounded-lg bg-subtle" />)}
      </div>
      <div aria-hidden="true" className="grid gap-6 lg:grid-cols-2">
        <div className="h-72 animate-pulse rounded-lg bg-subtle" />
        <div className="h-72 animate-pulse rounded-lg bg-subtle" />
      </div>
    </div>
  );
}

function Filters({ value, onChange, years, classes, problem }: { value: InsightsFilters; onChange: (f: InsightsFilters) => void; years: Option[]; classes: Option[]; problem: string }) {
  const set = (k: keyof InsightsFilters) => (v: string) => onChange({ ...value, [k]: v });
  return (
    <Card className="p-4 print:hidden">
      <form role="search" aria-label="Filter the figures" className="flex flex-wrap items-end gap-3" onSubmit={(e) => e.preventDefault()}>
        <label className="flex flex-col gap-1 text-sm text-fg-muted">
          Academic year
          <select className={CONTROL} value={value.yearId} onChange={(e) => set('yearId')(e.target.value)}>
            <option value="">All years</option>
            {years.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-fg-muted">
          Class
          <select className={CONTROL} value={value.classId} onChange={(e) => set('classId')(e.target.value)}>
            <option value="">All classes</option>
            {classes.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-fg-muted">
          From
          <input type="date" className={CONTROL} value={value.from} max={value.to || undefined} onChange={(e) => set('from')(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-fg-muted">
          To
          <input type="date" className={CONTROL} value={value.to} min={value.from || undefined} onChange={(e) => set('to')(e.target.value)} />
        </label>
        {value.yearId || value.classId || value.from || value.to ? (
          <Button type="button" variant="ghost" onClick={() => onChange(NO_FILTERS)}>Clear filters</Button>
        ) : null}
        {problem ? <p role="alert" className="basis-full text-sm text-danger">{problem}</p> : null}
      </form>
    </Card>
  );
}

function useOptions(endpoint: string): Option[] {
  const { session } = useAuth();
  const [opts, setOpts] = useState<Option[]>([]);
  useEffect(() => {
    let live = true;
    createCrudClient<Record<string, unknown> & { id: string }, never>(session, API_BASE, endpoint)
      .list({ page: 1, pageSize: 200, sort: undefined })
      .then((r) => live && setOpts(r.items.map((row) => ({ value: String(row.id), label: String(row.name) }))))
      .catch(() => live && setOpts([]));
    return () => {
      live = false;
    };
  }, [session, endpoint]);
  return opts;
}

/** The text that says which filters the figures were made with, shown on the printed page. */
function filterSummary(f: InsightsFilters, years: Option[], classes: Option[]): string {
  const parts = [
    f.yearId ? `Academic year ${years.find((o) => o.value === f.yearId)?.label ?? ''}` : 'All academic years',
    f.classId ? classes.find((o) => o.value === f.classId)?.label ?? 'One class' : 'All classes',
    f.from || f.to ? `${f.from ? formatDate(f.from) : 'the start'} to ${f.to ? formatDate(f.to) : 'today'}` : 'All time',
  ];
  return parts.join(' · ');
}

function download(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/**
 * ADM-02 Admission insights: the front office's view of enquiries, follow-ups, registrations and how many families
 * move from one step to the next. The server computes every figure; this page only shows them and links each count
 * to the list behind it.
 */
export function InsightsPage({ api: given }: { api?: InsightsApi }) {
  const { session } = useAuth();
  const access = useAccessState();
  const api = useMemo(() => given ?? createInsightsApi(session, API_BASE), [given, session]);
  const years = useOptions('/academic-years');
  const classes = useOptions('/classes');
  const [filters, setFilters] = useState<InsightsFilters>(NO_FILTERS);
  const [load, setLoad] = useState<Load>({ phase: 'loading' });
  const seq = useRef(0);
  const problem = rangeProblem(filters);

  const can = (p: string) => access.phase === 'ready' && access.access.can(p);
  const canEnquiries = can('adm.enquiry.view');
  const canRegistrations = can('adm.student_registrations.view');
  const canAdmissions = can('adm.admissions.view');
  const enq = (extra: Record<string, string> = {}) => (canEnquiries ? drillHref('enquiries', filters, extra) : null);
  const reg = (extra: Record<string, string> = {}) => (canRegistrations ? drillHref('registrations', filters, extra) : null);
  const adm = canAdmissions ? drillHref('admissions', filters, { state: 'admitted' }) : null;

  const fetchData = useCallback(async () => {
    if (rangeProblem(filters)) return;
    const mine = ++seq.current;
    setLoad((l) => (l.phase === 'ready' ? l : { phase: 'loading' }));
    try {
      const data = await api.get(filters);
      if (mine === seq.current) setLoad({ phase: 'ready', data });
    } catch (e) {
      if (mine === seq.current) setLoad({ phase: 'error', message: e instanceof Error ? e.message : 'Something went wrong.' });
    }
  }, [api, filters]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const data = load.phase === 'ready' ? load.data : null;
  const empty = data !== null && data.enquiries.total === 0 && data.registrations.total === 0;
  const dated = Boolean(filters.from || filters.to);

  return (
    <section className="space-y-6 print:space-y-4">
      <PageHeader
        eyebrow="Admissions"
        title="Admission insights"
        description="Where enquiries come from, how many families register, and who needs a follow-up."
        actions={
          <>
            <Button type="button" variant="secondary" disabled={!data} onClick={() => data && download(`admission-insights-${data.asOf.slice(0, 10)}.csv`, insightsCsv(data, filters, { year: years.find((o) => o.value === filters.yearId)?.label, className: classes.find((o) => o.value === filters.classId)?.label }))} className="print:hidden">
              <Download aria-hidden="true" className="size-4" /> Export CSV
            </Button>
            <Button type="button" variant="secondary" onClick={() => window.print()} className="print:hidden">
              <Printer aria-hidden="true" className="size-4" /> Print
            </Button>
          </>
        }
      />
      <Filters value={filters} onChange={setFilters} years={years} classes={classes} problem={problem} />
      <p className="hidden text-sm text-fg-muted print:block" data-testid="print-filters">{filterSummary(filters, years, classes)}</p>

      {load.phase === 'loading' ? <Skeleton /> : null}

      {load.phase === 'error' ? (
        <div role="alert" className="space-y-3 rounded-lg border border-danger-line bg-surface p-6 shadow-soft">
          <p className="text-fg">{load.message}</p>
          <Button variant="secondary" onClick={() => void fetchData()}><RefreshCw aria-hidden="true" className="size-4" /> Try again</Button>
        </div>
      ) : null}

      {data && empty ? (
        <Card className="px-6 py-16 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-accent-subtle text-accent-fg"><BarChart3 aria-hidden="true" className="size-5" /></span>
          <h2 className="mt-4 font-display text-xl font-semibold text-fg">No enquiries or registrations here yet</h2>
          <p className="mx-auto mt-1.5 max-w-sm text-sm text-fg-muted">{filters.yearId || filters.classId || dated ? 'Widen the filters to see more.' : 'When families start enquiring, the figures appear here.'}</p>
        </Card>
      ) : null}

      {data && !empty ? (
        <>
          <p className="text-sm text-fg-muted">
            Figures as of {formatDate(data.asOf)}.{dated ? ' The lists you open from here show every date, so their totals can be larger.' : ''}
          </p>
          <ul aria-label="Key figures" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Kpi label="Enquiries" value={formatCount(data.enquiries.total)} to={enq()} drillLabel="Enquiries, open the list" />
            <Kpi label="Registrations" value={formatCount(data.registrations.total)} to={reg()} drillLabel="Registrations, open the list" />
            <Kpi label="Accepted" value={formatCount(data.registrations.byStatus.accepted)} hint={`${formatRate(data.conversion.registrationToAccepted.rate)} of registrations`} to={reg({ status: 'accepted' })} drillLabel="Accepted, open the list" />
            <Kpi label="Admitted" value={formatCount(data.registrations.admitted)} hint={data.conversion.acceptedToAdmitted ? `${formatRate(data.conversion.acceptedToAdmitted.rate)} of accepted` : undefined} to={adm} drillLabel="Admitted, open the list" />
            <Kpi label="Enquiries that registered" value={formatRate(data.conversion.enquiryToRegistration.rate)} hint={data.conversion.enquiryToRegistration.rate === null ? 'No enquiries to measure yet' : `${formatCount(data.conversion.enquiryToRegistration.converted)} of ${formatCount(data.conversion.enquiryToRegistration.of)} enquiries`} />
          </ul>

          <FollowUps d={data.followUps} to={enq({ followUpDue: 'true' })} />

          <div className="grid gap-6 lg:grid-cols-2 print:break-inside-avoid">
            <Funnel d={data} links={{ enquiries: enq(), registrations: reg(), accepted: reg({ status: 'accepted' }), admitted: adm }} />
            <Card className="space-y-3 p-6" role="region" aria-labelledby="source-title">
              <div>
                <h2 id="source-title" className="font-display text-lg font-semibold text-fg">Where enquiries come from</h2>
                <p className="text-sm text-fg-muted">By how the family first got in touch.</p>
              </div>
              <ul className="space-y-1">
                {(() => {
                  const max = Math.max(...SOURCES.map((s) => data.enquiries.bySource[s.value] ?? 0));
                  return SOURCES.map((s) => <BarRow key={s.value} label={s.label} value={data.enquiries.bySource[s.value] ?? 0} max={max} to={enq({ source: s.value })} drillLabel={`${s.label} enquiries, open the list`} tone="bg-brand-ink" />);
                })()}
              </ul>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 print:break-inside-avoid">
            <Card className="space-y-3 p-6" role="region" aria-labelledby="enq-status-title">
              <h2 id="enq-status-title" className="font-display text-lg font-semibold text-fg">Enquiries by status</h2>
              <ul className="space-y-1">
                {(() => {
                  const max = Math.max(...STATUSES.map((s) => data.enquiries.byStatus[s.value] ?? 0));
                  return STATUSES.map((s) => <BarRow key={s.value} label={s.label} value={data.enquiries.byStatus[s.value] ?? 0} max={max} to={enq({ status: s.value })} drillLabel={`${s.label} enquiries, open the list`} tone="bg-brand-ink" />);
                })()}
              </ul>
            </Card>
            <Card className="space-y-3 p-6" role="region" aria-labelledby="reg-status-title">
              <h2 id="reg-status-title" className="font-display text-lg font-semibold text-fg">Registrations by status</h2>
              <ul className="space-y-1">
                {(() => {
                  const max = Math.max(...REGISTRATION_STATUSES.map((s) => data.registrations.byStatus[s.value] ?? 0));
                  return REGISTRATION_STATUSES.map((s) => <BarRow key={s.value} label={s.label} value={data.registrations.byStatus[s.value] ?? 0} max={max} to={reg({ status: s.value })} drillLabel={`${s.label} registrations, open the list`} />);
                })()}
              </ul>
            </Card>
          </div>

          <div className="print:break-inside-avoid"><Trend d={data} /></div>
        </>
      ) : null}
    </section>
  );
}
