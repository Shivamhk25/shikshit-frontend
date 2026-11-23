import { useId, useState, type FormEvent } from 'react';
import { Info, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Input, Sheet } from '../../design-system';
import { SearchPicker } from '../../crud/SearchPicker';
import { formatDate } from '../adm/dates';
import {
  blankTransferForm, classLine, DESTINATION_MAX, formFromTransfer, NOTE_MAX, REASONS, todayIndia, TransfersError, validateTransferForm,
  studentOption, type Transfer, type TransferForm, type TransfersApi,
} from './transfers';

const CONTROL = 'w-full rounded-md border bg-surface px-3 text-base text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring';

/** Request a transfer (choose the student) or change the details of one that is still open (the student is fixed). */
export function TransferSheet({ api, transfer, canViewStudents, onClose, onSaved }: { api: TransfersApi; transfer?: Transfer; canViewStudents: boolean; onClose: () => void; onSaved: (t: Transfer, created: boolean) => void }) {
  const mode = transfer ? 'edit' : 'create';
  const [form, setForm] = useState<TransferForm>(() => (transfer ? formFromTransfer(transfer) : blankTransferForm()));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState('');
  const [saving, setSaving] = useState(false);
  const reasonId = useId();
  const noteId = useId();
  const set = (patch: Partial<TransferForm>) => {
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
    const found = validateTransferForm(form, mode);
    if (Object.keys(found).length > 0) {
      setErrors(found);
      return;
    }
    setSaving(true);
    try {
      const saved = transfer ? await api.update(transfer.id, form) : await api.create(form);
      toast.success(transfer ? 'Transfer saved.' : 'Transfer requested. It now waits for approval.');
      onSaved(saved, !transfer);
    } catch (err) {
      if (err instanceof TransfersError && Object.keys(err.fields).length > 0) setErrors(err.fields);
      setFailure(err instanceof TransfersError ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const noteRequired = form.reason === 'other';
  const noteLength = form.reasonNote.length;
  const blocked = mode === 'create' && !canViewStudents;
  return (
    <Sheet open onClose={onClose} title={mode === 'create' ? 'Request a transfer' : 'Edit transfer'} description={mode === 'create' ? 'A request goes to an approver. The student stays enrolled until the transfer is completed.' : undefined}>
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
              hint="Active and paused students. Search by name or registration code."
              error={errors.studentId}
              value={form.studentId}
              onChange={(v) => set({ studentId: v })}
              search={async (q) => (await api.students(q)).map(studentOption)}
              describe={() => Promise.resolve(null)}
            />
          )
        ) : transfer ? (
          <div className="rounded-md border border-line-subtle bg-canvas p-4 text-sm" data-testid="fixed-student">
            <p className="font-medium text-fg">
              {transfer.student.name} <span className="font-normal text-fg-muted">({transfer.student.registrationCode})</span>
            </p>
            <p className="text-fg-muted">
              {classLine(transfer)}
              {transfer.yearName ? ` · ${transfer.yearName}` : ''} · requested on {formatDate(transfer.requestedOn)}
            </p>
            <p className="mt-1 text-xs text-fg-subtle">The student and the request date cannot be changed.</p>
          </div>
        ) : null}

        {mode === 'create' ? <Input label="Requested on *" type="date" value={form.requestedOn} max={todayIndia()} onChange={(e) => set({ requestedOn: e.target.value })} error={errors.requestedOn} /> : null}

        <div className="flex flex-col gap-1">
          <label htmlFor={reasonId} className="text-sm font-medium text-fg">
            Reason *
          </label>
          <select
            id={reasonId}
            className={`${CONTROL} h-10 ${errors.reason ? 'border-danger' : 'border-line'}`}
            value={form.reason}
            onChange={(e) => set({ reason: e.target.value as TransferForm['reason'] })}
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
              {noteLength}/{NOTE_MAX}
            </p>
          </div>
        </div>

        <Input label="Destination school" value={form.destinationSchool} maxLength={DESTINATION_MAX} onChange={(e) => set({ destinationSchool: e.target.value })} error={errors.destinationSchool} hint="Optional. The school the student is joining." />
        <Input label="Last day of attendance" type="date" value={form.lastAttendanceDate} max={todayIndia()} onChange={(e) => set({ lastAttendanceDate: e.target.value })} error={errors.lastAttendanceDate} hint="Optional. Printed on the transfer certificate." />

        {mode === 'create' ? (
          <p className="flex items-start gap-2 text-sm text-fg-muted">
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            Waiting for approval by someone else with transfer rights. You cannot approve your own request.
          </p>
        ) : null}

        {failure ? (
          <p role="alert" className="text-sm text-danger">
            {failure}
          </p>
        ) : null}
        <div className="sticky -bottom-8 -mx-8 -mb-8 mt-auto flex gap-2 border-t border-line-subtle bg-surface px-8 py-4">
          <Button type="submit" loading={saving} disabled={blocked}>
            {mode === 'create' ? 'Request transfer' : 'Save'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
