import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ban, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, ConfirmDialog, PageHeader, cx } from '../../design-system';
import { useAccessState } from '../../shell/AccessProvider';
import { useAuth } from '../../shell/AuthProvider';
import { formatDate } from '../adm/dates';
import { approvalHref, CHANGE_STATUS_LABELS, classLine, createElectivesApi, ElectivesError, PAGE_SIZE, type StudentElectiveChange } from './electives';
import { CONTROL, ElectivePill, EmptyRow, LoadError, Pager, TH, THEAD } from './ElectiveParts';

const ICON = 'inline-flex size-10 items-center justify-center rounded-md text-fg-muted hover:bg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle';

/** STU-05 Elective change requests: swaps of one chosen subject for another, decided in the approvals inbox. */
export function ElectiveChangesPage() {
  const { session } = useAuth();
  const api = useMemo(() => createElectivesApi(session), [session]);
  const access = useAccessState();
  const can = (code: string) => access.phase === 'ready' && access.access.can(code);
  const canCancel = can('stu.student_elective_approvals.edit');
  const [rows, setRows] = useState<StudentElectiveChange[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [load, setLoad] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState<StudentElectiveChange | null>(null);
  const [comment, setComment] = useState('');
  const [dialogError, setDialogError] = useState('');
  const [busy, setBusy] = useState(false);
  const latest = useRef(0);

  useEffect(() => {
    const t = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);
  const reload = useCallback(async () => {
    const mine = ++latest.current;
    setLoad('loading');
    try {
      const r = await api.changesList({ page, pageSize: PAGE_SIZE, search: query, status });
      if (mine !== latest.current) return;
      setRows(r.items);
      setTotal(r.page.total);
      setLoad('ready');
    } catch (e) {
      if (mine !== latest.current) return;
      setError(e instanceof ElectivesError ? e.message : 'Something went wrong.');
      setLoad('error');
    }
  }, [api, page, query, status]);
  useEffect(() => { void reload(); }, [reload]);

  const cancel = async () => {
    if (!cancelling) return;
    setBusy(true);
    setDialogError('');
    try {
      await api.changeCancel(cancelling.id, { comment: comment.trim() || undefined });
      toast.success('Request cancelled.');
      setCancelling(null);
      await reload();
    } catch (e) {
      setDialogError(e instanceof ElectivesError ? e.message : 'Something went wrong. Please try again.');
      if (e instanceof ElectivesError && e.status === 409) void reload();
    } finally {
      setBusy(false);
    }
  };

  if (access.phase === 'ready' && !can('stu.student_elective_approvals.view')) return null;
  return (
    <section className="space-y-4">
      <PageHeader title="Elective change requests" description={total > 0 ? `${total} ${total === 1 ? 'request' : 'requests'}` : 'Requests to swap one elective subject for another. Approvers decide them in Approvals.'} />
      <div className="flex flex-wrap items-center gap-3">
        <input type="search" aria-label="Search requests" placeholder="Search by student or code" value={search} onChange={(e) => setSearch(e.target.value)} className={cx(CONTROL, 'w-full max-w-sm placeholder:text-fg-subtle')} />
        <select aria-label="Status" className={CONTROL} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }}>
          <option value="">All statuses</option>
          {Object.entries(CHANGE_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
      </div>
      {load === 'error' ? <LoadError message={error} onRetry={() => void reload()} /> : (
        <Card className="overflow-x-auto focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle" tabIndex={0} role="region" aria-label="Elective change requests">
          <table className="w-full text-left text-sm" aria-busy={load === 'loading'}>
            <thead className={THEAD}>
              <tr>
                {['Student', 'Change', 'Wanted from', 'Reason', 'Status'].map((h) => <th key={h} scope="col" className={TH}>{h}</th>)}
                <th scope="col" className={cx(TH, 'text-right')}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {load === 'loading' && rows.length === 0 ? <tr><td colSpan={6} className="px-5 py-16 text-center text-fg-muted">Loading…</td></tr> : null}
              {load === 'ready' && rows.length === 0 ? <EmptyRow cols={6} text={query || status ? 'No requests match these filters.' : 'No change requests yet. Ask for one from a student’s row on Student electives.'} /> : null}
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line-subtle last:border-0">
                  <td className="px-5 py-3"><div className="font-medium text-fg">{r.student.name}</div><div className="text-xs text-fg-muted">{r.student.registrationCode} · {classLine(r)}</div></td>
                  <td className="px-5 py-3 text-fg"><span className="text-fg-muted line-through">{r.fromSubject.name}</span> → {r.toSubject.name}<div className="text-xs text-fg-muted">{r.group.name}</div></td>
                  <td className="whitespace-nowrap px-5 py-3 text-fg-muted">{formatDate(r.wantedFrom)}</td>
                  <td className="max-w-xs px-5 py-3 text-fg-muted">{r.reason}{r.decision?.note ? <p className="mt-1 text-xs">Approver: {r.decision.note}</p> : null}</td>
                  <td className="px-5 py-3"><ElectivePill status={r.status} change /></td>
                  <td className="whitespace-nowrap px-5 py-3 text-right">
                    {r.status === 'requested' && r.approvalRequestId ? <Link className={ICON} aria-label={`Open the approval for ${r.student.name}`} to={approvalHref(r.approvalRequestId)}><ShieldCheck aria-hidden="true" className="size-4" /></Link> : null}
                    {r.status === 'requested' && canCancel ? <button type="button" className={ICON} aria-label={`Cancel the request for ${r.student.name}`} onClick={() => { setComment(''); setDialogError(''); setCancelling(r); }}><Ban aria-hidden="true" className="size-4" /></button> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {load === 'ready' ? <Pager page={page} total={total} onPage={setPage} /> : null}
      {cancelling ? (
        <ConfirmDialog open title="Cancel this request?" onClose={() => setCancelling(null)}>
          <p className="text-sm text-fg-muted">{cancelling.student.name} keeps {cancelling.fromSubject.name}. The approver is no longer asked.</p>
          <label htmlFor="cancel-comment" className="mt-4 block text-sm font-medium text-fg">Comment (optional)</label>
          <textarea id="cancel-comment" rows={2} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} className={cx(CONTROL, 'mt-1 h-auto w-full py-2')} />
          {dialogError ? <p role="alert" className="mt-3 text-sm text-danger">{dialogError}</p> : null}
          <div className="mt-5 flex gap-2">
            <Button variant="destructive" loading={busy} onClick={() => void cancel()}>Cancel request</Button>
            <Button variant="secondary" onClick={() => setCancelling(null)}>Keep it</Button>
          </div>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
