import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button, Card } from '../../design-system';
import { changedRosterRows, ElectivesError, limitNote, rosterSummary, toggleSubject, type ElectivesApi, type StudentElectiveRoster } from './electives';
import { CONTROL, EmptyRow, LoadError, TH, THEAD } from './ElectiveParts';

type Opt = { id: string; name: string };

/** Record a whole class section's picks from one group in one go: one row per student, one box per subject on offer. */
export function ElectiveRoster({ api, canSave }: { api: ElectivesApi; canSave: boolean }) {
  const [years, setYears] = useState<Opt[]>([]);
  const [groups, setGroups] = useState<Opt[]>([]);
  const [maps, setMaps] = useState<{ classId: string; sectionId: string; sectionName: string }[]>([]);
  const [classes, setClasses] = useState<Opt[]>([]);
  const [yearId, setYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [groupId, setGroupId] = useState('');
  const [roster, setRoster] = useState<StudentElectiveRoster | null>(null);
  const [picks, setPicks] = useState<Record<string, string[]>>({});
  const [load, setLoad] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void Promise.all([api.options('/academic-years'), api.options('/elective-groups'), api.options('/classes')]).then(([y, g, c]) => {
      setYears(y);
      setGroups(g);
      setClasses(c);
    }).catch(() => setError('The lists could not be loaded.'));
  }, [api]);
  useEffect(() => {
    setMaps([]);
    if (yearId) void api.classSections(yearId).then(setMaps).catch(() => setMaps([]));
  }, [api, yearId]);

  const sections = maps.filter((m) => m.classId === classId);
  const ready = yearId && classId && sectionId && groupId;
  const open = async () => {
    setLoad('loading');
    setError('');
    try {
      const r = await api.roster(yearId, classId, sectionId, groupId);
      setRoster(r);
      setPicks({});
      setLoad('ready');
    } catch (e) {
      setRoster(null);
      setError(e instanceof ElectivesError ? (e.fields.groupId ?? e.message) : 'The class could not be loaded.');
      setLoad('error');
    }
  };
  const rows = useMemo(() => (roster ? changedRosterRows(roster.students, picks) : []), [roster, picks]);
  const save = async () => {
    setBusy(true);
    try {
      toast.success(rosterSummary(await api.saveRoster({ yearId, classId, sectionId, groupId, rows })));
      await open();
    } catch (e) {
      toast.error(e instanceof ElectivesError ? (e.fields.subjectIds ?? e.message) : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  const select = (label: string, value: string, set: (v: string) => void, list: Opt[], disabled = false) => (
    <select aria-label={label} className={CONTROL} value={value} disabled={disabled} onChange={(e) => { set(e.target.value); setRoster(null); setLoad('idle'); }}>
      <option value="">{label}</option>
      {list.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
    </select>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {select('Academic year', yearId, (v) => { setYearId(v); setClassId(''); setSectionId(''); }, years)}
        {select('Class', classId, (v) => { setClassId(v); setSectionId(''); }, classes, !yearId)}
        {select('Section', sectionId, setSectionId, sections.map((m) => ({ id: m.sectionId, name: m.sectionName })), !classId)}
        {select('Elective group', groupId, setGroupId, groups)}
        <Button disabled={!ready} loading={load === 'loading'} onClick={() => void open()}>Show students</Button>
      </div>
      {load === 'idle' ? <p className="text-sm text-fg-muted">Choose a year, class, section and elective group to see the students.</p> : null}
      {load === 'error' ? <LoadError message={error} onRetry={() => void open()} /> : null}
      {roster ? (
        <>
          <p className="text-sm text-fg-muted">
            {roster.class.name} · {roster.section.name} · {roster.year.name}. {roster.group.name}: choose {roster.group.minSubjects === roster.group.maxSubjects ? roster.group.minSubjects : `${roster.group.minSubjects} to ${roster.group.maxSubjects}`}.
          </p>
          <Card className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className={THEAD}>
                <tr>
                  <th scope="col" className={TH}>Roll</th>
                  <th scope="col" className={TH}>Student</th>
                  {roster.offered.map((s) => <th key={s.id} scope="col" className={TH}>{s.name}</th>)}
                  <th scope="col" className={TH}>Check</th>
                </tr>
              </thead>
              <tbody>
                {roster.students.length === 0 ? <EmptyRow cols={roster.offered.length + 3} text="No students are enrolled in this section." /> : null}
                {roster.offered.length === 0 && roster.students.length > 0 ? <EmptyRow cols={3} text="This group offers no subjects to this class." /> : null}
                {roster.students.map((s) => {
                  const now = picks[s.student.id] ?? s.subjects.map((x) => x.id);
                  const note = limitNote(roster.group, now.length);
                  return (
                    <tr key={s.student.id} className="border-b border-line-subtle last:border-0">
                      <td className="px-5 py-3 text-fg-muted">{s.rollNumber ?? '—'}</td>
                      <td className="px-5 py-3"><span className="font-medium text-fg">{s.student.name}</span> <span className="text-fg-muted">{s.student.registrationCode}</span></td>
                      {roster.offered.map((o) => (
                        <td key={o.id} className="px-5 py-3">
                          <input type="checkbox" className="size-5 accent-[var(--color-accent)]" disabled={!canSave} aria-label={`${o.name} for ${s.student.name}`} checked={now.includes(o.id)} onChange={() => setPicks({ ...picks, [s.student.id]: toggleSubject(now, o.id) })} />
                        </td>
                      ))}
                      <td className={note ? 'px-5 py-3 text-warning' : 'px-5 py-3 text-fg-subtle'}>{note ? (roster.group.enforceLimits ? 'Outside the limits' : 'Outside the limits (allowed)') : 'Fine'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
          {canSave ? (
            <div className="flex items-center gap-3">
              <Button loading={busy} disabled={rows.length === 0} onClick={() => void save()}>Save {rows.length ? `${rows.length} ${rows.length === 1 ? 'change' : 'changes'}` : 'changes'}</Button>
              {rows.length === 0 ? <span className="text-sm text-fg-muted">Nothing has changed yet.</span> : null}
            </div>
          ) : <p className="text-sm text-fg-muted">You can look at these choices but not change them.</p>}
        </>
      ) : null}
    </div>
  );
}
