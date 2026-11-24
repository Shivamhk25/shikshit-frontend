import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRightLeft, Pencil, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, ConfirmDialog, PageHeader, cx } from '../../design-system';
import { useAccessState } from '../../shell/AccessProvider';
import { useAuth } from '../../shell/AuthProvider';
import { createElectivesApi, ElectivesError, classLine, PAGE_SIZE, STATUS_LABELS, type StudentElective } from './electives';
import { CONTROL, ElectivePill, EmptyRow, LoadError, Pager, SubjectChips, TH, THEAD } from './ElectiveParts';
import { ElectiveRoster } from './ElectiveRoster';
import { EditChoiceSheet, RequestChangeSheet } from './ElectiveSheets';

type Opt = { id: string; name: string };
type Tab = 'choices' | 'roster';
const ICON = 'inline-flex size-10 items-center justify-center rounded-md text-fg-muted hover:bg-subtle hover:text-fg focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle';

/** STU-04 Student electives: who chose which subjects from each elective group, and a class roster to record them in bulk. */
export function ElectivesPage() {
  const { session } = useAuth();
  const api = useMemo(() => createElectivesApi(session), [session]);
  const access = useAccessState();
  const can = (code: string) => access.phase === 'ready' && access.access.can(code);
  const canEdit = can('stu.student_electives.edit');
  const canDelete = can('stu.student_electives.delete');
  const canRequest = can('stu.student_elective_approvals.create');

  const [tab, setTab] = useState<Tab>('choices');
  const [rows, setRows] = useState<StudentElective[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [groupId, setGroupId] = useState('');
  const [classId, setClassId] = useState('');
  const [groups, setGroups] = useState<Opt[]>([]);
  const [classes, setClasses] = useState<Opt[]>([]);
  const [load, setLoad] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<StudentElective | null>(null);
  const [requesting, setRequesting] = useState<StudentElective | null>(null);
  const [removing, setRemoving] = useState<StudentElective | null>(null);
  const [removeError, setRemoveError] = useState('');
  const [busy, setBusy] = useState(false);
  const latest = useRef(0);

  useEffect(() => {
    api.options('/elective-groups').then(setGroups).catch(() => setGroups([]));
    api.options('/classes').then(setClasses).catch(() => setClasses([]));
  }, [api]);
  useEffect(() => {
    const t = setTimeout(() => { setQuery(search.trim()); setPage(1); }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const reload = useCallback(async () => {
    const mine = ++latest.current;
    setLoad('loading');
    try {
      const r = await api.list({ page, pageSize: PAGE_SIZE, search: query, status, groupId, classId });
      if (mine !== latest.current) return;
      setRows(r.items);
      setTotal(r.page.total);
      setLoad('ready');
    } catch (e) {
      if (mine !== latest.current) return;
      setError(e instanceof ElectivesError ? e.message : 'Something went wrong.');
      setLoad('error');
    }
  }, [api, page, query, status, groupId, classId]);
  useEffect(() => { void reload(); }, [reload]);

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    setRemoveError('');
    try {
      await api.remove(removing.id);
      toast.success('Choice removed.');
      setRemoving(null);
      if (rows.length === 1 && page > 1) setPage(page - 1);
      await reload();
    } catch (e) {
      setRemoveError(e instanceof ElectivesError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const filtered = Boolean(status || groupId || classId);
  const filter = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => { set(e.target.value); setPage(1); };
  if (access.phase === 'ready' && !can('stu.student_electives.view')) return null;

  return (
    <section className="space-y-4">
      <PageHeader title="Student electives" description={tab === 'choices' && total > 0 ? `${total} ${total === 1 ? 'choice' : 'choices'}` : 'The subjects students choose from each elective group.'} />
      <div role="tablist" aria-label="Views" className="flex gap-1 border-b border-line-subtle">
        {([['choices', 'Choices'], ['roster', 'Class roster']] as const).map(([k, label]) => (
          <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cx('min-h-10 border-b-2 px-4 text-sm font-medium focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle', tab === k ? 'border-accent text-fg' : 'border-transparent text-fg-muted hover:text-fg')}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'roster' ? <ElectiveRoster api={api} canSave={canEdit} /> : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-full max-w-sm">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
              <input type="search" aria-label="Search choices" placeholder="Search by student or code" value={search} onChange={(e) => setSearch(e.target.value)} className={cx(CONTROL, 'w-full pl-10 placeholder:text-fg-subtle')} />
            </div>
            <select aria-label="Status" className={CONTROL} value={status} onChange={filter(setStatus)}>
              <option value="">All statuses</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            {groups.length > 0 ? (
              <select aria-label="Elective group" className={CONTROL} value={groupId} onChange={filter(setGroupId)}>
                <option value="">All groups</option>
                {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            ) : null}
            {classes.length > 0 ? (
              <select aria-label="Class" className={CONTROL} value={classId} onChange={filter(setClassId)}>
                <option value="">All classes</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            ) : null}
          </div>

          {load === 'error' ? <LoadError message={error} onRetry={() => void reload()} /> : (
            <Card className="overflow-x-auto focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle" tabIndex={0} role="region" aria-label="Elective choices">
              <table className="w-full text-left text-sm" aria-busy={load === 'loading'}>
                <thead className={THEAD}>
                  <tr>
                    {['Student', 'Class', 'Group', 'Subjects', 'Status'].map((h) => <th key={h} scope="col" className={TH}>{h}</th>)}
                    <th scope="col" className={cx(TH, 'text-right')}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {load === 'loading' && rows.length === 0 ? <tr><td colSpan={6} className="px-5 py-16 text-center text-fg-muted">Loading…</td></tr> : null}
                  {load === 'ready' && rows.length === 0 ? <EmptyRow cols={6} text={query ? `No choices match “${query}”.` : filtered ? 'No choices match these filters.' : 'No elective choices yet. Use the Class roster tab to record them.'} /> : null}
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-line-subtle last:border-0">
                      <td className="px-5 py-3"><div className="font-medium text-fg">{r.student.name}</div><div className="text-xs text-fg-muted">{r.student.registrationCode}</div></td>
                      <td className="whitespace-nowrap px-5 py-3 text-fg-muted">{classLine(r)}<div className="text-xs">{r.yearName}</div></td>
                      <td className="px-5 py-3 text-fg">{r.group.name}</td>
                      <td className="px-5 py-3"><SubjectChips subjects={r.subjects} />{r.withinLimits ? null : <p className="mt-1 text-xs text-warning">{r.warnings[0]?.message ?? 'Outside the group limits.'}</p>}</td>
                      <td className="px-5 py-3"><ElectivePill status={r.status} /></td>
                      <td className="whitespace-nowrap px-5 py-3 text-right">
                        {canEdit ? <button type="button" className={ICON} aria-label={`Edit subjects of ${r.student.name}`} onClick={() => setEditing(r)}><Pencil aria-hidden="true" className="size-4" /></button> : null}
                        {canRequest ? <button type="button" className={ICON} aria-label={`Request a change for ${r.student.name}`} onClick={() => setRequesting(r)}><ArrowRightLeft aria-hidden="true" className="size-4" /></button> : null}
                        {canDelete ? <button type="button" className={ICON} aria-label={`Remove choice of ${r.student.name}`} onClick={() => { setRemoveError(''); setRemoving(r); }}><Trash2 aria-hidden="true" className="size-4" /></button> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
          {load === 'ready' ? <Pager page={page} total={total} onPage={setPage} /> : null}
        </>
      )}

      {editing ? <EditChoiceSheet api={api} choice={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); void reload(); }} /> : null}
      {requesting ? <RequestChangeSheet api={api} choice={requesting} onClose={() => setRequesting(null)} onSaved={() => setRequesting(null)} /> : null}
      {removing ? (
        <ConfirmDialog open title="Remove this choice?" onClose={() => setRemoving(null)}>
          <p className="text-sm text-fg-muted">{removing.student.name}’s subjects in {removing.group.name} are removed. The history of changes is kept.</p>
          {removeError ? <p role="alert" className="mt-3 text-sm text-danger">{removeError}</p> : null}
          <div className="mt-5 flex gap-2">
            <Button variant="destructive" loading={busy} onClick={() => void remove()}>Remove choice</Button>
            <Button variant="secondary" onClick={() => setRemoving(null)}>Keep it</Button>
          </div>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
