import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Inbox, Search, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, PageHeader, Sheet } from '../../design-system';
import { useAccessState } from '../../shell/AccessProvider';
import { useAuth } from '../../shell/AuthProvider';
import {
  blankAdmitForm, createAdmissionsApi, GENDER_CHOICES, MAX_BATCH, outcomeLabel, PAGE_SIZE, type Admission, type AdmissionsApi, type AdmissionsError, type AdmissionState, type AdmitForm, type BatchResult, type BatchRow, type ClassSectionChoice,
} from './admissions';
import { AdmitSheet, SelectField, StudentLink } from './AdmitSheet';
import { formatDate } from './dates';

const CONTROL = 'h-10 rounded-md border border-line bg-surface px-3 text-sm text-fg shadow-soft hover:border-line-strong focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle';
const sectionKey = (classId: string, yearId: string) => `${classId}|${yearId}`;

/** Loads, once, the sections each (class, year) pair allows, for the rows on screen. */
function useSectionChoices(api: AdmissionsApi) {
  const [map, setMap] = useState<Record<string, ClassSectionChoice[]>>({});
  const asked = useRef(new Set<string>());
  const ensure = useCallback(
    (pairs: { classId: string; yearId: string }[]) => {
      for (const p of pairs) {
        const k = sectionKey(p.classId, p.yearId);
        if (asked.current.has(k)) continue;
        asked.current.add(k);
        api
          .sections(p.classId, p.yearId)
          .then((s) => setMap((m) => ({ ...m, [k]: s })))
          .catch(() => {
            asked.current.delete(k);
            setMap((m) => ({ ...m, [k]: [] }));
          });
      }
    },
    [api],
  );
  return { map, ensure };
}

/** ADM-05 Admissions: the queue of accepted registrations, one admit sheet, and bulk preview then admit. */
export function AdmissionsPage() {
  const { session } = useAuth();
  const api = useMemo(() => createAdmissionsApi(session), [session]);
  const access = useAccessState();
  const canCreate = access.phase === 'ready' && access.access.can('adm.admissions.create');
  const [params, setParams] = useSearchParams();
  const wanted = params.get('registration');

  const [stateTab, setStateTab] = useState<AdmissionState>('ready');
  const [classId, setClassId] = useState('');
  const [yearId, setYearId] = useState('');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<Admission[]>([]);
  const [total, setTotal] = useState(0);
  const [load, setLoad] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [classes, setClasses] = useState<{ id: string; name: string }[]>([]);
  const [years, setYears] = useState<{ id: string; name: string }[]>([]);
  const [admitting, setAdmitting] = useState<Admission | null>(null);
  const [selected, setSelected] = useState<Record<string, Admission>>({});
  const [bulkOpen, setBulkOpen] = useState(false);
  const { map: sectionMap, ensure } = useSectionChoices(api);

  useEffect(() => {
    api.options('/classes').then(setClasses).catch(() => setClasses([]));
    api.options('/academic-years').then(setYears).catch(() => setYears([]));
  }, [api]);

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const reload = useCallback(async () => {
    setLoad('loading');
    try {
      const r = await api.list({ state: stateTab, classId, yearId, search: query, page, pageSize: PAGE_SIZE, sort: stateTab === 'admitted' ? '-admittedAt' : 'appliedOn' });
      setRows(r.items);
      setTotal(r.page.total);
      setLoad('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setLoad('error');
    }
  }, [api, stateTab, classId, yearId, query, page]);
  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => ensure(rows.map((r) => ({ classId: r.classId, yearId: r.yearId }))), [rows, ensure]);

  // The Registrations screen sends someone here with ?registration=<id> to admit that one.
  useEffect(() => {
    if (!wanted) return;
    let live = true;
    api
      .get(wanted)
      .then((r) => {
        if (!live) return;
        ensure([{ classId: r.classId, yearId: r.yearId }]);
        setAdmitting(r);
      })
      .catch(() => toast.error('That registration could not be opened.'))
      .finally(() => {
        const next = new URLSearchParams(params);
        next.delete('registration');
        setParams(next, { replace: true });
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per deep link
  }, [wanted, api]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const ready = stateTab === 'ready';
  const showSelect = ready && canCreate;
  const chosen = Object.values(selected);
  const allOnPage = rows.length > 0 && rows.every((r) => selected[r.id]);
  const columns = (showSelect ? 1 : 0) + (ready ? 5 : 6) + 1;

  const toggle = (r: Admission) =>
    setSelected((s) => {
      const next = { ...s };
      if (next[r.id]) delete next[r.id];
      else if (Object.keys(next).length < MAX_BATCH) next[r.id] = r;
      else toast.error(`Select up to ${MAX_BATCH} registrations at a time.`);
      return next;
    });
  const togglePage = () =>
    setSelected((s) => {
      const next = { ...s };
      if (allOnPage) for (const r of rows) delete next[r.id];
      else for (const r of rows) if (Object.keys(next).length < MAX_BATCH) next[r.id] = r;
      return next;
    });
  const switchTab = (t: AdmissionState) => {
    setStateTab(t);
    setPage(1);
    setSelected({});
  };

  return (
    <section className="space-y-4">
      <PageHeader title="Admissions" description="Admit accepted registrations: each becomes a student with a class, section and roll number." />

      <div className="flex flex-wrap items-center gap-3">
        <div role="group" aria-label="Show" className="inline-flex rounded-md border border-line bg-surface p-0.5 shadow-soft">
          {(['ready', 'admitted'] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={stateTab === t}
              onClick={() => switchTab(t)}
              className={`h-9 rounded px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring ${stateTab === t ? 'bg-accent text-on-accent' : 'text-fg-muted hover:text-fg'}`}
            >
              {t === 'ready' ? 'Ready to admit' : 'Admitted'}
            </button>
          ))}
        </div>
        <div className="relative w-full max-w-xs">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <input type="search" aria-label="Search admissions" placeholder="Search by number, name or phone" value={search} onChange={(e) => setSearch(e.target.value)} className={`${CONTROL} w-full pl-10`} />
        </div>
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
        <select
          aria-label="Academic year"
          className={CONTROL}
          value={yearId}
          onChange={(e) => {
            setYearId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">All academic years</option>
          {years.map((y) => (
            <option key={y.id} value={y.id}>
              {y.name}
            </option>
          ))}
        </select>
      </div>

      {showSelect && chosen.length > 0 ? (
        <div className="flex flex-wrap items-center gap-3 rounded-md border border-line bg-surface px-4 py-2.5 shadow-soft" role="region" aria-label="Selected registrations">
          <span className="text-sm text-fg">{chosen.length} selected</span>
          <Button size="sm" onClick={() => setBulkOpen(true)}>
            <UserCheck aria-hidden="true" className="size-3.5" />
            Admit selected…
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected({})}>
            Clear
          </Button>
        </div>
      ) : null}

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
                {showSelect ? (
                  <th scope="col" className="w-10 px-4 py-3.5">
                    <input type="checkbox" aria-label="Select all on this page" checked={allOnPage} onChange={togglePage} className="size-4 accent-[var(--color-accent)]" />
                  </th>
                ) : null}
                <th scope="col" className="whitespace-nowrap px-4 py-3.5 font-semibold">App. no.</th>
                <th scope="col" className="px-4 py-3.5 font-semibold">Applicant</th>
                <th scope="col" className="px-4 py-3.5 font-semibold">Class</th>
                {ready ? (
                  <>
                    <th scope="col" className="px-4 py-3.5 font-semibold">Guardian</th>
                    <th scope="col" className="whitespace-nowrap px-4 py-3.5 font-semibold">Applied on</th>
                  </>
                ) : (
                  <>
                    <th scope="col" className="px-4 py-3.5 font-semibold">Roll</th>
                    <th scope="col" className="whitespace-nowrap px-4 py-3.5 font-semibold">Student code</th>
                    <th scope="col" className="whitespace-nowrap px-4 py-3.5 font-semibold">Admitted on</th>
                  </>
                )}
                <th scope="col" className="px-4 py-3.5 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {load === 'ready' && rows.length === 0 ? (
                <tr>
                  <td colSpan={columns} className="px-5 py-16 text-center text-fg-muted">
                    <Inbox aria-hidden="true" className="mx-auto mb-3 size-6 text-fg-subtle" />
                    {query ? `No registrations match “${query}”.` : ready ? 'No accepted registrations are waiting for admission.' : 'No one has been admitted yet.'}
                  </td>
                </tr>
              ) : null}
              {load === 'loading' && rows.length === 0 ? (
                <tr>
                  <td colSpan={columns} className="px-5 py-16 text-center text-fg-muted">
                    Loading…
                  </td>
                </tr>
              ) : null}
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line-subtle transition-colors last:border-0 hover:bg-canvas">
                  {showSelect ? (
                    <td className="px-4 py-3.5">
                      <input type="checkbox" aria-label={`Select ${r.applicationNumber} ${r.fullName}`} checked={Boolean(selected[r.id])} onChange={() => toggle(r)} className="size-4 accent-[var(--color-accent)]" />
                    </td>
                  ) : null}
                  <td className="whitespace-nowrap px-4 py-3.5 font-medium text-fg">{r.applicationNumber}</td>
                  <td className="px-4 py-3.5 text-fg">{r.fullName}</td>
                  <td className="px-4 py-3.5 text-fg-muted">
                    {r.className}
                    {ready && r.sectionName ? ` · ${r.sectionName}` : !ready && r.enrolledSectionName ? ` · ${r.enrolledSectionName}` : ''}
                    <span className="block text-xs text-fg-subtle">{r.yearName}</span>
                  </td>
                  {ready ? (
                    <>
                      <td className="px-4 py-3.5 text-fg-muted">
                        {r.guardianName || r.fatherName || r.motherName || '—'}
                        <span className="block text-xs text-fg-subtle">{r.guardianPhone}</span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-fg-muted">{formatDate(r.appliedOn)}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3.5 text-fg-muted">{r.rollNumber || '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3.5">{r.studentCode ? <StudentLink code={r.studentCode} /> : '—'}</td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-fg-muted">{formatDate(r.admittedAt)}</td>
                    </>
                  )}
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex flex-wrap justify-end gap-1">
                      {ready && canCreate ? (
                        <Button size="sm" variant="ghost" aria-label={`Admit ${r.applicationNumber} ${r.fullName}`} onClick={() => setAdmitting(r)}>
                          <UserCheck aria-hidden="true" className="size-3.5" />
                          Admit
                        </Button>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {total > 0 ? (
        <nav aria-label="Pages" className="flex items-center justify-between text-sm text-fg-muted">
          <span>
            {from}–{to} of {total}
          </span>
          <span className="flex items-center gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page">
              <ChevronLeft aria-hidden="true" className="size-4" />
            </Button>
            <span>
              Page {page} of {pages}
            </span>
            <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Next page">
              <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
          </span>
        </nav>
      ) : null}

      <AdmitSheet
        api={api}
        row={admitting}
        sections={admitting ? sectionMap[sectionKey(admitting.classId, admitting.yearId)] : undefined}
        canCreate={canCreate}
        onClose={() => setAdmitting(null)}
        onAdmitted={(r) => {
          setSelected((s) => {
            const next = { ...s };
            delete next[r.registrationId];
            return next;
          });
          void reload();
        }}
      />
      {bulkOpen ? (
        <BulkSheet
          api={api}
          rows={chosen}
          sectionMap={sectionMap}
          onClose={() => setBulkOpen(false)}
          onCommitted={(res) => {
            const done = new Set(res.rows.filter((x) => x.outcome === 'admitted' || x.outcome === 'already_admitted').map((x) => x.registrationId));
            setSelected((s) => Object.fromEntries(Object.entries(s).filter(([id]) => !done.has(id))));
            void reload();
          }}
        />
      ) : null}
    </section>
  );
}

/** One selected registration in the bulk sheet: its own section, roll number and, when needed, gender. */
function BulkRow({ row, form, sections, result, onChange }: { row: Admission; form: AdmitForm; sections: ClassSectionChoice[]; result?: BatchRow; onChange: (patch: Partial<AdmitForm>) => void }) {
  const problems = result?.problems ?? [];
  const byField = (f: string) => problems.find((p) => p.field === f)?.message;
  const duplicate = problems.some((p) => p.code === 'possible_duplicate');
  return (
    <li className="space-y-3 rounded-md border border-line-subtle p-3" data-testid={`bulk-row-${row.id}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-fg">
          {row.applicationNumber} · {row.fullName}
          <span className="block text-xs font-normal text-fg-subtle">
            {row.className} · {row.yearName}
          </span>
        </p>
        {result ? <span className={`shrink-0 text-xs font-medium ${result.outcome === 'problem' ? 'text-danger' : 'text-success'}`}>{outcomeLabel(result.outcome, result.outcome === 'would_admit')}</span> : null}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Section" required value={form.sectionId} onChange={(v) => onChange({ sectionId: v })} options={sections.map((s) => ({ value: s.sectionId, label: s.sectionName }))} error={byField('sectionId')} />
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-fg" htmlFor={`roll-${row.id}`}>
            Roll number
          </label>
          <input id={`roll-${row.id}`} className={`${CONTROL} ${byField('rollNumber') ? 'border-danger' : ''}`} value={form.rollNumber} maxLength={20} placeholder="Next number" onChange={(e) => onChange({ rollNumber: e.target.value })} aria-invalid={byField('rollNumber') ? true : undefined} />
          {byField('rollNumber') ? <p className="text-sm text-danger">{byField('rollNumber')}</p> : null}
        </div>
      </div>
      {!row.gender ? <SelectField label="Gender" required value={form.gender} onChange={(v) => onChange({ gender: v })} options={GENDER_CHOICES} error={byField('gender')} /> : null}
      {duplicate ? (
        <label className="flex items-start gap-2 text-sm text-warning">
          <input type="checkbox" className="mt-0.5 size-4" checked={form.confirmDuplicate} onChange={(e) => onChange({ confirmDuplicate: e.target.checked })} />
          <span>A student with the same name and date of birth exists. Admit anyway.</span>
        </label>
      ) : null}
      {problems
        .filter((p) => !['sectionId', 'rollNumber', 'gender'].includes(p.field) && !(p.code === 'possible_duplicate'))
        .map((p) => (
          <p key={`${p.field}-${p.code}`} className="text-sm text-danger">
            {p.message}
          </p>
        ))}
    </li>
  );
}

/** Admit many at once: set a section (and roll) per row or one section for all, preview the problems, then admit. */
function BulkSheet({ api, rows, sectionMap, onClose, onCommitted }: { api: AdmissionsApi; rows: Admission[]; sectionMap: Record<string, ClassSectionChoice[]>; onClose: () => void; onCommitted: (r: BatchResult) => void }) {
  // Registrations are fixed when the sheet opens; later selection changes do not move rows under the registrar.
  const [list] = useState(rows);
  const [forms, setForms] = useState<Record<string, AdmitForm>>(() => Object.fromEntries(list.map((r) => [r.id, blankAdmitForm(r)])));
  const [previewed, setPreviewed] = useState<BatchResult | null>(null);
  const [committed, setCommitted] = useState<BatchResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');

  const choicesFor = (r: Admission) => sectionMap[sectionKey(r.classId, r.yearId)] ?? [];
  const common = useMemo(() => {
    const [first, ...rest] = list.map((r) => choicesFor(r));
    if (!first) return [];
    return first.filter((s) => rest.every((o) => o.some((x) => x.sectionId === s.sectionId)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- choicesFor reads sectionMap
  }, [list, sectionMap]);

  const entries = list.map((r) => ({ registrationId: r.id, form: forms[r.id] }));
  const change = (id: string, patch: Partial<AdmitForm>) => {
    setForms((f) => ({ ...f, [id]: { ...f[id], ...patch } }));
    setPreviewed(null);
  };
  const sameSection = (sectionId: string) => {
    setForms((f) => Object.fromEntries(Object.entries(f).map(([id, v]) => [id, { ...v, sectionId }])));
    setPreviewed(null);
  };

  const run = async (kind: 'preview' | 'commit') => {
    setBusy(true);
    setFailure('');
    try {
      if (kind === 'preview') setPreviewed(await api.preview(entries));
      else {
        // Only rows the preview cleared are sent; the server still checks every one again.
        const ok = new Set((previewed?.rows ?? []).filter((x) => x.outcome === 'would_admit').map((x) => x.registrationId));
        const res = await api.bulk(entries.filter((e) => ok.has(e.registrationId)));
        setCommitted(res);
        onCommitted(res);
      }
    } catch (e) {
      setFailure((e as AdmissionsError).message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const resultFor = (id: string) => previewed?.rows.find((r) => r.registrationId === id);
  const admitCount = previewed?.rows.filter((r) => r.outcome === 'would_admit').length ?? 0;

  return (
    <Sheet open onClose={onClose} title={committed ? 'Admission results' : `Admit ${list.length} registration${list.length === 1 ? '' : 's'}`} description={committed ? undefined : 'Choose a section for each, preview, then admit.'}>
      {failure ? (
        <p role="alert" className="rounded-md border border-danger-line bg-danger-bg p-3 text-sm text-danger">
          {failure}
        </p>
      ) : null}
      {committed ? (
        <div className="space-y-3">
          <p role="status" className="text-sm text-fg-muted">
            {committed.okCount} done, {committed.problemCount} need attention. Anything that needs attention was not admitted; fix it and try again.
          </p>
          <ul className="space-y-3">
            {committed.rows.map((r) => (
              <li key={r.registrationId} className="rounded-md border border-line-subtle p-3 text-sm" data-testid={`outcome-${r.registrationId}`}>
                <p className="font-medium text-fg">
                  {r.applicationNumber} · {outcomeLabel(r.outcome, false)}
                </p>
                {r.result ? (
                  <p className="text-fg-muted">
                    <StudentLink code={r.result.student.registrationCode} /> · {r.result.student.fullName}
                  </p>
                ) : null}
                {r.problems.map((p) => (
                  <p key={`${p.field}-${p.code}`} className="text-danger">
                    {p.message}
                  </p>
                ))}
                {r.result && r.result.notes.length > 0 ? <ResultNotes notes={r.result.notes} /> : null}
              </li>
            ))}
          </ul>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {list.length > 1 ? (
            <SelectField label="One section for all" value="" onChange={sameSection} options={common.map((s) => ({ value: s.sectionId, label: s.sectionName }))} placeholder={common.length === 0 ? 'No section is shared by all' : 'Choose to apply to every row'} hint="Or set each row below." />
          ) : null}
          <ul className="space-y-3">
            {list.map((r) => (
              <BulkRow key={r.id} row={r} form={forms[r.id]} sections={choicesFor(r)} result={resultFor(r.id)} onChange={(p) => change(r.id, p)} />
            ))}
          </ul>
          {previewed ? (
            <p role="status" className="text-sm text-fg-muted" data-testid="preview-summary">
              {previewed.okCount} can be admitted, {previewed.problemCount} need attention.
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={busy || list.length === 0} onClick={() => void run('preview')}>
              {busy && !previewed ? 'Checking…' : 'Preview'}
            </Button>
            <Button disabled={busy || !previewed || admitCount === 0} onClick={() => void run('commit')}>
              {`Admit ${admitCount}`}
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function ResultNotes({ notes }: { notes: string[] }) {
  return (
    <ul className="mt-1 list-disc pl-5 text-warning">
      {notes.map((n) => (
        <li key={n}>{n}</li>
      ))}
    </ul>
  );
}
