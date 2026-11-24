import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Inbox, Search } from 'lucide-react';
import { Button, Card, PageHeader, cx } from '../../design-system';
import { useAccessState } from '../../shell/AccessProvider';
import { useAuth } from '../../shell/AuthProvider';
import { formatDate } from '../adm/dates';
import { AlumniDetail, ReasonPill } from './AlumniDetail';
import { AlumniError, createAlumniApi, lastClassLine, PAGE_SIZE, REASONS, UNKNOWN_EXIT, type Alumnus } from './alumni';

const CONTROL = 'h-10 rounded-md border border-line bg-surface px-3 text-sm text-fg shadow-soft hover:border-line-strong focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle';

/** The column headers that can sort the list, and the key the server expects for each. */
const COLUMNS: { key: string; label: string; sort?: string }[] = [
  { key: 'student', label: 'Student', sort: 'student' },
  { key: 'class', label: 'Last class', sort: 'class' },
  { key: 'year', label: 'Year', sort: 'year' },
  { key: 'reason', label: 'Reason', sort: 'reason' },
  { key: 'exit', label: 'Exit date', sort: 'exit' },
];

/** STU-10 Alumni: a read-only list of former students (graduates and transferred students) with a detail sheet. */
export function AlumniPage() {
  const { session } = useAuth();
  const api = useMemo(() => createAlumniApi(session), [session]);
  const access = useAccessState();
  const canView = access.phase === 'ready' && access.access.can('stu.alumni.view');

  const [rows, setRows] = useState<Alumnus[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('-exit');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [reason, setReason] = useState('');
  const [classId, setClassId] = useState('');
  const [yearId, setYearId] = useState('');
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [years, setYears] = useState<{ id: string; name: string }[]>([]);
  const [load, setLoad] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [detail, setDetail] = useState<Alumnus | null>(null);
  const latest = useRef(0);

  useEffect(() => {
    api.classes().then(setClasses).catch(() => setClasses([]));
    api.years().then(setYears).catch(() => setYears([]));
  }, [api]);

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const reload = useCallback(async () => {
    const mine = ++latest.current;
    setLoad('loading');
    try {
      const r = await api.list({ page, pageSize: PAGE_SIZE, sort, search: query, reason, classId, yearId });
      if (mine !== latest.current) return;
      setRows(r.items);
      setTotal(r.page.total);
      setLoad('ready');
    } catch (e) {
      if (mine !== latest.current) return;
      setError(e instanceof AlumniError ? e.message : 'Something went wrong.');
      setLoad('error');
    }
  }, [api, page, sort, query, reason, classId, yearId]);
  useEffect(() => {
    void reload();
  }, [reload]);

  const sortKey = sort.replace(/^-/, '');
  const descending = sort.startsWith('-');
  const toggleSort = (key: string) => {
    setSort(sortKey === key && !descending ? `-${key}` : key);
    setPage(1);
  };
  const filter = (set: (v: string) => void) => (e: { target: { value: string } }) => {
    set(e.target.value);
    setPage(1);
  };

  const filtered = Boolean(reason || classId || yearId);
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  if (access.phase === 'ready' && !canView) return null;

  return (
    <section className="space-y-4">
      <PageHeader title="Alumni" description={total > 0 ? `${total} former ${total === 1 ? 'student' : 'students'}` : 'Students who graduated or moved to another school.'} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <input type="search" aria-label="Search alumni" placeholder="Search by name, code or TC number" value={search} onChange={(e) => setSearch(e.target.value)} className={cx(CONTROL, 'w-full pl-10 placeholder:text-fg-subtle')} />
        </div>
        <select aria-label="Reason" className={CONTROL} value={reason} onChange={filter(setReason)}>
          <option value="">All reasons</option>
          {REASONS.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        {classes.length > 0 ? (
          <select aria-label="Last class" className={CONTROL} value={classId} onChange={filter(setClassId)}>
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : null}
        {years.length > 0 ? (
          <select aria-label="Year" className={CONTROL} value={yearId} onChange={filter(setYearId)}>
            <option value="">All years</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      {load === 'error' ? (
        <div role="alert" className="space-y-3 rounded-lg border border-danger-line bg-surface p-6 shadow-soft">
          <p className="text-fg">{error}</p>
          <Button variant="secondary" onClick={() => void reload()}>
            Try again
          </Button>
        </div>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm" aria-busy={load === 'loading'}>
            <thead className="border-b border-line-subtle text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key} scope="col" aria-sort={c.sort && sortKey === c.sort ? (descending ? 'descending' : 'ascending') : undefined} className="whitespace-nowrap px-5 py-3.5 font-semibold">
                    {c.sort ? (
                      <button type="button" className="inline-flex items-center gap-1 uppercase tracking-[inherit] hover:text-fg" onClick={() => toggleSort(c.sort!)}>
                        {c.label}
                        {sortKey === c.sort ? <span aria-hidden="true">{descending ? '↓' : '↑'}</span> : null}
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                ))}
                <th scope="col" className="px-5 py-3.5 text-right font-semibold">
                  Detail
                </th>
              </tr>
            </thead>
            <tbody>
              {load === 'ready' && rows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="px-5 py-16 text-center text-fg-muted">
                    <Inbox aria-hidden="true" className="mx-auto mb-3 size-6 text-fg-subtle" />
                    {query ? `No alumni match “${query}”.` : filtered ? 'No alumni match these filters.' : 'No alumni yet. Students appear here after they graduate or transfer out.'}
                  </td>
                </tr>
              ) : null}
              {load === 'loading' && rows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="px-5 py-16 text-center text-fg-muted">
                    Loading…
                  </td>
                </tr>
              ) : null}
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line-subtle transition-colors last:border-0 hover:bg-canvas">
                  <td className="px-5 py-3.5">
                    <button type="button" onClick={() => setDetail(r)} className="rounded text-left font-medium text-fg underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                      {r.name}
                    </button>
                    <span className="block whitespace-nowrap text-xs text-fg-subtle">{r.registrationCode}</span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-fg-muted">{lastClassLine(r)}</td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-fg-muted">{r.yearName ?? '—'}</td>
                  <td className="px-5 py-3.5">
                    <ReasonPill reason={r.reason} label={r.reasonLabel} />
                  </td>
                  <td className="whitespace-nowrap px-5 py-3.5 text-fg-muted">{r.exitDate ? formatDate(r.exitDate) : <span className="text-fg-subtle">{UNKNOWN_EXIT}</span>}</td>
                  <td className="px-5 py-2.5 text-right">
                    <Button size="sm" variant="ghost" className="whitespace-nowrap" onClick={() => setDetail(r)} aria-label={`View details of ${r.name} (${r.registrationCode})`}>
                      <Eye aria-hidden="true" className="size-3.5" />
                      Details
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {load === 'ready' && total > 0 ? (
        <nav className="flex items-center justify-between text-sm text-fg-muted" aria-label="Pagination">
          <span>
            Showing {from}–{to} of {total}
          </span>
          <span className="flex items-center gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft aria-hidden="true" className="size-4" />
              Previous
            </Button>
            <Button size="sm" variant="secondary" disabled={page >= lastPage} onClick={() => setPage(page + 1)}>
              Next
              <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
          </span>
        </nav>
      ) : null}

      {detail ? <AlumniDetail alumnus={detail} onClose={() => setDetail(null)} /> : null}
    </section>
  );
}
