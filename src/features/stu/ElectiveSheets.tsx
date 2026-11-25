import { useEffect, useId, useState } from 'react';
import { toast } from 'sonner';
import { Button, Input, Sheet } from '../../design-system';
import { ElectivesError, limitNote, REASON_MAX, toggleSubject, type ElectivesApi, type StudentElective, type StudentElectiveStatus } from './electives';
import { CONTROL } from './ElectiveParts';

const todayIndia = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

/** Change which subjects one student has chosen from a group. Opens by reading the choice, which says what the group offers. */
export function EditChoiceSheet({ api, choice, onClose, onSaved }: { api: ElectivesApi; choice: StudentElective; onClose: () => void; onSaved: () => void }) {
  const [full, setFull] = useState<StudentElective | null>(null);
  const [picked, setPicked] = useState<string[]>(choice.subjects.map((s) => s.id));
  const [status, setStatus] = useState<StudentElectiveStatus>(choice.status);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api.get(choice.id).then(setFull).catch((e: unknown) => setError(e instanceof Error ? e.message : 'The subjects could not be loaded.'));
  }, [api, choice.id]);
  const note = limitNote(choice.group, picked.length);
  const save = async () => {
    setBusy(true);
    setError('');
    try {
      await api.replace(choice.id, { subjectIds: picked, status });
      toast.success('Choice saved.');
      onSaved();
    } catch (e) {
      setError(e instanceof ElectivesError ? (e.fields.subjectIds ?? e.message) : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet open onClose={onClose} title="Edit elective choice" description={`${choice.student.name} · ${choice.group.name} · ${choice.yearName}`}>
      <div className="space-y-5">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-fg">Subjects</legend>
          {!full && !error ? <p className="text-sm text-fg-muted">Loading the subjects on offer…</p> : null}
          {full?.offered.map((s) => (
            <label key={s.id} className="flex min-h-10 items-center gap-3 text-sm text-fg">
              <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={picked.includes(s.id)} onChange={() => setPicked(toggleSubject(picked, s.id))} />
              {s.name}
            </label>
          ))}
          {note ? <p className="text-sm text-warning">{note}</p> : null}
        </fieldset>
        <div className="space-y-1">
          <label htmlFor="elective-status" className="text-sm font-medium text-fg">
            Status
          </label>
          <select id="elective-status" className={`${CONTROL} w-full`} value={status} onChange={(e) => setStatus(e.target.value as StudentElectiveStatus)}>
            <option value="chosen">Chosen</option>
            <option value="confirmed">Confirmed</option>
          </select>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button loading={busy} disabled={!full} onClick={() => void save()}>
            Save choice
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

/** Ask to swap one chosen subject for another. It goes to an approver; nothing changes until it is approved. */
export function RequestChangeSheet({ api, choice, onClose, onSaved }: { api: ElectivesApi; choice: StudentElective; onClose: () => void; onSaved: () => void }) {
  const [full, setFull] = useState<StudentElective | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [wantedFrom, setWantedFrom] = useState(todayIndia());
  const [reason, setReason] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const reasonId = useId();
  useEffect(() => {
    api.get(choice.id).then(setFull).catch(() => setErrors({ form: 'The subjects could not be loaded.' }));
  }, [api, choice.id]);
  const chosen = choice.subjects;
  const available = (full?.offered ?? []).filter((s) => !chosen.some((c) => c.id === s.id));
  const submit = async () => {
    const e: Record<string, string> = {};
    if (!from) e.fromSubjectId = 'Choose the subject to drop.';
    if (!to) e.toSubjectId = 'Choose the subject to take.';
    if (!reason.trim()) e.reason = 'Give a reason for the change.';
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await api.changeCreate({ choiceId: choice.id, fromSubjectId: from, toSubjectId: to, wantedFrom: wantedFrom || undefined, reason: reason.trim() });
      toast.success('Change requested. An approver will decide it.');
      onSaved();
    } catch (x) {
      setErrors(x instanceof ElectivesError ? { ...x.fields, form: x.message } : { form: 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  };
  const pick = (id: string, label: string, value: string, set: (v: string) => void, list: { id: string; name: string }[], err?: string) => (
    <div className="space-y-1">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
      </label>
      <select id={id} className={`${CONTROL} w-full`} value={value} onChange={(e) => set(e.target.value)} aria-invalid={Boolean(err)}>
        <option value="">Choose…</option>
        {list.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      {err ? <p className="text-sm text-danger">{err}</p> : null}
    </div>
  );
  return (
    <Sheet open onClose={onClose} title="Request a subject change" description={`${choice.student.name} · ${choice.group.name}. An approver decides; the choice stays as it is until then.`}>
      <div className="space-y-5">
        {pick('change-from', 'Drop', from, setFrom, chosen, errors.fromSubjectId)}
        {pick('change-to', 'Take instead', to, setTo, available, errors.toSubjectId)}
        {full && available.length === 0 ? <p className="text-sm text-fg-muted">The group offers no other subject to this class.</p> : null}
        <Input label="Wanted from" type="date" value={wantedFrom} onChange={(e) => setWantedFrom(e.target.value)} error={errors.wantedFrom} hint="Inside the academic year of the choice." />
        <div className="space-y-1">
          <label htmlFor={reasonId} className="text-sm font-medium text-fg">
            Reason *
          </label>
          <textarea id={reasonId} rows={3} maxLength={REASON_MAX} value={reason} onChange={(e) => setReason(e.target.value)} className={`${CONTROL} h-auto w-full py-2`} aria-invalid={Boolean(errors.reason)} />
          {errors.reason ? <p className="text-sm text-danger">{errors.reason}</p> : null}
        </div>
        {errors.form ? (
          <p role="alert" className="text-sm text-danger">
            {errors.form}
          </p>
        ) : null}
        <div className="flex gap-2">
          <Button loading={busy} disabled={!full} onClick={() => void submit()}>
            Send request
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
