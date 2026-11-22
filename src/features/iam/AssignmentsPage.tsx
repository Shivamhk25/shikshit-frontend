import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, ConfirmDialog, PageHeader, Sheet } from '../../design-system';
import { useAccessState } from '../../shell/AccessProvider';
import { useAuth } from '../../shell/AuthProvider';
import { API_BASE } from '../../shell/web-session';
import { ApiError, createCrudClient } from '../../crud/client';
import { SearchPicker, type PickerOption } from '../../crud/SearchPicker';

/** IAM-03 class assignments: which class sections each teacher looks after. A teacher's class-section permissions
 * reach only these; removing one takes effect on their next request. Backend: api/openapi/modules/iam.yaml. */

export interface Assignment {
  id: string;
  userId: string;
  userName: string;
  scopeType: 'class_section';
  scopeRef: string;
  label: string;
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
}

type Problem = { code?: string; detail?: string; errors?: { field: string; message: string }[] };

async function call<T>(doFetch: typeof fetch, method: string, path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await doFetch(`${API_BASE}${path}`, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'network', {}, 'Cannot reach the server. Check your connection.');
  }
  if (!res.ok) {
    let p: Problem = {};
    try {
      p = (await res.json()) as Problem;
    } catch {
      /* not JSON */
    }
    const fields: Record<string, string> = {};
    for (const e of p.errors ?? []) fields[e.field] ??= e.message;
    throw new ApiError(res.status, p.code ?? 'error', fields, p.detail ?? 'Something went wrong. Please try again.');
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

export function AssignmentsPage() {
  const { session } = useAuth();
  const doFetch = useMemo<typeof fetch>(() => (...a) => session.fetch(...a), [session]);
  const users = useMemo(() => createCrudClient<{ id: string; displayName: string; username: string }, never>(session, API_BASE, '/users'), [session]);
  const sections = useMemo(() => createCrudClient<{ id: string; className: string; sectionName: string; yearName: string }, never>(session, API_BASE, '/class-section-mappings'), [session]);
  const access = useAccessState();
  const canEdit = access.phase === 'ready' && access.access.can('iam.scope_assignments.edit');
  const canSeeUsers = access.phase === 'ready' && access.access.can('iam.users.view');

  const [items, setItems] = useState<Assignment[] | null>(null);
  const [error, setError] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<Assignment | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const q = userFilter ? `?userId=${encodeURIComponent(userFilter)}` : '';
      setItems((await call<{ items: Assignment[] }>(doFetch, 'GET', `/scope-assignments${q}`)).items);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  }, [doFetch, userFilter]);
  useEffect(() => void load(), [load]);

  const userOption = (u: { id: string; displayName: string; username: string }): PickerOption => ({ value: u.id, label: `${u.displayName} (${u.username})` });
  const sectionOption = (s: { id: string; className: string; sectionName: string; yearName: string }): PickerOption => ({ value: s.id, label: `${s.className} ${s.sectionName} (${s.yearName})` });
  const searchUsers = (q: string) => users.list({ page: 1, pageSize: 20, q, sort: 'displayName', filters: { status: 'active' } }).then((r) => r.items.map(userOption));
  const describeUser = (id: string) => users.get(id).then(userOption, () => null);
  const searchSections = (q: string) => sections.list({ page: 1, pageSize: 20, q, sort: 'className,sectionName' }).then((r) => r.items.map(sectionOption));
  const describeSection = (id: string) => sections.get(id).then(sectionOption, () => null);

  return (
    <section className="space-y-4">
      <PageHeader
        title="Class assignments"
        description="Which class sections each teacher looks after. A teacher sees students only in the sections assigned here."
        actions={
          canEdit && canSeeUsers ? (
            <Button onClick={() => setAdding(true)}>
              <Plus aria-hidden="true" className="size-4" />
              Assign
            </Button>
          ) : undefined
        }
      />
      {canSeeUsers ? (
        <div className="max-w-sm">
          <SearchPicker label="Show one person" value={userFilter} onChange={setUserFilter} search={searchUsers} describe={describeUser} />
        </div>
      ) : null}
      {error ? (
        <div role="alert" className="space-y-3 rounded-lg border border-danger-line bg-surface p-6 shadow-soft">
          <p className="text-fg">{error}</p>
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm" aria-busy={items === null}>
            <thead className="border-b border-line-subtle text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
              <tr>
                <th scope="col" className="px-5 py-3.5 font-semibold">Person</th>
                <th scope="col" className="px-5 py-3.5 font-semibold">Class section</th>
                <th scope="col" className="hidden px-5 py-3.5 font-semibold md:table-cell">From</th>
                <th scope="col" className="hidden px-5 py-3.5 font-semibold md:table-cell">Until</th>
                {canEdit ? <th scope="col" className="px-5 py-3.5 text-right font-semibold">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {items && items.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 5 : 4} className="px-5 py-16 text-center text-fg-muted">
                    <UserCheck aria-hidden="true" className="mx-auto mb-3 size-6 text-fg-subtle" />
                    {userFilter ? 'No class sections assigned to this person.' : 'No assignments yet.'}
                  </td>
                </tr>
              ) : null}
              {(items ?? []).map((a) => (
                <tr key={a.id} className="border-b border-line-subtle last:border-0 hover:bg-canvas">
                  <td className="px-5 py-3.5 font-medium text-fg">{a.userName}</td>
                  <td className="px-5 py-3.5 text-fg-muted">{a.label}</td>
                  <td className="hidden px-5 py-3.5 text-fg-muted md:table-cell">{day(a.startsAt)}</td>
                  <td className="hidden px-5 py-3.5 text-fg-muted md:table-cell">{a.endsAt ? day(a.endsAt) : 'No end'}</td>
                  {canEdit ? (
                    <td className="px-5 py-2.5 text-right">
                      <Button size="sm" variant="ghost" className="hover:text-danger" aria-label={`Remove ${a.label} from ${a.userName}`} onClick={() => setRemoving(a)}>
                        <Trash2 aria-hidden="true" className="size-3.5" />
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {adding ? (
        <AssignSheet
          initialUser={userFilter}
          searchUsers={searchUsers}
          describeUser={describeUser}
          searchSections={searchSections}
          describeSection={describeSection}
          onClose={() => setAdding(false)}
          onSave={async (userId, sectionId) => {
            await call(doFetch, 'POST', '/scope-assignments', { userId, scopeType: 'class_section', scopeRef: sectionId });
            setAdding(false);
            toast.success('Assigned');
            void load();
          }}
        />
      ) : null}
      {removing ? (
        <ConfirmDialog open title="Remove this assignment?" onClose={() => setRemoving(null)}>
          <p className="text-sm text-fg-muted">
            {removing.userName} will no longer see students in {removing.label}. This takes effect on their next request.
          </p>
          <div className="mt-5 flex gap-2">
            <Button
              variant="destructive"
              onClick={() =>
                void call(doFetch, 'DELETE', `/scope-assignments/${removing.id}`)
                  .then(() => {
                    setRemoving(null);
                    toast.success('Removed');
                    void load();
                  })
                  .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Something went wrong.'))
              }
            >
              Remove
            </Button>
            <Button variant="secondary" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
          </div>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}

function AssignSheet(p: {
  initialUser: string;
  searchUsers: (q: string) => Promise<PickerOption[]>;
  describeUser: (id: string) => Promise<PickerOption | null>;
  searchSections: (q: string) => Promise<PickerOption[]>;
  describeSection: (id: string) => Promise<PickerOption | null>;
  onClose: () => void;
  onSave: (userId: string, sectionId: string) => Promise<void>;
}) {
  const [userId, setUserId] = useState(p.initialUser);
  const [sectionId, setSectionId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const local: Record<string, string> = {};
    if (!userId) local.userId = 'Choose a person.';
    if (!sectionId) local.scopeRef = 'Choose a class section.';
    setErrors(local);
    if (Object.keys(local).length) return;
    setSaving(true);
    setFormError('');
    try {
      await p.onSave(userId, sectionId);
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length) setErrors(e.fields);
      else setFormError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet open title="Assign a class section" description="The person's class-section permissions will reach this section's students." onClose={p.onClose}>
      <div className="flex flex-1 flex-col gap-4">
        <SearchPicker label="Person" required value={userId} onChange={setUserId} search={p.searchUsers} describe={p.describeUser} error={errors.userId} />
        <SearchPicker label="Class section" required value={sectionId} onChange={setSectionId} search={p.searchSections} describe={p.describeSection} error={errors.scopeRef} hint="Class sections of every academic year are listed; pick this year's." />
        {formError ? (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        ) : null}
        <div className="sticky -bottom-8 -mx-8 -mb-8 mt-auto flex gap-2 border-t border-line-subtle bg-surface px-8 py-4">
          <Button loading={saving} onClick={() => void save()}>
            Assign
          </Button>
          <Button variant="secondary" onClick={p.onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
