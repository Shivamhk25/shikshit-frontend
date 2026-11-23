import { useEffect, useId, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import { Button, Input, Sheet } from '../../design-system';
import { useAccessState } from '../../shell/AccessProvider';
import { blankAdmitForm, AdmissionsError, GENDER_CHOICES, studentHref, successMessage, type Admission, type AdmissionResult, type AdmissionsApi, type AdmitForm, type ClassSectionChoice } from './admissions';
import { formatDate } from './dates';

const SELECT = 'h-10 w-full rounded-md border bg-surface px-3 text-base text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring';

/** A labelled native select, with the error or hint tied to it for screen readers. */
export function SelectField({ label, value, onChange, options, error, hint, required, placeholder = 'Choose…' }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; error?: string; hint?: string; required?: boolean; placeholder?: string }) {
  const id = useId();
  const note = error ? `${id}-e` : hint ? `${id}-h` : undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {required ? `${label} *` : label}
      </label>
      <select id={id} className={`${SELECT} ${error ? 'border-danger' : 'border-line'}`} value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={error ? true : undefined} aria-describedby={note}>
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? (
        <p id={`${id}-e`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-h`} className="text-sm text-fg-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** The student code as a link to the Students screen when the person may open it, else as plain text. */
export function StudentLink({ code }: { code: string }) {
  const access = useAccessState();
  const allowed = access.phase === 'ready' && access.access.can('stu.students.view');
  if (!allowed) return <span className="font-medium text-fg">{code}</span>;
  return (
    <Link to={studentHref(code)} className="font-medium text-accent-fg underline underline-offset-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
      {code}
    </Link>
  );
}

/** What was created by an admission: the student code with a link, the enrolment, the guardians and anything to follow up. */
export function ResultPanel({ result, children }: { result: AdmissionResult; children?: ReactNode }) {
  const s = result.student;
  return (
    <div className="space-y-4" data-testid="admission-result">
      <div role="status" className="flex items-start gap-3 rounded-md border border-success-line bg-success-bg p-4 text-sm text-success">
        <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <p>{successMessage(result)}</p>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        <dt className="text-fg-subtle">Student code</dt>
        <dd>
          <StudentLink code={s.registrationCode} />
        </dd>
        <dt className="text-fg-subtle">Class</dt>
        <dd className="text-fg">{[s.className, s.sectionName].filter(Boolean).join(' · ') || '—'}</dd>
        <dt className="text-fg-subtle">Roll number</dt>
        <dd className="text-fg">{s.rollNumber || '—'}</dd>
        <dt className="text-fg-subtle">Academic year</dt>
        <dd className="text-fg">{result.yearName}</dd>
      </dl>
      {result.guardians.length > 0 ? (
        <div>
          <p className="text-sm font-medium text-fg">Guardians on the student’s file</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-fg-muted">
            {result.guardians.map((g) => (
              <li key={g.guardianId}>
                {g.name} · {g.relation}
                {g.isPrimary ? ' (primary)' : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {result.notes.length > 0 ? (
        <ul className="space-y-1 rounded-md border border-warning-line bg-warning-bg p-3 text-sm text-warning" aria-label="To follow up">
          {result.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}
      {children}
    </div>
  );
}

/**
 * The side sheet that admits one accepted registration. The section list holds only the sections of the registration's
 * class in its year. Field errors from the server show under the field they belong to; a possible duplicate asks first.
 */
export function AdmitSheet({ api, row, sections, onClose, onAdmitted, canCreate }: { api: AdmissionsApi; row: Admission | null; sections: ClassSectionChoice[] | undefined; onClose: () => void; onAdmitted: (r: AdmissionResult) => void; canCreate: boolean }) {
  const [form, setForm] = useState<AdmitForm>(blankAdmitForm());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [duplicate, setDuplicate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<AdmissionResult | null>(null);

  useEffect(() => {
    setForm(blankAdmitForm(row ?? undefined));
    setErrors({});
    setFormError('');
    setDuplicate(false);
    setResult(null);
  }, [row]);

  const set = (patch: Partial<AdmitForm>) => {
    setForm((f) => ({ ...f, ...patch }));
    setDuplicate(false);
  };

  // A section noted on the registration is only a suggestion: it is pre-selected when it is a valid choice.
  useEffect(() => {
    if (sections && row && form.sectionId && !sections.some((s) => s.sectionId === form.sectionId)) setForm((f) => ({ ...f, sectionId: '' }));
  }, [sections, row, form.sectionId]);

  if (!row) return null;
  const needsGender = !row.gender;

  const submit = async (confirmDuplicate: boolean) => {
    const next = { ...form, confirmDuplicate };
    setBusy(true);
    setErrors({});
    setFormError('');
    try {
      const r = await api.admit(row.id, next);
      setResult(r);
      setDuplicate(false);
      onAdmitted(r);
    } catch (e) {
      if (e instanceof AdmissionsError) {
        if (e.needsDuplicateConfirmation) {
          setDuplicate(true);
          setFormError(e.fields.confirmDuplicate?.message ?? '');
        } else {
          setErrors(e.fieldMessages);
          if (Object.keys(e.fieldMessages).length === 0) setFormError(e.message);
        }
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  };

  const sectionOptions = (sections ?? []).map((s) => ({ value: s.sectionId, label: s.sectionName }));
  const body = row.admitted ? (
    <div className="space-y-3 text-sm text-fg-muted">
      <p>
        This registration was admitted{row.admittedAt ? ` on ${formatDate(row.admittedAt)}` : ''}
        {row.studentCode ? ' as ' : '.'}
        {row.studentCode ? <StudentLink code={row.studentCode} /> : null}
      </p>
    </div>
  ) : result ? (
    <ResultPanel result={result}>
      <Button variant="secondary" onClick={onClose}>
        Done
      </Button>
    </ResultPanel>
  ) : (
    <form
      className="flex flex-col gap-4"
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        if (canCreate) void submit(false);
      }}
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md border border-line-subtle bg-canvas p-3 text-sm">
        <dt className="text-fg-subtle">Class</dt>
        <dd className="text-fg">
          {row.className} · {row.yearName}
        </dd>
        <dt className="text-fg-subtle">Born</dt>
        <dd className="text-fg">{formatDate(row.dateOfBirth)}</dd>
        <dt className="text-fg-subtle">Guardian</dt>
        <dd className="text-fg">{[row.guardianName || row.fatherName || row.motherName, row.guardianPhone].filter(Boolean).join(' · ')}</dd>
      </dl>
      {formError ? (
        <p role="alert" className="rounded-md border border-danger-line bg-danger-bg p-3 text-sm text-danger">
          {formError}
        </p>
      ) : null}
      <SelectField
        label="Section"
        required
        value={form.sectionId}
        onChange={(v) => set({ sectionId: v })}
        options={sectionOptions}
        error={errors.sectionId}
        hint={sections && sections.length === 0 ? `No sections are set up for ${row.className} in ${row.yearName}.` : row.sectionName ? `The registration notes ${row.sectionName}.` : undefined}
      />
      <Input label="Roll number" value={form.rollNumber} maxLength={20} onChange={(e) => set({ rollNumber: e.target.value })} error={errors.rollNumber} hint="Blank = next number in the section." />
      <Input label="Student code" value={form.studentCode} maxLength={30} onChange={(e) => set({ studentCode: e.target.value })} error={errors.studentCode} hint="Blank = automatic." />
      {needsGender ? <SelectField label="Gender" required value={form.gender} onChange={(v) => set({ gender: v })} options={GENDER_CHOICES} error={errors.gender} hint="The registration has no gender yet." /> : null}
      <Input label="Admission date" type="date" value={form.admissionDate} onChange={(e) => set({ admissionDate: e.target.value })} error={errors.admissionDate} hint="Blank = today." />
      <Input label="Parent email" type="email" value={form.parentEmail} maxLength={254} onChange={(e) => set({ parentEmail: e.target.value })} error={errors.parentEmail} />
      {duplicate ? (
        <div role="alert" className="space-y-3 rounded-md border border-warning-line bg-warning-bg p-4 text-sm text-warning" data-testid="duplicate-confirm">
          <p className="flex items-start gap-2">
            <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>A student with the same name and date of birth is already on the roll. Admit this one as well?</span>
          </p>
          <div className="flex gap-2">
            <Button type="button" size="sm" disabled={busy} onClick={() => void submit(true)}>
              Admit anyway
            </Button>
            <Button type="button" size="sm" variant="secondary" onClick={() => setDuplicate(false)}>
              Go back
            </Button>
          </div>
        </div>
      ) : null}
      {canCreate ? (
        <div className="flex gap-2">
          <Button type="submit" disabled={busy || duplicate}>
            {busy ? 'Admitting…' : 'Admit student'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      ) : null}
    </form>
  );

  return (
    <Sheet open onClose={onClose} title={`Admit ${row.fullName}`} description={`${row.applicationNumber} · ${row.className}`}>
      {body}
    </Sheet>
  );
}
