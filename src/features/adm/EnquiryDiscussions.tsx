import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { MessageSquarePlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Sheet } from '../../design-system';
import { FieldControl } from '../../crud/CrudPage';
import { ApiError, createCrudClient } from '../../crud/client';
import { blankValues, type FormValues } from '../../crud/descriptor';
import { useAccessState } from '../../shell/AccessProvider';
import { useAuth } from '../../shell/AuthProvider';
import { API_BASE } from '../../shell/web-session';
import { formatDate, formatDateTime } from './dates';
import { channelLabel, discussionFields, discussionInput, languageLabel, outcomeLabel, type Discussion } from './discussions';

const SHOWN = 20;
const fields = discussionFields.filter((f) => f.key !== 'enquiryId');

/**
 * The follow-up notes of one enquiry, newest first, with a "Log a contact" button (ADM-04). It sits in the enquiry's edit
 * sheet. `onFollowUpDate` is told when a saved note moved the enquiry's own follow-up date, so the open form does not
 * save the old date back over it.
 */
export function EnquiryDiscussions({ enquiryId, onFollowUpDate }: { enquiryId: string; onFollowUpDate: (date: string) => void }) {
  const { session } = useAuth();
  const access = useAccessState();
  const can = (code: string) => access.phase === 'ready' && access.access.can(code);
  const client = useMemo(() => createCrudClient<Discussion, Record<string, unknown>>(session, API_BASE, '/enquiry-discussions'), [session]);
  const [items, setItems] = useState<Discussion[]>([]);
  const [total, setTotal] = useState(0);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [logging, setLogging] = useState(false);
  const canView = can('adm.enquiry_discussions.view');
  const canCreate = can('adm.enquiry_discussions.create');

  const load = useCallback(async () => {
    try {
      const r = await client.list({ page: 1, pageSize: SHOWN, sort: '-contactedAt', filters: { enquiryId } });
      setItems(r.items);
      setTotal(r.total);
      setState('ready');
    } catch {
      setState('error');
    }
  }, [client, enquiryId]);

  useEffect(() => {
    if (canView) void load();
  }, [canView, load]);

  if (!canView) return null;
  return (
    <section aria-labelledby="enquiry-notes-title" className="space-y-3 rounded-lg border border-line-subtle bg-canvas p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 id="enquiry-notes-title" className="text-sm font-semibold text-fg">
          Follow-up notes
        </h3>
        {canCreate ? (
          <Button type="button" size="sm" variant="secondary" onClick={() => setLogging(true)}>
            <MessageSquarePlus aria-hidden="true" className="size-4" />
            Log a contact
          </Button>
        ) : null}
      </div>
      {state === 'loading' ? <p className="text-sm text-fg-muted">Loading…</p> : null}
      {state === 'error' ? (
        <p role="alert" className="text-sm text-danger">
          The notes could not be loaded.{' '}
          <button type="button" className="underline" onClick={() => void load()}>
            Try again
          </button>
        </p>
      ) : null}
      {state === 'ready' && items.length === 0 ? <p className="text-sm text-fg-muted">No contact has been logged yet.</p> : null}
      {items.length > 0 ? (
        <ol className="space-y-3">
          {items.map((d) => (
            <li key={d.id} className="border-l-2 border-accent pl-3 text-sm">
              <p className="font-medium text-fg">{formatDateTime(d.contactedAt)}</p>
              <p className="text-fg-muted">
                {channelLabel(d.channel)} · {languageLabel(d.language)} · {outcomeLabel(d.outcome)}
              </p>
              <p className="mt-1 text-fg">{d.summary}</p>
              {d.notes ? <p className="mt-1 whitespace-pre-line text-fg-muted">{d.notes}</p> : null}
              <p className="mt-1 text-xs text-fg-subtle">
                {d.nextFollowUpDate ? `Contact again on ${formatDate(d.nextFollowUpDate)} · ` : ''}
                {d.loggedByName ? `Logged by ${d.loggedByName}` : ''}
              </p>
            </li>
          ))}
        </ol>
      ) : null}
      {total > items.length ? <p className="text-xs text-fg-muted">Showing the latest {items.length} of {total}. The rest are on the Enquiry discussions page.</p> : null}
      {logging ? (
        <LogContact
          enquiryId={enquiryId}
          onClose={() => setLogging(false)}
          onSaved={(next) => {
            setLogging(false);
            if (next) onFollowUpDate(next);
            void load();
          }}
        />
      ) : null}
    </section>
  );
}

/** The side sheet that adds one note to the enquiry. */
function LogContact({ enquiryId, onClose, onSaved }: { enquiryId: string; onClose: () => void; onSaved: (movedFollowUpTo: string | null) => void }) {
  const { session } = useAuth();
  const client = useMemo(() => createCrudClient<Discussion, Record<string, unknown>>(session, API_BASE, '/enquiry-discussions'), [session]);
  const [values, setValues] = useState<FormValues>(() => blankValues(fields));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async (e: FormEvent) => {
    // this form is inside the enquiry's form in the component tree: its submit must not save the enquiry
    e.preventDefault();
    e.stopPropagation();
    setSaving(true);
    setErrors({});
    setFormError('');
    try {
      const body = discussionInput({ ...values, enquiryId });
      await client.create(body);
      toast.success('Contact logged.');
      onSaved(body.updateEnquiryFollowUp === true ? String(body.nextFollowUpDate) : null);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length > 0) setErrors(err.fields);
      else setFormError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open title="Log a contact" description="Add a note about a call, visit or message with this family." onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="flex flex-1 flex-col gap-4" noValidate>
        {fields.map((f) => (
          <FieldControl key={f.key} field={f} value={values[f.key] ?? ''} error={errors[f.key]} onChange={(v) => setValues({ ...values, [f.key]: v })} />
        ))}
        {errors.enquiryId ? (
          <p role="alert" className="text-sm text-danger">
            {errors.enquiryId}
          </p>
        ) : null}
        {formError ? (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        ) : null}
        <div className="sticky -bottom-8 -mx-8 -mb-8 mt-auto flex gap-2 border-t border-line-subtle bg-surface px-8 py-4">
          <Button type="submit" loading={saving}>
            Save contact
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

