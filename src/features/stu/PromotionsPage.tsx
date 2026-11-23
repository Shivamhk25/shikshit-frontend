import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ChevronLeft, ChevronRight, Eye, History, Rocket, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, ConfirmDialog, PageHeader } from '../../design-system';
import { useAccessState } from '../../shell/AccessProvider';
import { useAuth } from '../../shell/AuthProvider';
import { formatDate, formatDateTime } from '../adm/dates';
import {
  createPromotionsApi, DECISIONS, decisionLabel, formsFromDetail, formsFromProposal, MAX_ROWS, outcomeText, PAGE_SIZE, PromotionsError, ROLL_MODES, rowError, sectionsOf, tally, tallyText, targetClassId, UNDO_DAYS,
  undoReasonText, type Batch, type BatchStatus, type ClassSectionMap, type Choice, type Decision, type Detail, type Outcome, type Proposal, type PromotionsApi, type RollMode, type RowForm, type Source,
} from './promotions';

const CONTROL = 'h-10 rounded-md border border-line bg-surface px-3 text-sm text-fg shadow-soft hover:border-line-strong focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle disabled:cursor-not-allowed disabled:bg-subtle disabled:text-fg-subtle';
const CELL = 'h-9 w-full min-w-[8rem] rounded-md border border-line bg-surface px-2 text-sm text-fg hover:border-line-strong focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle disabled:cursor-not-allowed disabled:bg-subtle disabled:text-fg-subtle';
const TH = 'px-4 py-3.5 font-semibold';

const STATUS_WORDS: Record<BatchStatus, string> = { draft: 'Draft', committed: 'Committed', undone: 'Undone' };
const STATUS_COLOUR: Record<BatchStatus, string> = { draft: 'text-warning', committed: 'text-success', undone: 'text-fg-muted' };

type Person = { name: string; code: string; roll: string | null; status: string };

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong. Please try again.';
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="rounded-md border border-danger-line bg-danger-bg p-3 text-sm text-danger">
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-fg">
      {label}
      {children}
    </label>
  );
}

/** STU-07 Student promotions: a two-step wizard to move a class section up, repeat it or graduate it, plus the history of batches. */
export function PromotionsPage() {
  const { session } = useAuth();
  const api = useMemo(() => createPromotionsApi(session), [session]);
  const [tab, setTab] = useState<'wizard' | 'history'>('wizard');
  const [resume, setResume] = useState<{ id: string; n: number } | null>(null);
  const [fresh, setFresh] = useState(0);

  return (
    <section className="space-y-4">
      <PageHeader title="Promotions" description="At the end of the year, move each class section up, repeat it or graduate it. Decide who goes where, then enrol them in the new year." />
      <div role="group" aria-label="Show" className="inline-flex rounded-md border border-line bg-surface p-0.5 shadow-soft">
        {(['wizard', 'history'] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
            className={`h-9 rounded px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring ${tab === t ? 'bg-accent text-on-accent' : 'text-fg-muted hover:text-fg'}`}
          >
            {t === 'wizard' ? 'Promote a class' : 'History'}
          </button>
        ))}
      </div>
      {tab === 'wizard' ? (
        <Wizard key={`${resume?.n ?? 0}-${fresh}`} api={api} openBatchId={resume?.id} onAnother={() => { setResume(null); setFresh((n) => n + 1); }} />
      ) : (
        <HistoryList
          api={api}
          onOpen={(b) => {
            setResume({ id: b.id, n: (resume?.n ?? 0) + 1 });
            setTab('wizard');
          }}
        />
      )}
    </section>
  );
}

function Stepper({ step }: { step: 1 | 2 | 3 }) {
  const items = ['Promote', 'Enroll', 'Done'];
  return (
    <ol className="flex flex-wrap items-center gap-3 text-sm" aria-label="Steps">
      {items.map((label, i) => {
        const n = i + 1;
        const state = n === step ? 'current' : n < step ? 'done' : 'todo';
        return (
          <li key={label} aria-current={state === 'current' ? 'step' : undefined} className="flex items-center gap-2">
            <span className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold ${state === 'todo' ? 'border border-line text-fg-subtle' : 'bg-accent text-on-accent'}`}>
              {state === 'done' ? <Check aria-hidden="true" className="size-3.5" /> : n}
            </span>
            <span className={state === 'todo' ? 'text-fg-subtle' : 'font-medium text-fg'}>{label}</span>
            {n < 3 ? <span aria-hidden="true" className="mx-1 h-px w-8 bg-line" /> : null}
          </li>
        );
      })}
    </ol>
  );
}

/** The wizard. It opens a saved batch (from History or from a class section that already has one) at the right step. */
function Wizard({ api, openBatchId, onAnother }: { api: PromotionsApi; openBatchId?: string; onAnother: () => void }) {
  const access = useAccessState();
  const can = (p: string) => access.phase === 'ready' && access.access.can(p);
  const canPrepare = can('stu.student_promotions.create');
  const canCommit = can('stu.student_promotions.edit') && can('stu.students.create') && can('stu.students.edit');
  const canDiscard = can('stu.student_promotions.delete');

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [years, setYears] = useState<Choice[]>([]);
  const [classes, setClasses] = useState<Choice[]>([]);
  const [source, setSource] = useState<Source>({ fromYearId: '', toYearId: '', classId: '', sectionId: '' });
  const [fromMaps, setFromMaps] = useState<ClassSectionMap[]>([]);
  const [toMaps, setToMaps] = useState<ClassSectionMap[]>([]);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [people, setPeople] = useState<Record<string, Person>>({});
  const [rows, setRows] = useState<RowForm[]>([]);
  const [rollMode, setRollMode] = useState<RollMode>('alphabetical');
  const [batch, setBatch] = useState<Detail | null>(null);
  const [preview, setPreview] = useState<Outcome | null>(null);
  const [failure, setFailure] = useState<PromotionsError | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const loadDetail = useCallback(
    (d: Detail) => {
      setBatch(d);
      setPeople(Object.fromEntries(d.rows.map((r) => [r.studentId, { name: r.studentName, code: r.registrationCode, roll: r.rollNumber, status: r.studentStatus }])));
      setRows(formsFromDetail(d));
      setRollMode(d.batch.rollMode);
      setSource({ fromYearId: d.batch.fromYearId, toYearId: d.batch.toYearId, classId: d.batch.fromClassId, sectionId: d.batch.fromSectionId });
    },
    [],
  );

  useEffect(() => {
    api.options('/academic-years').then(setYears).catch(() => setYears([]));
    api.options('/classes').then(setClasses).catch(() => setClasses([]));
  }, [api]);

  useEffect(() => {
    if (!openBatchId) return;
    let live = true;
    api
      .get(openBatchId)
      .then((d) => {
        if (!live) return;
        loadDetail(d);
        setStep(d.batch.status === 'draft' ? 1 : 3);
        setProposal(null);
      })
      .catch((e) => setFailure(e instanceof PromotionsError ? e : new PromotionsError(0, 'error', [], errorText(e))));
    return () => {
      live = false;
    };
  }, [api, openBatchId, loadDetail]);

  useEffect(() => {
    if (!source.fromYearId) return setFromMaps([]);
    api.classSections(source.fromYearId).then(setFromMaps).catch(() => setFromMaps([]));
  }, [api, source.fromYearId]);

  useEffect(() => {
    if (step < 2 || !source.toYearId) return;
    api.classSections(source.toYearId).then(setToMaps).catch(() => setToMaps([]));
  }, [api, step, source.toYearId]);

  const fail = (e: unknown) => setFailure(e instanceof PromotionsError ? e : new PromotionsError(0, 'error', [], errorText(e)));
  const pick = (patch: Partial<Source>) => {
    setSource((s) => {
      const next = { ...s, ...patch };
      if (patch.fromYearId !== undefined && !patch.toYearId) {
        const i = years.findIndex((y) => y.id === patch.fromYearId);
        next.toYearId = years[i + 1]?.id ?? '';
      }
      if (patch.classId !== undefined) next.sectionId = '';
      return next;
    });
    setProposal(null);
    setBatch(null);
    setRows([]);
    setPreview(null);
    setFailure(null);
    setNotice('');
  };

  const showStudents = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const p = await api.proposal(source);
      setProposal(p);
      setPreview(null);
      if (p.existingBatchId) {
        const d = await api.get(p.existingBatchId);
        loadDetail(d);
        if (d.batch.status === 'draft') setNotice(`Continuing the draft saved on ${formatDateTime(d.batch.updatedAt)}.`);
        else setStep(3);
      } else {
        setBatch(null);
        setPeople(Object.fromEntries(p.candidates.map((c) => [c.studentId, { name: c.studentName, code: c.registrationCode, roll: c.rollNumber, status: c.studentStatus }])));
        setRows(formsFromProposal(p));
        setNotice('');
      }
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const change = (id: string, patch: Partial<RowForm>) => {
    setRows((rs) => rs.map((r) => (r.studentId === id ? { ...r, ...patch } : r)));
    setPreview(null);
  };
  const setDecision = (id: string, decision: Decision) => {
    const nextClass = proposal?.nextClassId ?? '';
    change(id, { decision, toClassId: decision === 'promote' ? rows.find((r) => r.studentId === id)?.toClassId || nextClass : '', toSectionId: '', rollNumber: '' });
  };

  /** Saves the decisions (a new draft, or the draft being worked on) and returns it. */
  const save = async (): Promise<Detail> => {
    const d = batch ? await api.save(batch.batch.id, rollMode, rows) : await api.create(source, rollMode, rows);
    setBatch(d);
    return d;
  };

  const next = async () => {
    setBusy(true);
    setFailure(null);
    try {
      await save();
      setStep(2);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const runPreview = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const d = await save();
      setPreview(await api.preview(d.batch.id));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!batch) return;
    setConfirming(false);
    setBusy(true);
    setFailure(null);
    try {
      await api.commit(batch.batch.id);
      loadDetail(await api.get(batch.batch.id));
      setStep(3);
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    if (!batch) return;
    setBusy(true);
    try {
      await api.discard(batch.batch.id);
      toast.success('Draft discarded.');
      onAnother();
    } catch (e) {
      fail(e);
      setBusy(false);
    }
  };

  const sourceClass = classes.find((c) => c.id === source.classId)?.name ?? batch?.batch.fromClassName ?? '';
  const sourceSection = sectionsOf(fromMaps, source.classId).find((s) => s.id === source.sectionId)?.name ?? batch?.batch.fromSectionName ?? '';
  const toYearName = years.find((y) => y.id === source.toYearId)?.name ?? batch?.batch.toYearName ?? '';

  return (
    <div className="space-y-4">
      <Stepper step={step} />
      {failure && step !== 3 ? <FailureBox error={failure} /> : null}
      {step === 1 ? (
        <StepPromote
          years={years} classes={classes} source={source} fromSections={sectionsOf(fromMaps, source.classId)} proposal={proposal} people={people} rows={rows} notice={notice} busy={busy}
          canPrepare={canPrepare} failure={failure} onPick={pick} onShow={() => void showStudents()} onDecision={setDecision} onChange={change} onNext={() => void next()}
        />
      ) : null}
      {step === 2 ? (
        <StepEnroll
          source={source} sourceClass={sourceClass} sourceSection={sourceSection} toYearName={toYearName} people={people} rows={rows} rollMode={rollMode} toMaps={toMaps} preview={preview} busy={busy}
          canCommit={canCommit} canDiscard={canDiscard && Boolean(batch)} failure={failure}
          onRollMode={(m) => { setRollMode(m); setPreview(null); }} onChange={change} onBack={() => { setStep(1); setPreview(null); setFailure(null); }}
          onPreview={() => void runPreview()} onCommit={() => setConfirming(true)} onDiscard={() => void discard()}
        />
      ) : null}
      {step === 3 && batch ? <StepDone api={api} detail={batch} canCommit={canCommit} onChanged={loadDetail} onAnother={onAnother} /> : null}
      {step === 3 && !batch && failure ? <FailureBox error={failure} /> : null}

      <ConfirmDialog open={confirming} onClose={() => setConfirming(false)} title="Enrol these students?">
        <p className="text-sm text-fg-muted">
          {preview
            ? `${preview.enrolledCount} will be enrolled in ${toYearName}${preview.graduatedCount ? `, and ${preview.graduatedCount} marked as alumni` : ''}. `
            : ''}
          You can undo this for {UNDO_DAYS} days, as long as nothing has been changed since.
        </p>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => void commit()}>Enrol now</Button>
          <Button variant="secondary" onClick={() => setConfirming(false)}>
            Cancel
          </Button>
        </div>
      </ConfirmDialog>
    </div>
  );
}

function FailureBox({ error }: { error: PromotionsError }) {
  const generic = error.reasons.filter((r) => !r.field.startsWith('rows['));
  return (
    <Alert>
      <p>{error.message}</p>
      {generic.length > 0 && error.code !== 'validation_failed' ? (
        <ul className="mt-1 list-disc pl-5">
          {generic.slice(0, 6).map((r) => (
            <li key={`${r.field}-${r.code}`}>{r.message}</li>
          ))}
        </ul>
      ) : null}
    </Alert>
  );
}

/** Step 1: choose the class section and decide, student by student. */
function StepPromote(p: {
  years: Choice[]; classes: Choice[]; source: Source; fromSections: Choice[]; proposal: Proposal | null; people: Record<string, Person>; rows: RowForm[]; notice: string; busy: boolean; canPrepare: boolean;
  failure: PromotionsError | null; onPick: (patch: Partial<Source>) => void; onShow: () => void; onDecision: (id: string, d: Decision) => void; onChange: (id: string, patch: Partial<RowForm>) => void; onNext: () => void;
}) {
  const ready = p.source.fromYearId && p.source.toYearId && p.source.classId && p.source.sectionId;
  const active = (id: string) => p.people[id]?.status === 'active';
  const counts = tally(p.rows);
  const toClasses = p.classes.filter((c) => c.id !== p.source.classId);
  const setAll = (d: Decision) => {
    for (const r of p.rows) if (active(r.studentId)) p.onDecision(r.studentId, d);
  };
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="mb-3 font-display text-lg font-semibold text-fg">Which class section?</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Year being closed">
            <select className={CONTROL} value={p.source.fromYearId} onChange={(e) => p.onPick({ fromYearId: e.target.value })}>
              <option value="">Choose…</option>
              {p.years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </Field>
          <Field label="New year">
            <select className={CONTROL} value={p.source.toYearId} onChange={(e) => p.onPick({ toYearId: e.target.value })}>
              <option value="">Choose…</option>
              {p.years.filter((y) => y.id !== p.source.fromYearId).map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </select>
          </Field>
          <Field label="Class">
            <select className={CONTROL} value={p.source.classId} onChange={(e) => p.onPick({ classId: e.target.value })}>
              <option value="">Choose…</option>
              {p.classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="Section">
            <select className={CONTROL} value={p.source.sectionId} onChange={(e) => p.onPick({ sectionId: e.target.value })} disabled={!p.source.classId}>
              <option value="">{p.source.classId && p.fromSections.length === 0 ? 'No sections this year' : 'Choose…'}</option>
              {p.fromSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </Field>
        </div>
        <div className="mt-4">
          <Button variant="secondary" disabled={!ready || p.busy} onClick={p.onShow}>
            Show students
          </Button>
        </div>
      </Card>

      {p.proposal ? (
        <>
          {p.notice ? <p role="status" className="text-sm text-fg-muted">{p.notice}</p> : null}
          <p className="text-sm text-fg-muted">
            {p.proposal.className} · {p.proposal.sectionName}, {p.proposal.fromYearName} to {p.proposal.toYearName}.{' '}
            {p.proposal.isLastClass ? 'This is the last class, so students graduate unless you decide otherwise.' : `The next class is ${p.proposal.nextClassName}.`}
          </p>
          {p.rows.length === 0 ? (
            <Card className="px-5 py-12 text-center text-fg-muted">No students are enrolled in this class section for {p.proposal.fromYearName}.</Card>
          ) : (
            <Card className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Decision for each student</caption>
                <thead className="border-b border-line-subtle text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
                  <tr>
                    <th scope="col" className={TH}>Student</th>
                    <th scope="col" className={TH}>Roll</th>
                    <th scope="col" className={TH}>Decision</th>
                    <th scope="col" className={TH}>Move to class</th>
                  </tr>
                </thead>
                <tbody>
                  {p.rows.map((r, i) => {
                    const who = p.people[r.studentId];
                    const err = rowError(p.failure, i);
                    return (
                      <tr key={r.studentId} className="border-b border-line-subtle last:border-0 hover:bg-canvas">
                        <td className="px-4 py-3">
                          <span className="font-medium text-fg">{who?.name}</span>
                          <span className="block text-xs text-fg-subtle">
                            {who?.code}
                            {who && who.status !== 'active' ? ` · ${who.status}` : ''}
                          </span>
                          {err ? <span className="block text-xs text-danger">{err}</span> : null}
                        </td>
                        <td className="px-4 py-3 text-fg-muted">{who?.roll ?? '—'}</td>
                        <td className="px-4 py-2.5">
                          <select aria-label={`Decision for ${who?.name}`} className={CELL} value={r.decision} onChange={(e) => p.onDecision(r.studentId, e.target.value as Decision)}>
                            {DECISIONS.map((d) => <option key={d.value} value={d.value} disabled={!active(r.studentId) && d.value !== 'leave_out'}>{d.label}</option>)}
                          </select>
                        </td>
                        <td className="px-4 py-2.5">
                          {r.decision === 'promote' ? (
                            <select aria-label={`Class for ${who?.name}`} className={CELL} value={r.toClassId} onChange={(e) => p.onChange(r.studentId, { toClassId: e.target.value })}>
                              <option value="">Choose…</option>
                              {toClasses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          ) : (
                            <span className="text-fg-subtle">{r.decision === 'repeat' ? p.proposal?.className : '—'}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </Card>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <p role="status" className="text-sm text-fg-muted" data-testid="tally">{tallyText(counts)}</p>
              <select aria-label="Set every active student to" className={CONTROL} value="" onChange={(e) => e.target.value && setAll(e.target.value as Decision)}>
                <option value="">Set every active student to…</option>
                {DECISIONS.filter((d) => d.value !== 'leave_out').map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            </div>
            <Button disabled={!p.canPrepare || p.busy || p.rows.length === 0 || p.rows.length > MAX_ROWS} onClick={p.onNext}>
              Save and continue
              <ArrowRight aria-hidden="true" className="size-4" />
            </Button>
          </div>
          {!p.canPrepare ? <p className="text-sm text-fg-muted">You can look at this class section but not change it.</p> : null}
        </>
      ) : null}
    </div>
  );
}

/** Step 2: sections and roll numbers, then preview, then commit. */
function StepEnroll(p: {
  source: Source; sourceClass: string; sourceSection: string; toYearName: string; people: Record<string, Person>; rows: RowForm[]; rollMode: RollMode; toMaps: ClassSectionMap[]; preview: Outcome | null; busy: boolean;
  canCommit: boolean; canDiscard: boolean; failure: PromotionsError | null; onRollMode: (m: RollMode) => void; onChange: (id: string, patch: Partial<RowForm>) => void; onBack: () => void; onPreview: () => void; onCommit: () => void; onDiscard: () => void;
}) {
  const result = (id: string) => p.preview?.rows.find((r) => r.studentId === id);
  const moving = p.rows.filter((r) => r.decision === 'promote' || r.decision === 'repeat');
  const mode = ROLL_MODES.find((m) => m.value === p.rollMode);
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <fieldset>
          <legend className="mb-2 font-display text-lg font-semibold text-fg">Roll numbers in {p.toYearName}</legend>
          <div className="flex flex-wrap gap-4">
            {ROLL_MODES.map((m) => (
              <label key={m.value} className="flex items-center gap-2 text-sm text-fg">
                <input type="radio" name="rollMode" checked={p.rollMode === m.value} onChange={() => p.onRollMode(m.value)} className="size-4 accent-[var(--color-accent)]" />
                {m.label}
              </label>
            ))}
          </div>
          <p className="mt-2 text-sm text-fg-subtle">{mode?.hint} A roll number typed below always wins.</p>
        </fieldset>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Section and roll number for each student</caption>
          <thead className="border-b border-line-subtle text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
            <tr>
              <th scope="col" className={TH}>Student</th>
              <th scope="col" className={TH}>Decision</th>
              <th scope="col" className={TH}>Section</th>
              <th scope="col" className={TH}>Roll number</th>
              <th scope="col" className={TH}>{p.preview ? 'Result' : 'Result (after preview)'}</th>
            </tr>
          </thead>
          <tbody>
            {p.rows.map((r) => {
              const who = p.people[r.studentId];
              const moves = r.decision === 'promote' || r.decision === 'repeat';
              const res = result(r.studentId);
              const target = targetClassId(r, p.source.classId);
              const choices = sectionsOf(p.toMaps, target);
              return (
                <tr key={r.studentId} className={`border-b border-line-subtle align-top last:border-0 ${res?.outcome === 'problem' ? 'bg-danger-bg' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="font-medium text-fg">{who?.name}</span>
                    <span className="block text-xs text-fg-muted">{who?.code}</span>
                  </td>
                  <td className="px-4 py-3 text-fg-muted">
                    {decisionLabel(r.decision)}
                    {r.decision === 'promote' ? <span className="block text-xs text-fg-muted">to {res?.toClassName ?? 'the chosen class'}</span> : null}
                  </td>
                  <td className="px-4 py-2.5">
                    {moves ? (
                      <select aria-label={`Section for ${who?.name}`} className={CELL} value={r.toSectionId} onChange={(e) => p.onChange(r.studentId, { toSectionId: e.target.value })}>
                        <option value="">Same section ({p.sourceSection})</option>
                        {choices.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    ) : (
                      <span className="text-fg-subtle">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {moves ? (
                      <input aria-label={`Roll number for ${who?.name}`} className={CELL} value={r.rollNumber} maxLength={20} placeholder={p.rollMode === 'alphabetical' ? 'Automatic' : p.rollMode === 'keep' ? (who?.roll ?? 'None') : 'Blank'} onChange={(e) => p.onChange(r.studentId, { rollNumber: e.target.value })} />
                    ) : (
                      <span className="text-fg-subtle">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3" data-testid={`result-${r.studentId}`}>
                    {res ? (
                      res.outcome === 'problem' ? (
                        <ul className="space-y-0.5 text-danger">
                          {res.problems.map((pr) => <li key={`${pr.field}-${pr.code}`}>{pr.message}</li>)}
                        </ul>
                      ) : (
                        <span className="text-fg-muted">{outcomeText(res)}</span>
                      )
                    ) : (
                      <span className="text-fg-subtle">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      {p.preview ? (
        <div className="space-y-2" aria-live="polite">
          <p role="status" data-testid="preview-summary" className={`text-sm font-medium ${p.preview.problemCount > 0 ? 'text-danger' : 'text-success'}`}>
            {p.preview.problemCount > 0
              ? `${p.preview.problemCount} ${p.preview.problemCount === 1 ? 'student needs' : 'students need'} attention. Fix them or set them to “Leave out”, then preview again.`
              : `Ready: ${p.preview.enrolledCount} to enrol${p.preview.graduatedCount ? `, ${p.preview.graduatedCount} to graduate` : ''}${p.preview.leftOutCount ? `, ${p.preview.leftOutCount} left out` : ''}.`}
          </p>
          {p.preview.warnings.map((w) => <p key={w} className="text-sm text-warning">{w}</p>)}
        </div>
      ) : null}
      {moving.length === 0 && p.rows.length > 0 ? <p className="text-sm text-fg-muted">No one is moving to a class, so only the graduates will change.</p> : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={p.onBack} disabled={p.busy}>
            <ArrowLeft aria-hidden="true" className="size-4" />
            Back
          </Button>
          {p.canDiscard ? <Button variant="ghost" onClick={p.onDiscard} disabled={p.busy}>Discard draft</Button> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={p.onPreview} disabled={p.busy}>
            <Eye aria-hidden="true" className="size-4" />
            {p.busy && !p.preview ? 'Checking…' : 'Preview'}
          </Button>
          <Button onClick={p.onCommit} disabled={p.busy || !p.canCommit || !p.preview || p.preview.problemCount > 0}>
            <Rocket aria-hidden="true" className="size-4" />
            Enrol…
          </Button>
        </div>
      </div>
      {!p.canCommit ? <p className="text-sm text-fg-muted">You can prepare and preview this promotion. Enrolling needs permission to edit promotions and students.</p> : null}
    </div>
  );
}

/** Step 3: what the batch made, and the undo. */
function StepDone({ api, detail, canCommit, onChanged, onAnother }: { api: PromotionsApi; detail: Detail; canCommit: boolean; onChanged: (d: Detail) => void; onAnother: () => void }) {
  const b = detail.batch;
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<PromotionsError | null>(null);

  const undo = async () => {
    setBusy(true);
    setFailure(null);
    try {
      await api.undo(b.id, reason);
      onChanged(await api.get(b.id));
      setAsking(false);
      setReason('');
      toast.success('Promotion undone.');
    } catch (e) {
      setAsking(false);
      setFailure(e instanceof PromotionsError ? e : new PromotionsError(0, 'error', [], errorText(e)));
    } finally {
      setBusy(false);
    }
  };
  const names = Object.fromEntries(detail.rows.map((r) => [r.studentId, r.studentName]));

  return (
    <div className="space-y-4">
      <Card className="space-y-2 p-5">
        <h2 className="font-display text-lg font-semibold text-fg">
          {b.fromClassName} · {b.fromSectionName}: {b.fromYearName} to {b.toYearName}
        </h2>
        <p role="status" className={`text-sm font-medium ${STATUS_COLOUR[b.status]}`} data-testid="batch-status">
          {b.status === 'committed' ? `Committed on ${formatDateTime(b.committedAt)}${b.committedByName ? ` by ${b.committedByName}` : ''}.` : null}
          {b.status === 'undone' ? `Undone on ${formatDateTime(b.undoneAt)}${b.undoneByName ? ` by ${b.undoneByName}` : ''}${b.undoReason ? `: ${b.undoReason}` : ''}.` : null}
          {b.status === 'draft' ? 'This promotion is still a draft.' : null}
        </p>
        <p className="text-sm text-fg-muted">{tallyText({ promote: b.promoteCount, repeat: b.repeatCount, graduate: b.graduateCount, leave_out: b.leaveOutCount })}.</p>
        {b.status === 'committed' && b.canUndo ? <p className="text-sm text-fg-muted">You can undo this until {formatDateTime(b.undoUntil)}, as long as nothing it created has been changed.</p> : null}
        {b.status === 'committed' && !b.canUndo ? <p className="text-sm text-fg-muted">The undo window has closed.</p> : null}
      </Card>

      {failure ? (
        <Alert>
          <p>{failure.message}</p>
          {failure.reasons.length > 0 ? (
            <ul className="mt-1 list-disc pl-5" data-testid="undo-reasons">
              {failure.reasons.map((r) => (
                <li key={`${r.field}-${r.code}`}>
                  {names[r.field] ? `${names[r.field]}: ` : ''}
                  {undoReasonText(r.code)}
                </li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}

      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">What happened to each student</caption>
          <thead className="border-b border-line-subtle text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
            <tr>
              <th scope="col" className={TH}>Student</th>
              <th scope="col" className={TH}>Decision</th>
              <th scope="col" className={TH}>{b.status === 'undone' ? 'Was enrolled in' : 'Now'}</th>
            </tr>
          </thead>
          <tbody>
            {detail.rows.map((r) => (
              <tr key={r.studentId} className="border-b border-line-subtle last:border-0">
                <td className="px-4 py-3">
                  <span className="font-medium text-fg">{r.studentName}</span>
                  <span className="block text-xs text-fg-subtle">{r.registrationCode}</span>
                </td>
                <td className="px-4 py-3 text-fg-muted">{decisionLabel(r.decision)}</td>
                <td className="px-4 py-3 text-fg-muted">
                  {r.newEnrollmentId
                    ? `${r.enrolledClassName} · ${r.enrolledSectionName}${r.enrolledRollNumber ? ` · roll ${r.enrolledRollNumber}` : ''}`
                    : r.decision === 'graduate'
                      ? b.status === 'undone' ? 'Back to their earlier status' : 'Alumni'
                      : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <div className="flex flex-wrap gap-2">
        {b.status === 'committed' && b.canUndo && canCommit ? (
          <Button variant="secondary" onClick={() => setAsking(true)} disabled={busy}>
            <Undo2 aria-hidden="true" className="size-4" />
            Undo this promotion…
          </Button>
        ) : null}
        <Button variant="secondary" onClick={onAnother}>
          Promote another class
        </Button>
      </div>

      <ConfirmDialog open={asking} onClose={() => setAsking(false)} title="Undo this promotion?">
        <p className="text-sm text-fg-muted">The new-year enrolments it made are removed and graduates return to their earlier status. It is refused if anything has changed since.</p>
        <label className="mt-3 flex flex-col gap-1 text-sm font-medium text-fg">
          Why are you undoing it?
          <textarea className="min-h-20 rounded-md border border-line bg-surface p-2 text-sm font-normal" maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <div className="mt-4 flex gap-2">
          <Button disabled={busy || !reason.trim()} onClick={() => void undo()}>
            Undo promotion
          </Button>
          <Button variant="secondary" onClick={() => setAsking(false)}>
            Keep it
          </Button>
        </div>
      </ConfirmDialog>
    </div>
  );
}

/** Every batch, newest first, with a way to open it. */
function HistoryList({ api, onOpen }: { api: PromotionsApi; onOpen: (b: Batch) => void }) {
  const [status, setStatus] = useState<BatchStatus | ''>('');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Batch[]>([]);
  const [total, setTotal] = useState(0);
  const [load, setLoad] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoad('loading');
    try {
      const r = await api.list({ status, page });
      setItems(r.items);
      setTotal(r.page.total);
      setLoad('ready');
    } catch (e) {
      setError(errorText(e));
      setLoad('error');
    }
  }, [api, status, page]);
  useEffect(() => {
    void reload();
  }, [reload]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="space-y-4">
      <select aria-label="Status" className={CONTROL} value={status} onChange={(e) => { setStatus(e.target.value as BatchStatus | ''); setPage(1); }}>
        <option value="">All promotions</option>
        {(Object.keys(STATUS_WORDS) as BatchStatus[]).map((s) => <option key={s} value={s}>{STATUS_WORDS[s]}</option>)}
      </select>
      {load === 'error' ? (
        <Alert>
          <p>{error}</p>
          <Button variant="secondary" className="mt-2" onClick={() => void reload()}>Try again</Button>
        </Alert>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm" aria-busy={load === 'loading'}>
            <caption className="sr-only">Promotions</caption>
            <thead className="border-b border-line-subtle text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
              <tr>
                <th scope="col" className={TH}>Class section</th>
                <th scope="col" className={TH}>Years</th>
                <th scope="col" className={TH}>Students</th>
                <th scope="col" className={TH}>Status</th>
                <th scope="col" className={TH}>When</th>
                <th scope="col" className={`${TH} text-right`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {load === 'ready' && items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-16 text-center text-fg-muted">
                    <History aria-hidden="true" className="mx-auto mb-3 size-6 text-fg-subtle" />
                    No promotions yet.
                  </td>
                </tr>
              ) : null}
              {items.map((b) => (
                <tr key={b.id} className="border-b border-line-subtle last:border-0 hover:bg-canvas">
                  <td className="px-4 py-3.5 font-medium text-fg">{b.fromClassName} · {b.fromSectionName}</td>
                  <td className="px-4 py-3.5 text-fg-muted">{b.fromYearName} to {b.toYearName}</td>
                  <td className="px-4 py-3.5 text-fg-muted">
                    {b.studentCount}
                    <span className="block text-xs text-fg-subtle">{tallyText({ promote: b.promoteCount, repeat: b.repeatCount, graduate: b.graduateCount, leave_out: b.leaveOutCount })}</span>
                  </td>
                  <td className={`px-4 py-3.5 font-medium ${STATUS_COLOUR[b.status]}`}>{STATUS_WORDS[b.status]}</td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-fg-muted">{formatDate(b.committedAt ?? b.createdAt)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button size="sm" variant="ghost" aria-label={`Open ${b.fromClassName} ${b.fromSectionName}, ${b.fromYearName}`} onClick={() => onOpen(b)}>
                      Open
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {total > PAGE_SIZE ? (
        <nav aria-label="Pages" className="flex items-center justify-end gap-2 text-sm text-fg-muted">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page">
            <ChevronLeft aria-hidden="true" className="size-4" />
          </Button>
          <span>Page {page} of {pages}</span>
          <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Next page">
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
