import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Loader2, MoreHorizontal, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, ConfirmDialog, PageHeader } from '@/design-system';
import { useAuth } from '@/shell/AuthProvider';
import { createElectivesApi, type StudentElective, type ListQuery, type ElectiveSubject, type StudentElectiveStatus, type StudentElectiveRoster, type StudentElectiveRosterSave } from './electives';

const PAGE_SIZE = 25;

const statusColors: Record<StudentElectiveStatus, string> = {
  chosen: 'bg-blue-100 text-blue-800',
  confirmed: 'bg-green-100 text-green-800',
};

const changeStatusColors: Record<string, string> = {
  requested: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

function StatusBadge({ status }: { status: string }) {
  const colors = statusColors[status as StudentElectiveStatus] ?? changeStatusColors[status] ?? 'bg-gray-100 text-gray-800';
  return <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${colors}`}>{status}</span>;
}

function SubjectTags({ subjects }: { subjects: ElectiveSubject[] }) {
  if (!subjects.length) return <span className="text-muted-foreground">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {subjects.map((s) => (
        <span key={s.id} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">{s.name}</span>
      ))}
    </div>
  );
}

function classLine(c: Pick<StudentElective, 'className' | 'sectionName'>): string {
  if (!c.className) return '—';
  return c.sectionName ? `${c.className}\u00a0·\u00a0${c.sectionName}` : c.className;
}

export function ElectivesPage() {
  const { session } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get('q') ?? '');
  const [status, setStatus] = useState(searchParams.get('status') ?? '');
  const [yearId, setYearId] = useState(searchParams.get('yearId') ?? '');
  const [classId, setClassId] = useState(searchParams.get('classId') ?? '');
  const [groupId, setGroupId] = useState(searchParams.get('groupId') ?? '');
  const [page, setPage] = useState(Number(searchParams.get('page') ?? 1));

  const api = useMemo(() => createElectivesApi(session), [session]);

  const listQuery: ListQuery = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      search: query,
      status: status || undefined,
      yearId: yearId || undefined,
      classId: classId || undefined,
      groupId: groupId || undefined,
    }),
    [page, query, status, yearId, classId, groupId],
  );

  const [rows, setRows] = useState<StudentElective[]>([]);
  const [total, setTotal] = useState(0);
  const [load, setLoad] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const latest = useRef(0);

  const reload = useCallback(async () => {
    const mine = ++latest.current;
    setLoad('loading');
    setError('');
    try {
      const r = await api.list(listQuery);
      if (mine !== latest.current) return;
      setRows(r.items);
      setTotal(r.page.total);
      setLoad('ready');
    } catch (e) {
      if (mine !== latest.current) return;
      setError(e instanceof Error ? e.message : 'Failed to load');
      setLoad('error');
    }
  }, [api, listQuery]);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    const p = new URLSearchParams();
    if (query) p.set('q', query);
    if (status) p.set('status', status);
    if (yearId) p.set('yearId', yearId);
    if (classId) p.set('classId', classId);
    if (groupId) p.set('groupId', groupId);
    if (page > 1) p.set('page', String(page));
    setSearchParams(p, { replace: true });
  }, [query, status, yearId, classId, groupId, page, setSearchParams]);

  const replaceMutation = useMemo(() => ({
    mutate: async ({ choiceId, body }: { choiceId: string; body: { subjectIds: string[]; status?: StudentElectiveStatus } }) => {
      await api.replace(choiceId, body);
      toast.success('Choice updated');
      void reload();
    },
  }), [api, reload]);

  const deleteMutation = useMemo(() => ({
    mutate: async (choiceId: string) => {
      await api.remove(choiceId);
      toast.success('Choice removed');
      void reload();
    },
  }), [api, reload]);

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{ choice: StudentElective; subjects: ElectiveSubject[] } | null>(null);
  const [rosterView, setRosterView] = useState<{ yearId: string; classId: string; sectionId: string; groupId: string } | null>(null);
  const [rosterData, setRosterData] = useState<StudentElectiveRoster | null>(null);
  const [savingRoster, setSavingRoster] = useState(false);

  const handleEdit = useCallback((choice: StudentElective) => {
    setEditData({ choice, subjects: choice.offered });
  }, []);

  const handleSaveEdit = useCallback(() => {
    if (!editData) return;
    void replaceMutation.mutate({ choiceId: editData.choice.id, body: { subjectIds: editData.subjects.map((s) => s.id), status: editData.choice.status } });
    setEditData(null);
  }, [editData, replaceMutation]);

  const handleSubjectToggle = useCallback((subject: ElectiveSubject) => {
    if (!editData) return;
    const current = editData.subjects.map((s) => s.id);
    const next = current.includes(subject.id) ? current.filter((id) => id !== subject.id) : [...current, subject.id];
    setEditData({ ...editData, subjects: editData.subjects.filter((s) => next.includes(s.id)) });
  }, [editData]);

  const handleDeleteConfirm = useCallback(() => {
    if (deleteId) { void deleteMutation.mutate(deleteId); setDeleteId(null); }
  }, [deleteId, deleteMutation]);

  const handleRosterSave = useCallback(async () => {
    if (!rosterView || !rosterData) return;
    setSavingRoster(true);
    try {
      const rows: StudentElectiveRosterSave['rows'] = rosterData.students.map((s) => ({
        studentId: s.student.id,
        subjectIds: s.subjects.map((sub) => sub.id),
        status: s.status ?? undefined,
      }));
      await api.saveRoster({ ...rosterView, rows });
      toast.success('Roster saved');
      setRosterView(null);
      setRosterData(null);
      void reload();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save roster');
    } finally {
      setSavingRoster(false);
    }
  }, [api, rosterView, rosterData, reload]);

  const handleCloseRoster = useCallback(() => {
    setRosterView(null);
    setRosterData(null);
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="STU"
        title="Student Electives"
        description="Record and manage student elective choices from elective groups."
        actions={<Button onClick={() => navigate('/student-electives/new')}><Plus className="h-4 w-4 mr-2" /> New Choice</Button>}
      />
      <Card className="mb-4">
        <div className="p-4 pt-4">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[200px]">
              <label htmlFor="search" className="sr-only">Search</label>
              <input id="search" type="search" placeholder="Search by name or code…" value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} className="max-w-xs w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-subtle" />
            </div>
            <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-[160px] rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-subtle">
              <option value="">All statuses</option>
              <option value="chosen">Chosen</option>
              <option value="confirmed">Confirmed</option>
            </select>
            <select value={yearId} onChange={(e) => setYearId(e.target.value)} className="w-[180px] rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-subtle">
              <option value="">All years</option>
            </select>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} disabled={!yearId} className="w-[160px] rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-subtle disabled:opacity-50">
              <option value="">All classes</option>
            </select>
            <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="w-[180px] rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-subtle">
              <option value="">All groups</option>
            </select>
            <Button onClick={() => navigate('/student-electives/new')} className="ml-auto">
              <Plus className="h-4 w-4 mr-2" /> New Choice
            </Button>
          </div>
        </div>
      </Card>

      {load === 'loading' && rows.length === 0 ? (
        <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : load === 'error' ? (
        <div className="text-center py-8 text-red-600">Failed to load: {error}</div>
      ) : (
        <>
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-subtle">
                    <th className="text-left p-3 font-medium">Student</th>
                    <th className="text-left p-3 font-medium">Class</th>
                    <th className="text-left p-3 font-medium">Group</th>
                    <th className="text-left p-3 font-medium">Subjects</th>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Limits</th>
                    <th className="text-right p-3 font-medium w-12">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">No elective choices found.</td></tr>
                  ) : (
                    rows.map((row) => (
                      <tr key={row.id} className="border-b border-line/50 hover:bg-subtle/50">
                        <td className="p-3">
                          <div className="font-medium">{row.student.name}</div>
                          <div className="text-xs text-muted-foreground">{row.student.registrationCode}</div>
                        </td>
                        <td className="p-3">{classLine(row)}</td>
                        <td className="p-3">{row.group.name}</td>
                        <td className="p-3"><SubjectTags subjects={row.subjects} /></td>
                        <td className="p-3"><StatusBadge status={row.status} /></td>
                        <td className="p-3">
                          <span className={row.withinLimits ? 'text-green-600' : 'text-red-600'}>
                            {row.withinLimits ? 'Within limits' : 'Outside limits'}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <div className="relative inline-block">
                            <Button variant="ghost" size="sm" onClick={() => {}} className="opacity-0 group-hover:opacity-100 transition-opacity"><MoreHorizontal className="h-4 w-4" /></Button>
                            <div className="absolute right-0 top-full mt-1 hidden group-hover:block z-50 min-w-[120px] rounded-md border border-line bg-surface p-1 shadow-lg">
                              <button onClick={() => handleEdit(row)} className="w-full text-left px-3 py-2 text-sm text-fg hover:bg-subtle rounded-sm">Edit</button>
                              <button onClick={() => setDeleteId(row.id)} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-subtle rounded-sm">Remove</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              {total > 0 && (
                <div className="flex items-center justify-between p-3 border-t border-line">
                  <span className="text-sm text-muted-foreground">Page {page} of {Math.ceil(total / PAGE_SIZE)} — {total} total</span>
                  <div className="flex gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}><ChevronLeft className="h-4 w-4" /></Button>
                    <Button variant="secondary" size="sm" onClick={() => setPage((p) => Math.min(Math.ceil(total / PAGE_SIZE), p + 1))} disabled={page >= Math.ceil(total / PAGE_SIZE)}><ChevronRight className="h-4 w-4" /></Button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {editData && (
            <ConfirmDialog open={!!editData} onClose={() => setEditData(null)} title="Edit choice">
              <div className="space-y-4 py-4">
                <p className="text-sm text-muted-foreground">Editing choice for {editData.choice.student.name} (Group: {editData.choice.group.name})</p>
                <label className="block text-sm font-medium">Subjects (offered: {editData.choice.group.minSubjects}–{editData.choice.group.maxSubjects})</label>
                <div className="flex flex-wrap gap-2">
                  {editData.subjects.map((s) => (
                    <span key={s.id} className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium cursor-pointer ${editData.subjects.some((es) => es.id === s.id) ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`} onClick={() => handleSubjectToggle(s)}>{s.name}</span>
                  ))}
                </div>
                {!editData.subjects.length && <p className="text-sm text-muted-foreground">No subjects selected</p>}
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="ghost" onClick={() => setEditData(null)}>Cancel</Button>
                  <Button onClick={handleSaveEdit}>Save</Button>
                </div>
              </div>
            </ConfirmDialog>
          )}

          <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} title="Remove choice?">
            <p>This will remove the student's elective choice. The history will be kept.</p>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button variant="destructive" onClick={handleDeleteConfirm}>Remove</Button>
            </div>
          </ConfirmDialog>

          {rosterView && rosterData && (
            <ConfirmDialog open onClose={handleCloseRoster} title={`Roster: ${rosterData.class.name} ${rosterData.section.name} — ${rosterData.group.name}`}>
              <p className="text-sm text-muted-foreground">Year: {rosterData.year.name}</p>
              <div className="max-h-[60vh] overflow-auto">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-line bg-subtle">
                        <th className="text-left p-3 font-medium">Roll</th>
                        <th className="text-left p-3 font-medium">Student</th>
                        <th className="text-left p-3 font-medium">Status</th>
                        <th className="text-left p-3 font-medium">Subjects</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rosterData.students.map((s) => (
                        <tr key={s.student.id} className="border-b border-line/50">
                          <td className="p-3">{s.rollNumber ?? '—'}</td>
                          <td className="p-3">
                            <div className="font-medium">{s.student.name}</div>
                            <div className="text-xs text-muted-foreground">{s.student.registrationCode}</div>
                          </td>
                          <td className="p-3"><StatusBadge status={s.status ?? '—'} /></td>
                          <td className="p-3"><SubjectTags subjects={s.subjects} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="ghost" onClick={handleCloseRoster}>Close</Button>
                <Button onClick={() => void handleRosterSave()} loading={savingRoster}>Save all</Button>
              </div>
            </ConfirmDialog>
          )}
        </>
      )}
    </>
  );
}