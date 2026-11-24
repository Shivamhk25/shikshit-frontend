import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, ChevronLeft, ChevronRight, CircleAlert, Eye, History, Play, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, ConfirmDialog, PageHeader } from '../../design-system';
import { useAccessState } from '../../shell/AccessProvider';
import { useAuth } from '../../shell/AuthProvider';
import { formatDate, formatDateTime } from '../adm/dates';
import {
  count, createRolloverApi, defaultFrom, defaultSelection, inChecklistOrder, ITEM_WORDS, MAKE_CURRENT, PAGE_SIZE, reasonText, resultText, RolloverError, shiftText, suggestNewYear, yearsAfter,
  type Checklist, type ChecklistStep, type ItemStatus, type NewYear, type Pair, type Run, type RolloverApi, type StepId, type StepResult, type YearOption,
} from './rollover';

const CONTROL = 'h-10 rounded-md border border-line bg-surface px-3 text-sm text-fg shadow-soft hover:border-line-strong focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle disabled:cursor-not-allowed disabled:bg-subtle disabled:text-fg-subtle';
const TH = 'px-4 py-3.5 font-semibold';
const NEW_YEAR = '__new__';

const ITEM_TONE: Record<ItemStatus, string> = {
  create: 'text-success',
  exists: 'text-fg-muted',
  conflict: 'text-danger',
  skipped: 'text-fg-muted',
};

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : 'Something went wrong. Please try again.';
}

function asError(e: unknown): RolloverError {
  return e instanceof RolloverError ? e : new RolloverError(0, 'error', [], errorText(e));
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <div role="alert" className="rounded-md border border-danger-line bg-danger-bg p-3 text-sm text-danger">
      {children}
    </div>
  );
}

function Failure({ error }: { error: RolloverError }) {
  const reasons = error.reasons.filter((r) => r.field === 'step' || r.field === '');
  return (
    <Alert>
      <p>{error.message}</p>
      {reasons.length ? (
        <ul className="mt-2 list-disc space-y-1 pl-5">
          {reasons.map((r) => (
            <li key={r.message}>{r.message}</li>
          ))}
        </ul>
      ) : null}
    </Alert>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-fg">
      {label}
      {children}
      {error ? <span role="alert" className="text-xs font-normal text-danger">{error}</span> : null}
    </label>
  );
}

/** TEN-01 Year rollover: set up the next academic year from the one that is ending, step by step, plus the history of what was run. */
export function YearRolloverPage() {
  const { session } = useAuth();
  const api = useMemo(() => createRolloverApi(session), [session]);
  const [tab, setTab] = useState<'wizard' | 'history'>('wizard');
  return (
    <section className="space-y-4">
      <PageHeader
        title="Year rollover"
        description="Set up the next academic year from the one that is ending. Choose what to copy, check what each step would do, then run it. Students are moved on the Promotions screen."
      />
      <div role="group" aria-label="Show" className="inline-flex rounded-md border border-line bg-surface p-0.5 shadow-soft">
        {(['wizard', 'history'] as const).map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={tab === t}
            onClick={() => setTab(t)}
            className={`h-9 rounded px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring ${tab === t ? 'bg-accent text-on-accent' : 'text-fg-muted hover:text-fg'}`}
          >
            {t === 'wizard' ? 'Roll over a year' : 'History'}
          </button>
        ))}
      </div>
      {tab === 'wizard' ? <Wizard api={api} /> : <HistoryList api={api} />}
    </section>
  );
}

type Stage = 'years' | 'checklist' | 'results';

interface Outcome {
  done: StepResult[];
  failed?: { step: StepId; error: RolloverError };
  notRun: StepId[];
}

function Stepper({ stage }: { stage: Stage }) {
  const items: [Stage, string][] = [['years', 'Choose the years'], ['checklist', 'Checklist'], ['results', 'Results']];
  const at = items.findIndex(([s]) => s === stage);
  return (
    <ol className="flex flex-wrap items-center gap-3 text-sm" aria-label="Steps">
      {items.map(([, label], i) => {
        const state = i === at ? 'current' : i < at ? 'done' : 'todo';
        return (
          <li key={label} aria-current={state === 'current' ? 'step' : undefined} className="flex items-center gap-2">
            <span className={`flex size-6 items-center justify-center rounded-full text-xs font-semibold ${state === 'todo' ? 'border border-line text-fg-subtle' : 'bg-accent text-on-accent'}`}>
              {state === 'done' ? <Check aria-hidden="true" className="size-3.5" /> : i + 1}
            </span>
            <span className={state === 'todo' ? 'text-fg-subtle' : 'font-medium text-fg'}>{label}</span>
            {i < items.length - 1 ? <span aria-hidden="true" className="mx-1 h-px w-8 bg-line" /> : null}
          </li>
        );
      })}
    </ol>
  );
}

function Wizard({ api }: { api: RolloverApi }) {
  const access = useAccessState();
  const can = (p: string) => access.phase === 'ready' && access.access.can(p);
  const canRun = can('ten.year_rollover.create');
  const canSwitch = can('ten.year_rollover.edit');

  const [stage, setStage] = useState<Stage>('years');
  const [years, setYears] = useState<YearOption[]>([]);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [draft, setDraft] = useState<NewYear>({ code: '', name: '', startDate: '', endDate: '' });
  const [checklist, setChecklist] = useState<Checklist | null>(null);
  const [picked, setPicked] = useState<Set<StepId>>(new Set());
  const [previews, setPreviews] = useState<Partial<Record<StepId, StepResult>>>({});
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [failure, setFailure] = useState<RolloverError | null>(null);
  const [busy, setBusy] = useState<'' | 'create' | 'load' | 'preview' | 'run'>('');
  const [confirming, setConfirming] = useState<StepResult | null>(null);

  const loadYears = useCallback(async (): Promise<YearOption[]> => {
    const list = await api.years();
    setYears(list);
    return list;
  }, [api]);

  /** Chooses the year to set up: the first year after `fromId`, or, when there is none, a new one (for those who may create it). */
  const chooseTo = useCallback(
    (list: YearOption[], fromId: string) => {
      const next = yearsAfter(list, fromId)[0]?.id;
      const fromYear = list.find((y) => y.id === fromId);
      if (next || !canRun || !fromYear) return setTo(next ?? '');
      setTo(NEW_YEAR);
      setDraft(suggestNewYear(fromYear));
    },
    [canRun],
  );

  useEffect(() => {
    loadYears()
      .then((list) => {
        const f = defaultFrom(list);
        setFrom(f);
        chooseTo(list, f);
      })
      .catch((e) => setFailure(asError(e)));
  }, [loadYears, chooseTo]);

  const fromYear = years.find((y) => y.id === from);
  const later = useMemo(() => yearsAfter(years, from), [years, from]);
  const creating = to === NEW_YEAR;
  const pair: Pair | null = from && to && to !== NEW_YEAR ? { fromYearId: from, toYearId: to } : null;

  const pickFrom = (id: string) => {
    setFrom(id);
    chooseTo(years, id);
    setFailure(null);
  };
  const pickTo = (id: string) => {
    setTo(id);
    setFailure(null);
    if (id === NEW_YEAR && fromYear) setDraft(suggestNewYear(fromYear));
  };

  const createYear = async () => {
    setBusy('create');
    setFailure(null);
    try {
      const made = await api.createYear(from, draft);
      await loadYears();
      setTo(made.id);
      toast.success(`${made.name} created.`);
    } catch (e) {
      setFailure(asError(e));
    } finally {
      setBusy('');
    }
  };

  const openChecklist = async (p: Pair, keep = false) => {
    setBusy('load');
    setFailure(null);
    try {
      const c = await api.checklist(p);
      setChecklist(c);
      if (!keep) {
        setPicked(new Set(defaultSelection(c.steps, canRun)));
        setPreviews({});
      }
      setStage('checklist');
    } catch (e) {
      setFailure(asError(e));
    } finally {
      setBusy('');
    }
  };

  const preview = async (id: StepId) => {
    if (!pair) return;
    setBusy('preview');
    setFailure(null);
    try {
      const r = await api.preview(id, pair);
      setPreviews((p) => ({ ...p, [id]: r }));
    } catch (e) {
      setFailure(asError(e));
    } finally {
      setBusy('');
    }
  };

  const toggle = (id: StepId) =>
    setPicked((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  /** Runs the ticked steps one after another, each in its own transaction, and stops at the first one that fails. */
  const runSelected = async () => {
    if (!pair || !checklist) return;
    const order = inChecklistOrder(checklist.steps, picked);
    setConfirming(null);
    setBusy('run');
    setFailure(null);
    const done: StepResult[] = [];
    let failed: Outcome['failed'];
    for (const id of order) {
      try {
        done.push(await api.run(id, pair, id === MAKE_CURRENT));
      } catch (e) {
        failed = { step: id, error: asError(e) };
        break;
      }
    }
    const ranIds = new Set([...done.map((d) => d.step), ...(failed ? [failed.step] : [])]);
    setOutcome({ done, failed, notRun: order.filter((id) => !ranIds.has(id)) });
    setStage('results');
    setBusy('');
    if (!failed) toast.success('Rollover steps finished.');
  };

  /** A step that needs a confirmation is previewed first, so the confirmation shows what is about to change. */
  const askToRun = async () => {
    if (!pair || !checklist) return;
    if (!picked.has(MAKE_CURRENT)) return void runSelected();
    setBusy('preview');
    setFailure(null);
    try {
      setConfirming(await api.preview(MAKE_CURRENT, pair));
    } catch (e) {
      setFailure(asError(e));
    } finally {
      setBusy('');
    }
  };

  const titleOf = (id: StepId) => checklist?.steps.find((s) => s.id === id)?.title ?? id;

  return (
    <div className="space-y-4">
      <Stepper stage={stage} />
      {failure ? <Failure error={failure} /> : null}
      {stage === 'years' ? (
        <ChooseYears
          years={years} from={from} to={to} later={later} creating={creating} draft={draft} failure={failure} busy={busy} canRun={canRun}
          onFrom={pickFrom} onTo={pickTo} onDraft={setDraft} onCreate={() => void createYear()} onContinue={() => pair && void openChecklist(pair)}
        />
      ) : null}
      {stage === 'checklist' && checklist && pair ? (
        <ChecklistView
          checklist={checklist} picked={picked} previews={previews} busy={busy} canRun={canRun} canSwitch={canSwitch}
          onToggle={toggle} onPreview={(id) => void preview(id)} onRun={() => void askToRun()} onBack={() => setStage('years')}
        />
      ) : null}
      {stage === 'results' && outcome && checklist ? (
        <Results outcome={outcome} checklist={checklist} titleOf={titleOf} onBack={() => pair && void openChecklist(pair, true)} />
      ) : null}

      <ConfirmDialog open={confirming !== null} onClose={() => setConfirming(null)} title={`Make ${checklist?.to.name ?? 'the new year'} the current year?`}>
        {confirming ? (
          <div className="space-y-3 text-sm text-fg-muted">
            {confirming.blockers.length ? (
              <Alert>
                <p>It cannot be done yet:</p>
                <ul className="mt-1 list-disc space-y-1 pl-5">
                  {confirming.blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </Alert>
            ) : (
              <>
                <p>
                  Attendance, fees, admissions and every screen that opens on the current year will use {checklist?.to.name} from now on. This cannot be undone from here; to go back you would have to
                  make the old year current again by hand.
                </p>
                {confirming.items[0]?.detail ? <p className="font-medium text-fg">{confirming.items[0].detail}</p> : null}
                {confirming.warnings.length ? (
                  <ul className="list-disc space-y-1 pl-5 text-warning" aria-label="Warnings">
                    {confirming.warnings.map((w) => (
                      <li key={w}>{w}</li>
                    ))}
                  </ul>
                ) : null}
                {picked.size > 1 ? <p>The other ticked steps run first, each on its own.</p> : null}
              </>
            )}
          </div>
        ) : null}
        <div className="mt-4 flex gap-2">
          <Button disabled={!confirming || confirming.blockers.length > 0} onClick={() => void runSelected()}>
            Make current
          </Button>
          <Button variant="secondary" onClick={() => setConfirming(null)}>
            Cancel
          </Button>
        </div>
      </ConfirmDialog>
    </div>
  );
}

function ChooseYears(props: {
  years: YearOption[];
  from: string;
  to: string;
  later: YearOption[];
  creating: boolean;
  draft: NewYear;
  failure: RolloverError | null;
  busy: string;
  canRun: boolean;
  onFrom: (id: string) => void;
  onTo: (id: string) => void;
  onDraft: (d: NewYear) => void;
  onCreate: () => void;
  onContinue: () => void;
}) {
  const { years, from, to, later, creating, draft, failure, busy, canRun } = props;
  const set = (patch: Partial<NewYear>) => props.onDraft({ ...draft, ...patch });
  const ready = Boolean(from && to && to !== NEW_YEAR) && busy === '';
  return (
    <Card className="space-y-5 p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Year being rolled over">
          <select className={CONTROL} value={from} onChange={(e) => props.onFrom(e.target.value)}>
            {years.length === 0 ? <option value="">No academic years yet</option> : null}
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
                {y.isCurrent ? ' (current)' : ''}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Year to set up">
          <select className={CONTROL} value={to} onChange={(e) => props.onTo(e.target.value)} disabled={!from}>
            {later.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
            {canRun ? <option value={NEW_YEAR}>Create a new year…</option> : later.length === 0 ? <option value="">No later year exists</option> : null}
          </select>
        </Field>
      </div>

      {creating && canRun ? (
        <fieldset className="space-y-4 rounded-md border border-line-subtle p-4">
          <legend className="px-1 text-sm font-semibold text-fg">The new academic year</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" error={failure?.fieldMessage('name')}>
              <input className={CONTROL} value={draft.name} maxLength={100} onChange={(e) => set({ name: e.target.value })} />
            </Field>
            <Field label="Code" error={failure?.fieldMessage('code')}>
              <input className={CONTROL} value={draft.code} maxLength={20} onChange={(e) => set({ code: e.target.value })} />
            </Field>
            <Field label="Starts on" error={failure?.fieldMessage('startDate')}>
              <input className={CONTROL} type="date" value={draft.startDate} onChange={(e) => set({ startDate: e.target.value })} />
            </Field>
            <Field label="Ends on" error={failure?.fieldMessage('endDate')}>
              <input className={CONTROL} type="date" value={draft.endDate} onChange={(e) => set({ endDate: e.target.value })} />
            </Field>
          </div>
          <p className="text-xs text-fg-muted">The year must start after the year being rolled over and must not overlap another year. It is not made current until you choose that step.</p>
          <Button variant="secondary" onClick={props.onCreate} disabled={busy !== '' || !draft.name.trim() || !draft.code.trim() || !draft.startDate || !draft.endDate}>
            Create year
          </Button>
        </fieldset>
      ) : null}

      {!canRun ? <p className="text-sm text-fg-muted">You can look at the checklist and the history but not run any step.</p> : null}
      <div>
        <Button disabled={!ready} onClick={props.onContinue}>
          Continue
          <ArrowRight aria-hidden="true" className="size-4" />
        </Button>
      </div>
    </Card>
  );
}

function ChecklistView(props: {
  checklist: Checklist;
  picked: Set<StepId>;
  previews: Partial<Record<StepId, StepResult>>;
  busy: string;
  canRun: boolean;
  canSwitch: boolean;
  onToggle: (id: StepId) => void;
  onPreview: (id: StepId) => void;
  onRun: () => void;
  onBack: () => void;
}) {
  const { checklist: c, picked, previews, busy, canRun, canSwitch } = props;
  const n = picked.size;
  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <div className="space-y-1">
          <p className="font-display text-lg font-semibold text-fg">
            {c.from.name} <ArrowRight aria-label="to" className="mx-1 inline size-4 align-[-2px] text-fg-subtle" /> {c.to.name}
          </p>
          <p className="text-sm text-fg-muted" data-testid="shift">
            {formatDate(c.from.startDate)} to {formatDate(c.from.endDate)} becomes {formatDate(c.to.startDate)} to {formatDate(c.to.endDate)}. {shiftText(c.shift)}
          </p>
        </div>
        <Button variant="secondary" onClick={props.onBack}>
          Change years
        </Button>
      </Card>

      <PromotionCallout checklist={c} />

      <ol className="space-y-3" aria-label="Rollover steps">
        {c.steps.map((s) => (
          <StepRow
            key={s.id} step={s} checklist={c} checked={picked.has(s.id)} result={previews[s.id]} busy={busy}
            disabledReason={!canRun ? 'You do not have permission to run this step.' : s.id === MAKE_CURRENT && !canSwitch ? 'Making a year current needs the edit permission for year rollover.' : ''}
            onToggle={() => props.onToggle(s.id)} onPreview={() => props.onPreview(s.id)}
          />
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={n === 0 || busy !== '' || !canRun} onClick={props.onRun}>
          <Play aria-hidden="true" className="size-4" />
          {busy === 'run' ? 'Running…' : n === 0 ? 'Run selected steps' : `Run ${count(n, 'selected step')}`}
        </Button>
        <p className="text-sm text-fg-muted">Each step runs on its own. A step never changes a row the new year already has, so running it again is safe.</p>
      </div>
      <ul className="space-y-1 text-sm text-fg-muted">
        {c.notes.map((note) => (
          <li key={note}>{note}</li>
        ))}
      </ul>
    </div>
  );
}

function PromotionCallout({ checklist: c }: { checklist: Checklist }) {
  const { sections, promoted } = c.promotions;
  if (sections === 0) return null;
  const left = sections - promoted;
  return (
    <div role="status" className={`flex flex-wrap items-center justify-between gap-3 rounded-md border p-4 text-sm ${left > 0 ? 'border-warning-line bg-warning-bg' : 'border-success-line bg-success-bg'}`}>
      <p className="text-fg" data-testid="promotion-progress">
        {left > 0
          ? `${promoted} of ${count(sections, 'class section')} with students in ${c.from.name} ${promoted === 1 ? 'has' : 'have'} been promoted into ${c.to.name}. Copy the class sections first, then promote each one.`
          : `All ${count(sections, 'class section')} with students in ${c.from.name} have been promoted into ${c.to.name}.`}
      </p>
      <Link to="/promotions" className="inline-flex h-9 items-center rounded-md border border-line bg-surface px-3 font-medium text-fg hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring">
        Open Promotions
      </Link>
    </div>
  );
}

function StepRow({ step: s, checklist: c, checked, result, busy, disabledReason, onToggle, onPreview }: {
  step: ChecklistStep;
  checklist: Checklist;
  checked: boolean;
  result?: StepResult;
  busy: string;
  disabledReason: string;
  onToggle: () => void;
  onPreview: () => void;
}) {
  const id = `step-${s.id}`;
  const counts = s.id === MAKE_CURRENT ? (c.to.isCurrent ? `${c.to.name} is already the current year.` : `${c.from.isCurrent ? `${c.from.name} is` : 'Another year is'} the current year now.`) : `${s.sourceCount} in ${c.from.name} · ${s.targetCount} in ${c.to.name}`;
  return (
    <li className={`rounded-lg border bg-surface p-5 shadow-card ${s.irreversible ? 'border-warning-line' : 'border-line-subtle'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <input
            id={id} type="checkbox" className="mt-1 size-4 accent-accent" checked={checked} disabled={disabledReason !== '' || (s.id === MAKE_CURRENT && c.to.isCurrent)} onChange={onToggle}
            aria-label={`Include ${s.title}`} aria-describedby={`${id}-about`}
          />
          <div className="min-w-0 space-y-1" id={`${id}-about`}>
            <p className="flex flex-wrap items-center gap-2 font-medium text-fg">
              {s.title}
              {s.irreversible ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-warning-line bg-warning-bg px-2 py-0.5 text-xs font-semibold text-warning">
                  <ShieldAlert aria-hidden="true" className="size-3.5" />
                  Cannot be undone from here
                </span>
              ) : null}
            </p>
            <p className="text-sm text-fg-muted">{s.description}</p>
            <p className="text-sm text-fg">{counts}</p>
            <p className="text-xs text-fg-subtle" data-testid={`last-run-${s.id}`}>
              {s.lastRun ? `Last run ${formatDateTime(s.lastRun.ranAt)}${s.lastRun.runByName ? ` by ${s.lastRun.runByName}` : ''}: ${resultText({ ...s.lastRun, dryRun: false })}.` : 'Not run yet.'}
            </p>
            {disabledReason ? <p className="text-xs text-fg-subtle">{disabledReason}</p> : null}
          </div>
        </div>
        <Button size="sm" variant="secondary" disabled={disabledReason !== '' || busy !== ''} aria-label={`Preview ${s.title}`} onClick={onPreview}>
          <Eye aria-hidden="true" className="size-4" />
          Preview
        </Button>
      </div>
      {result ? <PreviewPanel result={result} title={s.title} /> : null}
    </li>
  );
}

function ItemsTable({ result, title }: { result: StepResult; title: string }) {
  if (result.items.length === 0) return null;
  return (
    <div role="region" aria-label={`Rows of ${title}`} tabIndex={0} className="max-h-72 overflow-auto rounded-md border border-line-subtle focus-visible:outline-2 focus-visible:outline-ring">
      <table className="w-full text-left text-sm">
        <caption className="sr-only">{title}: what the step does with each row</caption>
        <thead className="sticky top-0 bg-surface text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
          <tr>
            <th scope="col" className="px-3 py-2 font-semibold">Row</th>
            <th scope="col" className="px-3 py-2 font-semibold">What happens</th>
            <th scope="col" className="px-3 py-2 font-semibold">Note</th>
          </tr>
        </thead>
        <tbody>
          {result.items.map((it, i) => (
            <tr key={`${it.label}-${i}`} className="border-t border-line-subtle align-top">
              <td className="px-3 py-2 font-medium text-fg">{it.label}</td>
              <td className={`whitespace-nowrap px-3 py-2 font-medium ${ITEM_TONE[it.status]}`}>
                {it.review ? 'Copy, then review' : ITEM_WORDS[it.status]}
                {it.reason ? <span className="block text-xs font-normal text-fg-muted">{reasonText(it.reason)}</span> : null}
              </td>
              <td className="px-3 py-2 text-fg-muted">
                {it.detail}
                {it.message ? <span className="block text-xs">{it.message}</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PreviewPanel({ result, title }: { result: StepResult; title: string }) {
  return (
    <div className="mt-4 space-y-3 border-t border-line-subtle pt-4" aria-label={`Preview of ${title}`} role="group">
      <p className="text-sm font-medium text-fg" data-testid={`preview-${result.step}`}>
        {result.blockers.length ? 'Cannot run yet.' : `If you run it now: ${resultText(result)}.`}
        {result.reviewCount ? ` ${count(result.reviewCount, 'copied row')} to check afterwards.` : ''}
      </p>
      {result.blockers.length ? (
        <Alert>
          <ul className="list-disc space-y-1 pl-5">
            {result.blockers.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
      {result.warnings.length ? (
        <ul className="list-disc space-y-1 pl-5 text-sm text-warning" aria-label="Warnings">
          {result.warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}
      <ItemsTable result={result} title={title} />
      {result.itemsTruncated ? <p className="text-xs text-fg-muted">Only the first {result.items.length} rows are listed. The counts cover every row.</p> : null}
    </div>
  );
}

function Results({ outcome, checklist, titleOf, onBack }: { outcome: Outcome; checklist: Checklist; titleOf: (id: StepId) => string; onBack: () => void }) {
  const review = outcome.done.reduce((n, r) => n + (r.step === 'holidays' ? r.reviewCount : 0), 0);
  return (
    <div className="space-y-4" aria-live="polite">
      {outcome.failed ? (
        <Alert>
          <p className="font-medium">{titleOf(outcome.failed.step)} did not run, and nothing in it was changed.</p>
          <p className="mt-1">{outcome.failed.error.message}</p>
          {outcome.failed.error.reasons.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {outcome.failed.error.reasons.map((r) => (
                <li key={r.message}>{r.message}</li>
              ))}
            </ul>
          ) : null}
        </Alert>
      ) : null}
      <ul className="space-y-3">
        {outcome.done.map((r) => (
          <li key={r.step} className="rounded-lg border border-line-subtle bg-surface p-5 shadow-card">
            <p className="flex items-center gap-2 font-medium text-fg">
              <Check aria-hidden="true" className="size-4 text-success" />
              {titleOf(r.step)}
            </p>
            <p className="mt-1 text-sm text-fg-muted" data-testid={`result-${r.step}`}>
              {r.step === MAKE_CURRENT ? (r.createdCount ? `${checklist.to.name} is now the current year.` : `${checklist.to.name} was already the current year.`) : `${resultText(r)}.`}
            </p>
            {r.warnings.map((w) => (
              <p key={w} className="mt-1 flex items-start gap-1.5 text-sm text-warning">
                <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                {w}
              </p>
            ))}
            {r.conflictCount ? (
              <details className="mt-3">
                <summary className="cursor-pointer text-sm font-medium text-fg">{count(r.conflictCount, 'row')} could not be copied</summary>
                <div className="mt-2">
                  <ItemsTable result={{ ...r, items: r.items.filter((i) => i.status === 'conflict') }} title={titleOf(r.step)} />
                </div>
              </details>
            ) : null}
          </li>
        ))}
        {outcome.notRun.map((id) => (
          <li key={id} className="rounded-lg border border-line-subtle bg-subtle p-5 text-sm text-fg-muted">
            {titleOf(id)} was not run.
          </li>
        ))}
      </ul>
      {review > 0 ? (
        <p className="text-sm text-fg" data-testid="review-note">
          {count(review, 'holiday')} may fall on different dates this year. <Link className="font-medium text-accent-fg underline" to="/holidays">Review the holidays</Link>.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={onBack}>
          <ChevronLeft aria-hidden="true" className="size-4" />
          Back to the checklist
        </Button>
        <Link to="/promotions" className="inline-flex h-10 items-center rounded-md border border-line bg-surface px-4 text-sm font-medium text-fg hover:border-line-strong focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring">
          Open Promotions
        </Link>
      </div>
    </div>
  );
}

function HistoryList({ api }: { api: RolloverApi }) {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<Run[]>([]);
  const [total, setTotal] = useState(0);
  const [load, setLoad] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  const reload = useCallback(async () => {
    setLoad('loading');
    try {
      const r = await api.history(page);
      setItems(r.items);
      setTotal(r.page.total);
      setLoad('ready');
    } catch (e) {
      setError(errorText(e));
      setLoad('error');
    }
  }, [api, page]);
  useEffect(() => {
    void reload();
  }, [reload]);

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const stepTitle: Record<StepId, string> = {
    terms: 'Terms', class_sections: 'Class sections', subject_classes: 'Class subjects', holidays: 'Holidays', calendar_events: 'Calendar events', make_current: 'Make year current',
  };
  return (
    <div className="space-y-4">
      {load === 'error' ? (
        <Alert>
          <p>{error}</p>
          <Button variant="secondary" className="mt-2" onClick={() => void reload()}>Try again</Button>
        </Alert>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm" aria-busy={load === 'loading'}>
            <caption className="sr-only">Rollover steps that were run</caption>
            <thead className="border-b border-line-subtle text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
              <tr>
                <th scope="col" className={TH}>When</th>
                <th scope="col" className={TH}>Step</th>
                <th scope="col" className={TH}>Years</th>
                <th scope="col" className={TH}>Result</th>
                <th scope="col" className={TH}>Run by</th>
              </tr>
            </thead>
            <tbody>
              {load === 'ready' && items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-fg-muted">
                    <History aria-hidden="true" className="mx-auto mb-3 size-6 text-fg-subtle" />
                    No rollover step has been run yet.
                  </td>
                </tr>
              ) : null}
              {items.map((r) => (
                <tr key={r.id} className="border-b border-line-subtle align-top last:border-0 hover:bg-canvas">
                  <td className="whitespace-nowrap px-4 py-3.5 text-fg-muted">{formatDateTime(r.ranAt)}</td>
                  <td className="px-4 py-3.5 font-medium text-fg">{stepTitle[r.step] ?? r.step}</td>
                  <td className="px-4 py-3.5 text-fg-muted">{r.fromYearName} to {r.toYearName}</td>
                  <td className="px-4 py-3.5">
                    {r.status === 'failed' ? (
                      <span className="text-danger">Failed: {r.error}</span>
                    ) : (
                      <span className="text-fg-muted">{resultText({ ...r, dryRun: false })}</span>
                    )}
                    {r.warnings.map((w) => (
                      <span key={w} className="block text-xs text-warning">{w}</span>
                    ))}
                  </td>
                  <td className="px-4 py-3.5 text-fg-muted">{r.runByName ?? '—'}</td>
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
