import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ban, ChevronLeft, ChevronRight, Eye, Inbox, Pencil, Plus, Search, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, ConfirmDialog, PageHeader, cx } from '../../design-system';
import { useAccessState } from '../../shell/AccessProvider';
import { useAuth } from '../../shell/AuthProvider';
import { formatDate } from '../adm/dates';
import { PauseDetail, PauseStatusPill } from './PauseDetail';
import { PauseSheet } from './PauseSheet';
import { allowedActions, classLine, createPausesApi, daysLabel, PAGE_SIZE, PausesError, reasonLabel, STATUSES, todayIndia, type Pause, type PauseAction, type PausePerms } from './pauses';

const CONTROL = 'h-10 rounded-md border border-line bg-surface px-3 text-sm text-fg shadow-soft hover:border-line-strong focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle';

type Dialog = { kind: 'end' | 'cancel'; row: Pause };
type Editing = { mode: 'create' } | { mode: 'edit'; row: Pause };

/** The column headers that can sort the list, and the key the server expects for each. */
const COLUMNS: { key: string; label: string; sort?: string }[] = [
  { key: 'student', label: 'Student', sort: 'student' },
  { key: 'from', label: 'Paused from · days', sort: 'from' },
  { key: 'back', label: 'Expected back', sort: 'expectedBack' },
  { key: 'reason', label: 'Reason' },
  { key: 'status', label: 'Status', sort: 'status' },
];

/** STU-09 Student pauses: the list, the pause/edit sheet, the detail, and the steps that mark a student back or cancel a pause. */
export function PausesPage() {
  const { session } = useAuth();
  const api = useMemo(() => createPausesApi(session), [session]);
  const access = useAccessState();
  const can = (code: string) => access.phase === 'ready' && access.access.can(code);
  const perms: PausePerms = { view: can('stu.student_pauses.view'), create: can('stu.student_pauses.create'), edit: can('stu.student_pauses.edit') };
  const canViewStudents = can('stu.students.view');

  const [rows, setRows] = useState<Pause[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('-from');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [classId, setClassId] = useState('');
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [load, setLoad] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const latest = useRef(0);

  const [editing, setEditing] = useState<Editing | null>(null);
  const [detail, setDetail] = useState<Pause | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [endedOn, setEndedOn] = useState('');
  const [note, setNote] = useState('');
  const [dialogError, setDialogError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.classes().then(setClasses).catch(() => setClasses([]));
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
      const r = await api.list({ page, pageSize: PAGE_SIZE, sort, search: query, status, classId });
      if (mine !== latest.current) return;
      setRows(r.items);
      setTotal(r.page.total);
      setLoad('ready');
    } catch (e) {
      if (mine !== latest.current) return;
      setError(e instanceof PausesError ? e.message : 'Something went wrong.');
      setLoad('error');
    }
  }, [api, page, sort, query, status, classId]);
  useEffect(() => {
    void reload();
  }, [reload]);

  const say = (msg: string) => {
    setNotice(msg);
    toast.success(msg);
  };

  const sortKey = sort.replace(/^-/, '');
  const descending = sort.startsWith('-');
  const toggleSort = (key: string) => {
    setSort(sortKey === key && !descending ? `-${key}` : key);
    setPage(1);
  };

  const openDialog = (kind: Dialog['kind'], row: Pause) => {
    setDialogError('');
    setNote('');
    setEndedOn(todayIndia());
    setDialog({ kind, row });
  };

  const act = (a: PauseAction, row: Pause) => {
    if (a === 'view') setDetail(row);
    else if (a === 'edit') setEditing({ mode: 'edit', row });
    else openDialog(a, row);
  };

  const runDialog = async () => {
    if (!dialog) return;
    const { kind, row } = dialog;
    setBusy(true);
    setDialogError('');
    try {
      if (kind === 'end') {
        if (endedOn && endedOn > todayIndia()) {
          setDialogError('The day the student came back cannot be in the future.');
          return;
        }
        if (endedOn && endedOn < row.pausedFrom) {
          setDialogError('The student cannot be back before the pause began.');
          return;
        }
        const p = await api.end(row.id, endedOn || undefined, note);
        say(`${row.student.name} is back and active again.`);
        if (detail?.id === row.id) setDetail(p);
      } else {
        const p = await api.cancel(row.id, note);
        say('Pause cancelled. The student is active again.');
        if (detail?.id === row.id) setDetail(p);
      }
      setDialog(null);
      await reload();
    } catch (e) {
      setDialogError(e instanceof PausesError ? (e.fields.endedOn ?? e.message) : 'Something went wrong. Please try again.');
      // The row changed under us (someone else ended it): show what is true now.
      if (e instanceof PausesError && e.status === 409) void reload();
    } finally {
      setBusy(false);
    }
  };

  const filtered = Boolean(status || classId);
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  if (access.phase === 'ready' && !perms.view) return null;

  return (
    <section className="space-y-4">
      <PageHeader
        title="Student pauses"
        description={total > 0 ? `${total} ${total === 1 ? 'pause' : 'pauses'}` : 'Students who are away for a while and expected back.'}
        actions={
          perms.create ? (
            <Button onClick={() => setEditing({ mode: 'create' })}>
              <Plus aria-hidden="true" className="size-4" />
              Pause a student
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <input type="search" aria-label="Search pauses" placeholder="Search by student name or code" value={search} onChange={(e) => setSearch(e.target.value)} className={cx(CONTROL, 'w-full pl-10 placeholder:text-fg-subtle')} />
        </div>
        <select
          aria-label="Status"
          className={CONTROL}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        {classes.length > 0 ? (
          <select
            aria-label="Class"
            className={CONTROL}
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {notice}
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
                  <th key={c.key} scope="col" aria-sort={c.sort && sortKey === c.sort ? (descending ? 'descending' : 'ascending') : undefined} className="whitespace-nowrap px-4 py-3.5 font-semibold">
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
                <th scope="col" className="px-4 py-3.5 text-right font-semibold">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {load === 'ready' && rows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="px-5 py-16 text-center text-fg-muted">
                    <Inbox aria-hidden="true" className="mx-auto mb-3 size-6 text-fg-subtle" />
                    {query ? `No pauses match “${query}”.` : filtered ? 'No pauses match these filters.' : 'No pauses yet.'}
                    {!query && !filtered && perms.create ? ' Use “Pause a student” when a student will be away for a while.' : ''}
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
                <PauseRow key={r.id} row={r} actions={allowedActions(r, perms)} onAction={(a) => act(a, r)} />
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

      {detail && !editing ? <PauseDetail pause={detail} actions={allowedActions(detail, perms)} onClose={() => setDetail(null)} onAction={(a) => act(a, detail)} /> : null}

      {editing ? (
        <PauseSheet
          api={api}
          pause={editing.mode === 'edit' ? editing.row : undefined}
          canViewStudents={canViewStudents}
          onClose={() => setEditing(null)}
          onSaved={(p, created) => {
            setEditing(null);
            if (detail && !created) setDetail(p);
            setNotice(created ? 'Student paused.' : 'Pause saved.');
            if (created) {
              setPage(1);
              setSort('-from');
            }
            void reload();
          }}
        />
      ) : null}

      {dialog ? (
        <ConfirmDialog open title={dialog.kind === 'end' ? `Mark ${dialog.row.student.name} as back?` : `Cancel the pause of ${dialog.row.student.name}?`} onClose={() => setDialog(null)}>
          {dialog.kind === 'end' ? (
            <div className="space-y-3 text-sm text-fg-muted">
              <p>
                The pause ends and the student becomes <strong className="font-medium text-fg">active</strong> again.
              </p>
              <label className="flex flex-col gap-1 text-fg">
                <span className="font-medium">Came back on</span>
                <input type="date" value={endedOn} min={dialog.row.pausedFrom} max={todayIndia()} onChange={(e) => setEndedOn(e.target.value)} className={cx(CONTROL, 'w-full')} />
              </label>
              <label className="flex flex-col gap-1 text-fg">
                <span className="font-medium">Note (optional)</span>
                <textarea value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} className={cx(CONTROL, 'min-h-20 w-full py-2')} />
              </label>
            </div>
          ) : (
            <div className="space-y-3 text-sm text-fg-muted">
              <p>Use this when the pause was recorded by mistake. The student becomes active again and the pause stays in the list as cancelled.</p>
              <label className="flex flex-col gap-1 text-fg">
                <span className="font-medium">Note (optional)</span>
                <textarea value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} className={cx(CONTROL, 'min-h-20 w-full py-2')} />
              </label>
            </div>
          )}
          {dialogError ? (
            <p role="alert" className="mt-3 text-sm text-danger">
              {dialogError}
            </p>
          ) : null}
          <div className="mt-5 flex gap-2">
            <Button variant={dialog.kind === 'end' ? 'primary' : 'destructive'} loading={busy} onClick={() => void runDialog()}>
              {dialog.kind === 'end' ? 'Mark back' : 'Cancel pause'}
            </Button>
            <Button variant="secondary" onClick={() => setDialog(null)}>
              {dialog.kind === 'cancel' ? 'Keep it' : 'Back'}
            </Button>
          </div>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}

const ROW_BTN = 'whitespace-nowrap';

/** One row: what the school reads at a glance, and the actions that fit its status. */
function PauseRow({ row: r, actions, onAction }: { row: Pause; actions: PauseAction[]; onAction: (a: PauseAction) => void }) {
  const has = (a: PauseAction) => actions.includes(a);
  const who = `${r.student.name} (${r.student.registrationCode})`;
  return (
    <tr className="border-b border-line-subtle transition-colors last:border-0 hover:bg-canvas">
      <td className="px-4 py-3.5">
        <button type="button" onClick={() => onAction('view')} className="rounded text-left font-medium text-fg underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          {r.student.name}
        </button>
        <span className="block whitespace-nowrap text-xs text-fg-subtle">{r.className ? `${r.student.registrationCode} · ${classLine(r)}` : r.student.registrationCode}</span>
      </td>
      <td className="whitespace-nowrap px-4 py-3.5 text-fg-muted">
        {formatDate(r.pausedFrom)}
        <span className="block text-xs text-fg-subtle">{daysLabel(r.days)}</span>
      </td>
      <td className="whitespace-nowrap px-4 py-3.5 text-fg-muted">
        {r.expectedBack ? formatDate(r.expectedBack) : <span className="text-fg-subtle">Not set</span>}
        {r.overdue ? <span className="ml-2 rounded-full border border-danger-line bg-danger-bg px-2 py-0.5 text-xs font-medium text-danger">Overdue</span> : null}
      </td>
      <td className="whitespace-nowrap px-4 py-3.5 text-fg-muted">{reasonLabel(r.reason)}</td>
      <td className="px-4 py-3.5">
        <PauseStatusPill status={r.status} />
      </td>
      <td className="px-3 py-2.5">
        <div className="flex flex-nowrap items-center justify-end gap-1">
          {has('view') ? (
            <Button size="sm" variant="ghost" className={ROW_BTN} onClick={() => onAction('view')} aria-label={`View pause of ${who}`} title="View">
              <Eye aria-hidden="true" className="size-3.5" />
            </Button>
          ) : null}
          {has('edit') ? (
            <Button size="sm" variant="ghost" className={ROW_BTN} onClick={() => onAction('edit')} aria-label={`Edit pause of ${who}`} title="Edit">
              <Pencil aria-hidden="true" className="size-3.5" />
            </Button>
          ) : null}
          {has('end') ? (
            <Button size="sm" variant="ghost" className={cx(ROW_BTN, 'text-accent-fg')} onClick={() => onAction('end')} aria-label={`Mark ${who} back`}>
              <UserCheck aria-hidden="true" className="size-3.5" />
              Mark back
            </Button>
          ) : null}
          {has('cancel') ? (
            <Button size="sm" variant="ghost" className={cx(ROW_BTN, 'hover:text-danger')} onClick={() => onAction('cancel')} aria-label={`Cancel pause of ${who}`} title="Cancel pause">
              <Ban aria-hidden="true" className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
