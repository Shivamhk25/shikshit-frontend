import { useId, useState, type FormEvent } from 'react';
import { Info, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Input, Sheet } from '../../design-system';
import { SearchPicker } from '../../crud/SearchPicker';
import { formatDate } from '../adm/dates';
import { blankPauseForm, classLine, formFromPause, NOTE_MAX, PausesError, REASONS, studentOption, todayIndia, validatePauseForm, type Pause, type PauseForm, type PausesApi } from './pauses';

const CONTROL = 'w-full rounded-md border bg-surface px-3 text-base text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring';

/** Pause a student (choose the student) or change the expected date, reason and note of an active pause (the student and start are fixed). */
export function PauseSheet({ api, pause, canViewStudents, onClose, onSaved }: { api: PausesApi; pause?: Pause; canViewStudents: boolean; onClose: () => void; onSaved: (p: Pause, created: boolean) => void }) {
  const mode = pause ? 'edit' : 'create';
  const [form, setForm] = useState<PauseForm>(() => (pause ? formFromPause(pause) : blankPauseForm()));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');
  const [saving, setSaving] = useState(false);
  const reasonId = useId();
  const noteId = useId();
  const set = (patch: Partial<PauseForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      for (const k of Object.keys(patch)) delete next[k];
      return next;
    });
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFailure('');
    const found = validatePauseForm(form, mode);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setSaving(true);
    try {
      const saved = pause ? await api.update(pause.id, form) : await api.create(form);
      toast.success(pause ? 'Pause saved.' : 'Student paused.');
      onSaved(saved, !pause);
    } catch (err) {
      if (err instanceof PausesError && Object.keys(err.fields).length > 0) setErrors(err.fields);
      setFailure(err instanceof PausesError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const noteRequired = form.reason === 'other';
  const blocked = mode === 'create' && !canViewStudents;
  return (
    <Sheet open onClose={onClose} title={mode === 'create' ? 'Pause a student' : 'Edit pause'} description={mode === 'create' ? 'The student is marked paused until you mark them back.' : undefined}>
      <form onSubmit={(e) => void submit(e)} className="flex flex-1 flex-col gap-4" noValidate>
        {mode === 'create' ? (
          blocked ? (
            <div role="note" className="flex items-start gap-3 rounded-md border border-warning-line bg-warning-bg p-4 text-sm text-fg">
              <ShieldAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warning" />
              <p>You need permission to view students to look one up here. Ask your school administrator to give you that, then try again.</p>
            </div>
          ) : (
            <SearchPicker
              label="Student"
              required
              hint="Active students. Search by name or registration code."
              error={errors.studentId}
              value={form.studentId}
              onChange={(v) => set({ studentId: v })}
              search={async (q) => (await api.students(q)).map(studentOption)}
              describe={() => Promise.resolve(null)}
            />
          )
        ) : pause ? (
          <div className="rounded-md border border-line-subtle bg-canvas p-4 text-sm" data-testid="fixed-student">
            <p className="font-medium text-fg">
              {pause.student.name} <span className="font-normal text-fg-muted">({pause.student.registrationCode})</span>
            </p>
            <p className="text-fg-muted">
              {classLine(pause)}
              {pause.yearName ? ` · ${pause.yearName}` : ''} · paused from {formatDate(pause.pausedFrom)}
            </p>
            <p className="mt-1 text-xs text-fg-subtle">The student and the start date cannot be changed. To correct them, cancel this pause and record a new one.</p>
          </div>
        ) : null}

        {mode === 'create' ? <Input label="Paused from *" type="date" value={form.pausedFrom} max={todayIndia()} onChange={(e) => set({ pausedFrom: e.target.value })} error={errors.pausedFrom} /> : null}
        <Input label="Expected back" type="date" value={form.expectedBack} min={form.pausedFrom || undefined} onChange={(e) => set({ expectedBack: e.target.value })} error={errors.expectedBack} hint="Optional. Leave empty when nobody knows yet." />

        <div className="flex flex-col gap-1">
          <label htmlFor={reasonId} className="text-sm font-medium text-fg">
            Reason *
          </label>
          <select
            id={reasonId}
            className={`${CONTROL} h-10 ${errors.reason ? 'border-danger' : 'border-line'}`}
            value={form.reason}
            onChange={(e) => set({ reason: e.target.value as PauseForm['reason'] })}
            aria-invalid={errors.reason ? true : undefined}
            aria-describedby={errors.reason ? `${reasonId}-e` : undefined}
          >
            <option value="" disabled>
              Choose…
            </option>
            {REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          {errors.reason ? (
            <p id={`${reasonId}-e`} className="text-sm text-danger">
              {errors.reason}
            </p>
          ) : null}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor={noteId} className="text-sm font-medium text-fg">
            {noteRequired ? 'Note *' : 'Note'}
          </label>
          <textarea
            id={noteId}
            className={`${CONTROL} min-h-24 py-2 ${errors.reasonNote ? 'border-danger' : 'border-line'}`}
            value={form.reasonNote}
            maxLength={NOTE_MAX}
            onChange={(e) => set({ reasonNote: e.target.value })}
            aria-invalid={errors.reasonNote ? true : undefined}
            aria-describedby={`${noteId}-c${errors.reasonNote ? ` ${noteId}-e` : ''}`}
          />
          <div className="flex items-start justify-between gap-3 text-sm">
            <p id={`${noteId}-e`} className="text-danger">
              {errors.reasonNote ?? ''}
            </p>
            <p id={`${noteId}-c`} className="shrink-0 text-fg-subtle" data-testid="note-counter">
              {form.reasonNote.length}/{NOTE_MAX}
            </p>
          </div>
        </div>

        {mode === 'create' ? (
          <p className="flex items-start gap-2 text-sm text-fg-muted">
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            A student can have one active pause at a time. A student who has already left the school cannot be paused.
          </p>
        ) : null}

        {failure ? (
          <p role="alert" className="text-sm text-danger">
            {failure}
          </p>
        ) : null}
        <div className="sticky -bottom-8 -mx-8 -mb-8 mt-auto flex gap-2 border-t border-line-subtle bg-surface px-8 py-4">
          <Button type="submit" loading={saving} disabled={blocked}>
            {mode === 'create' ? 'Pause student' : 'Save'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
