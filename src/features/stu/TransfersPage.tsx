import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ban, Check, ChevronLeft, ChevronRight, Eye, Inbox, Pencil, Plus, Printer, Search, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, ConfirmDialog, PageHeader, buttonVariants, cx } from '../../design-system';
import { useAccessState } from '../../shell/AccessProvider';
import { useAuth } from '../../shell/AuthProvider';
import { formatDate } from '../adm/dates';
import { TransferDetail, DuesNote, TransferStatusPill } from './TransferDetail';
import { TransferSheet } from './TransferSheet';
import {
  allowedActions, approvalHref, certificateHref, classLine, createTransfersApi, PAGE_SIZE, STATUSES, todayIndia, TransfersError,
  type Transfer, type TransferAction, type TransferPerms,
} from './transfers';

const CONTROL = 'h-10 rounded-md border border-line bg-surface px-3 text-sm text-fg shadow-soft hover:border-line-strong focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle';

type Dialog = { kind: 'complete' | 'cancel' | 'delete'; row: Transfer };
type Editing = { mode: 'create' } | { mode: 'edit'; row: Transfer };

/** The column headers that can sort the list, and the key the server expects for each. */
const COLUMNS: { key: string; label: string; sort?: string }[] = [
  { key: 'transfer', label: 'Transfer', sort: 'transfer' },
  { key: 'student', label: 'Student', sort: 'student' },
  { key: 'requested', label: 'Requested', sort: 'requested' },
  { key: 'dues', label: 'Dues' },
  { key: 'status', label: 'Status', sort: 'status' },
];

/** STU-08 Student transfers: the list, request/edit sheet, detail, and the steps that complete, cancel or delete a transfer. */
export function TransfersPage() {
  const { session } = useAuth();
  const api = useMemo(() => createTransfersApi(session), [session]);
  const access = useAccessState();
  const can = (code: string) => access.phase === 'ready' && access.access.can(code);
  const perms: TransferPerms = { view: can('stu.student_transfers.view'), create: can('stu.student_transfers.create'), edit: can('stu.student_transfers.edit'), delete: can('stu.student_transfers.delete') };
  const canViewStudents = can('stu.students.view');

  const [rows, setRows] = useState<Transfer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState('-requested');
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
  const [detail, setDetail] = useState<Transfer | null>(null);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [issuedOn, setIssuedOn] = useState('');
  const [comment, setComment] = useState('');
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
      setError(e instanceof TransfersError ? e.message : 'Something went wrong.');
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

  const openDialog = (kind: Dialog['kind'], row: Transfer) => {
    setDialogError('');
    setComment('');
    setIssuedOn(todayIndia());
    setDialog({ kind, row });
  };

  const act = (a: TransferAction, row: Transfer) => {
    if (a === 'view') setDetail(row);
    else if (a === 'edit') setEditing({ mode: 'edit', row });
    else if (a === 'complete' || a === 'cancel' || a === 'delete') openDialog(a, row);
  };

  const runDialog = async () => {
    if (!dialog) return;
    const { kind, row } = dialog;
    setBusy(true);
    setDialogError('');
    try {
      if (kind === 'complete') {
        if (issuedOn && issuedOn > todayIndia()) {
          setDialogError('The issue date cannot be in the future.');
          return;
        }
        if (issuedOn && issuedOn < row.requestedOn) {
          setDialogError('The issue date cannot be before the request date.');
          return;
        }
        const r = await api.complete(row.id, issuedOn || undefined);
        const tc = r.transfer.tcNumber ?? 'a transfer certificate';
        say(r.alreadyCompleted ? `${row.student.name} was already transferred as ${tc}. Nothing was changed.` : `${row.student.name} is transferred. ${tc} issued.`);
        if (detail?.id === row.id) setDetail(r.transfer);
      } else if (kind === 'cancel') {
        const t = await api.cancel(row.id, comment);
        say('Transfer cancelled.');
        if (detail?.id === row.id) setDetail(t);
      } else {
        await api.remove(row.id);
        say('Transfer deleted.');
        if (detail?.id === row.id) setDetail(null);
        if (rows.length === 1 && page > 1) setPage(page - 1);
      }
      setDialog(null);
      await reload();
    } catch (e) {
      setDialogError(e instanceof TransfersError ? (e.fields.issuedOn ?? e.message) : 'Something went wrong. Please try again.');
      // The row changed under us (someone approved or cancelled it): show what is true now.
      if (e instanceof TransfersError && e.status === 409) void reload();
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
        title="Student transfers"
        description={total > 0 ? `${total} ${total === 1 ? 'transfer' : 'transfers'}` : 'Students leaving the school, from the request to the transfer certificate.'}
        actions={
          perms.create ? (
            <Button onClick={() => setEditing({ mode: 'create' })}>
              <Plus aria-hidden="true" className="size-4" />
              Request transfer
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <input type="search" aria-label="Search transfers" placeholder="Search by student, code or TC number" value={search} onChange={(e) => setSearch(e.target.value)} className={cx(CONTROL, 'w-full pl-10 placeholder:text-fg-subtle')} />
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
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {load === 'ready' && rows.length === 0 ? (
                <tr>
                  <td colSpan={COLUMNS.length + 1} className="px-5 py-16 text-center text-fg-muted">
                    <Inbox aria-hidden="true" className="mx-auto mb-3 size-6 text-fg-subtle" />
                    {query ? `No transfers match “${query}”.` : filtered ? 'No transfers match these filters.' : 'No transfers yet.'}
                    {!query && !filtered && perms.create ? ' Use “Request transfer” when a student is leaving.' : ''}
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
                <TransferRow key={r.id} row={r} actions={allowedActions(r, perms)} onAction={(a) => act(a, r)} />
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

      {detail && !editing ? <TransferDetail transfer={detail} actions={allowedActions(detail, perms)} onClose={() => setDetail(null)} onAction={(a) => act(a, detail)} /> : null}

      {editing ? (
        <TransferSheet
          api={api}
          transfer={editing.mode === 'edit' ? editing.row : undefined}
          canViewStudents={canViewStudents}
          onClose={() => setEditing(null)}
          onSaved={(t, created) => {
            setEditing(null);
            if (detail && !created) setDetail(t);
            setNotice(created ? 'Transfer requested.' : 'Transfer saved.');
            if (created) {
              setPage(1);
              setSort('-requested');
            }
            void reload();
          }}
        />
      ) : null}

      {dialog ? (
        <ConfirmDialog open title={dialogTitle(dialog)} onClose={() => setDialog(null)}>
          <DialogBody dialog={dialog} issuedOn={issuedOn} onIssuedOn={setIssuedOn} comment={comment} onComment={setComment} />
          {dialogError ? (
            <p role="alert" className="mt-3 text-sm text-danger">
              {dialogError}
            </p>
          ) : null}
          <div className="mt-5 flex gap-2">
            <Button variant={dialog.kind === 'complete' ? 'primary' : 'destructive'} loading={busy} onClick={() => void runDialog()}>
              {dialog.kind === 'complete' ? 'Complete transfer' : dialog.kind === 'cancel' ? 'Cancel transfer' : 'Delete'}
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

function dialogTitle(d: Dialog): string {
  const who = d.row.student.name;
  return d.kind === 'complete' ? `Complete the transfer of ${who}?` : d.kind === 'cancel' ? `Cancel the transfer of ${who}?` : `Delete this transfer of ${who}?`;
}

function DialogBody({ dialog, issuedOn, onIssuedOn, comment, onComment }: { dialog: Dialog; issuedOn: string; onIssuedOn: (v: string) => void; comment: string; onComment: (v: string) => void }) {
  if (dialog.kind === 'complete') {
    return (
      <div className="space-y-3 text-sm text-fg-muted">
        <p>
          This marks the student as <strong className="font-medium text-fg">transferred</strong>, closes their enrolment and gives the next TC number. It cannot be undone.
        </p>
        <label className="flex flex-col gap-1 text-fg">
          <span className="font-medium">Certificate issue date</span>
          <input type="date" value={issuedOn} min={dialog.row.requestedOn} max={todayIndia()} onChange={(e) => onIssuedOn(e.target.value)} className={cx(CONTROL, 'w-full')} />
        </label>
      </div>
    );
  }
  if (dialog.kind === 'cancel') {
    return (
      <div className="space-y-3 text-sm text-fg-muted">
        <p>The student stays enrolled and nothing else changes. A cancelled transfer can be deleted later, or a new one requested.</p>
        <label className="flex flex-col gap-1 text-fg">
          <span className="font-medium">Reason (optional)</span>
          <textarea value={comment} maxLength={1000} onChange={(e) => onComment(e.target.value)} className={cx(CONTROL, 'min-h-20 w-full py-2')} />
        </label>
      </div>
    );
  }
  return <p className="text-sm text-fg-muted">This removes the cancelled or rejected request from the list. The student’s record is not affected.</p>;
}

const ROW_BTN = 'whitespace-nowrap';

/** One row: the details the school reads at a glance, and the actions that fit its status. */
function TransferRow({ row: r, actions, onAction }: { row: Transfer; actions: TransferAction[]; onAction: (a: TransferAction) => void }) {
  const has = (a: TransferAction) => actions.includes(a);
  const who = `${r.student.name} (${r.student.registrationCode})`;
  return (
    <tr className="border-b border-line-subtle transition-colors last:border-0 hover:bg-canvas">
      <td className="whitespace-nowrap px-5 py-3.5 font-medium text-fg">{r.tcNumber ?? <span className="text-fg-subtle" aria-label="No TC number yet">—</span>}</td>
      <td className="px-5 py-3.5">
        <button type="button" onClick={() => onAction('view')} className="rounded text-left font-medium text-fg underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
          {r.student.name}
        </button>
        <span className="block whitespace-nowrap text-xs text-fg-subtle">{r.className ? `${r.student.registrationCode} · ${classLine(r)}` : r.student.registrationCode}</span>
      </td>
      <td className="whitespace-nowrap px-5 py-3.5 text-fg-muted">{formatDate(r.requestedOn)}</td>
      <td className="whitespace-nowrap px-5 py-3.5">
        <DuesNote />
      </td>
      <td className="px-5 py-3.5">
        <TransferStatusPill status={r.status} />
      </td>
      <td className="px-5 py-2.5">
        <div className="flex min-w-[26rem] flex-wrap justify-end gap-1">
          {has('view') ? (
            <Button size="sm" variant="ghost" className={ROW_BTN} onClick={() => onAction('view')} aria-label={`View ${who}`}>
              <Eye aria-hidden="true" className="size-3.5" />
              View
            </Button>
          ) : null}
          {has('edit') ? (
            <Button size="sm" variant="ghost" className={ROW_BTN} onClick={() => onAction('edit')} aria-label={`Edit ${who}`}>
              <Pencil aria-hidden="true" className="size-3.5" />
              Edit
            </Button>
          ) : null}
          {has('openApproval') && r.approvalRequestId ? (
            <Link to={approvalHref(r.approvalRequestId)} aria-label={`Open approval for ${who}`} className={cx(buttonVariants({ variant: 'ghost', size: 'sm' }), ROW_BTN)}>
              <ShieldCheck aria-hidden="true" className="size-3.5" />
              Open approval
            </Link>
          ) : null}
          {has('complete') ? (
            <Button size="sm" variant="ghost" className={cx(ROW_BTN, 'text-accent-fg')} onClick={() => onAction('complete')} aria-label={`Complete transfer of ${who}`}>
              <Check aria-hidden="true" className="size-3.5" />
              Complete
            </Button>
          ) : null}
          {has('printCertificate') ? (
            <Link to={certificateHref(r.id)} aria-label={`Print TC of ${who}`} className={cx(buttonVariants({ variant: 'ghost', size: 'sm' }), ROW_BTN, 'text-accent-fg')}>
              <Printer aria-hidden="true" className="size-3.5" />
              Print TC
            </Link>
          ) : null}
          {has('cancel') ? (
            <Button size="sm" variant="ghost" className={cx(ROW_BTN, 'hover:text-danger')} onClick={() => onAction('cancel')} aria-label={`Cancel transfer of ${who}`}>
              <Ban aria-hidden="true" className="size-3.5" />
              Cancel
            </Button>
          ) : null}
          {has('delete') ? (
            <Button size="sm" variant="ghost" className={cx(ROW_BTN, 'hover:text-danger')} onClick={() => onAction('delete')} aria-label={`Delete transfer of ${who}`}>
              <Trash2 aria-hidden="true" className="size-3.5" />
              Delete
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
  );
}
