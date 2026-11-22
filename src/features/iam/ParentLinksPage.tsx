import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, EyeOff, HeartHandshake, Inbox, Link2, Search, Unlink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Button, Card, ConfirmDialog, PageHeader, Sheet } from '../../design-system';
import { useAccessState } from '../../shell/AccessProvider';
import { useAuth } from '../../shell/AuthProvider';
import { API_BASE } from '../../shell/web-session';
import { ApiError, createCrudClient } from '../../crud/client';
import { SearchPicker, type PickerOption } from '../../crud/SearchPicker';

/** IAM-09 parent accounts (decision 0016): staff link a parent's sign-in account to a guardian already on the child's
 * file, and can stop one link giving access (custody) without removing the guardian. Backend:
 * api/openapi/modules/iam-parent-links.yaml. */

export interface ParentChild {
  linkId: string;
  studentId: string;
  studentName: string;
  registrationCode: string;
  relation: string;
  noAccess: boolean;
}

export interface ParentAccount {
  userId: string;
  username: string;
  displayName: string;
  status: 'invited' | 'active' | 'locked' | 'disabled';
  guardianId: string;
  guardianName: string | null;
  guardianPhone: string | null;
  children: ParentChild[];
}

const PAGE_SIZE = 25;

const STATUS_TONE: Record<ParentAccount['status'], string> = {
  invited: 'border-info-line bg-info-bg text-info',
  active: 'border-success-line bg-success-bg text-success',
  locked: 'border-warning-line bg-warning-bg text-warning',
  disabled: 'border-line bg-subtle text-fg-muted',
};

const RELATION: Record<string, string> = { father: 'Father', mother: 'Mother', guardian: 'Guardian', grandparent: 'Grandparent', sibling: 'Sibling', other: 'Other' };

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

export function ParentLinksPage() {
  const { session } = useAuth();
  const doFetch = useMemo<typeof fetch>(() => (...a) => session.fetch(...a), [session]);
  const users = useMemo(() => createCrudClient<{ id: string; displayName: string; username: string }, never>(session, API_BASE, '/users'), [session]);
  const guardians = useMemo(() => createCrudClient<{ id: string; name: string; phone: string }, never>(session, API_BASE, '/guardians'), [session]);
  const access = useAccessState();
  const can = (code: string) => access.phase === 'ready' && access.access.can(code);
  // linking needs both pickers: accounts (Users) and guardians (Students)
  const canLink = can('iam.parent_links.create') && can('iam.users.view') && can('stu.students.view');
  const canEdit = can('iam.parent_links.edit');
  const canUnlink = can('iam.parent_links.delete');
  const canInvite = can('iam.users.create');

  const [rows, setRows] = useState<ParentAccount[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState<ParentAccount | null>(null);
  const [stopping, setStopping] = useState<{ account: ParentAccount; child: ParentChild } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const q = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
      if (search.trim()) q.set('q', search.trim());
      const r = await call<{ items: ParentAccount[]; page: { total: number } }>(doFetch, 'GET', `/parent-links?${q.toString()}`);
      setRows(r.items);
      setTotal(r.page.total);
      setState('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setState('error');
    }
  }, [doFetch, page, search]);
  useEffect(() => {
    const t = setTimeout(() => void load(), search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const setAccess = async (child: ParentChild, noAccess: boolean) => {
    setBusy(true);
    try {
      await call(doFetch, 'PUT', `/parent-links/children/${child.linkId}/access`, { noAccess });
      setStopping(null);
      toast.success(noAccess ? `Access stopped: ${child.studentName}` : `Access allowed: ${child.studentName}`);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const userOption = (u: { id: string; displayName: string; username: string }): PickerOption => ({ value: u.id, label: `${u.displayName} (${u.username})` });
  const guardianOption = (g: { id: string; name: string; phone: string }): PickerOption => ({ value: g.id, label: `${g.name} · ${g.phone}` });
  const searchUsers = (q: string) => users.list({ page: 1, pageSize: 20, q, sort: 'displayName' }).then((r) => r.items.map(userOption));
  const describeUser = (id: string) => users.get(id).then(userOption, () => null);
  const searchGuardians = (q: string) => guardians.list({ page: 1, pageSize: 20, q, sort: 'name' }).then((r) => r.items.map(guardianOption));
  const describeGuardian = (id: string) => guardians.get(id).then(guardianOption, () => null);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const columns = canUnlink ? 4 : 3;

  return (
    <section className="space-y-4">
      <PageHeader
        title="Parent accounts"
        description="Link a parent's sign-in to a guardian on the child's file. They see only the children linked to that guardian."
        actions={
          canLink ? (
            <Button onClick={() => setLinking(true)}>
              <Link2 aria-hidden="true" className="size-4" />
              Link an account
            </Button>
          ) : undefined
        }
      />
      <div className="relative w-full max-w-sm">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
        <input
          type="search"
          aria-label="Search parent accounts"
          placeholder="Search by parent, phone or child"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="h-10 w-full rounded-md border border-line bg-surface pl-10 pr-3 text-sm text-fg shadow-soft placeholder:text-fg-subtle hover:border-line-strong focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle"
        />
      </div>

      {state === 'error' ? (
        <div role="alert" className="space-y-3 rounded-lg border border-danger-line bg-surface p-6 shadow-soft">
          <p className="text-fg">{error}</p>
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm" aria-busy={state === 'loading'}>
            <thead className="border-b border-line-subtle text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
              <tr>
                <th scope="col" className="px-5 py-3.5 font-semibold">Account</th>
                <th scope="col" className="hidden px-5 py-3.5 font-semibold md:table-cell">Guardian</th>
                <th scope="col" className="w-1/2 px-5 py-3.5 font-semibold">Children</th>
                {canUnlink ? <th scope="col" className="hidden px-5 py-3.5 text-right font-semibold md:table-cell">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {state === 'ready' && rows.length === 0 ? (
                <tr>
                  <td colSpan={columns} className="px-5 py-16 text-center text-fg-muted">
                    {search ? <Inbox aria-hidden="true" className="mx-auto mb-3 size-6 text-fg-subtle" /> : <HeartHandshake aria-hidden="true" className="mx-auto mb-3 size-6 text-fg-subtle" />}
                    {search ? 'No parent accounts match.' : 'No parent accounts yet.'}
                  </td>
                </tr>
              ) : null}
              {rows.map((a) => (
                <tr key={a.userId} className="border-b border-line-subtle align-top transition-colors last:border-0 hover:bg-canvas">
                  <td className="px-5 py-3.5">
                    <span className="block font-medium text-fg">{a.displayName}</span>
                    <span className="block text-xs text-fg-subtle">{a.username}</span>
                    <span className={`mt-1.5 inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize ${STATUS_TONE[a.status]}`}>
                      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                      {a.status}
                    </span>
                    {canUnlink ? (
                      <Button size="sm" variant="ghost" className="mt-2 -ml-2 flex hover:text-danger md:hidden" onClick={() => setUnlinking(a)}>
                        <Unlink aria-hidden="true" className="size-3.5" />
                        Unlink
                      </Button>
                    ) : null}
                  </td>
                  <td className="hidden px-5 py-3.5 md:table-cell">
                    {a.guardianName ? (
                      <>
                        <span className="block text-fg">{a.guardianName}</span>
                        <span className="block text-xs text-fg-subtle">{a.guardianPhone}</span>
                      </>
                    ) : (
                      <span className="text-fg-muted">Guardian record removed</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {a.children.length === 0 ? (
                      <span className="text-fg-muted">No children linked to this guardian</span>
                    ) : (
                      <ul className="divide-y divide-line-subtle">
                        {a.children.map((c) => (
                          <li key={c.linkId} className="flex items-start justify-between gap-3 py-2 first:pt-0.5 last:pb-0.5">
                            <div className="min-w-0">
                              <span className={`block font-medium ${c.noAccess ? 'text-fg-muted' : 'text-fg'}`}>{c.studentName}</span>
                              <span className="block text-xs text-fg-subtle">
                                {c.registrationCode} · {RELATION[c.relation] ?? c.relation}
                              </span>
                              {c.noAccess ? (
                                <span className="mt-1 inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-danger-line bg-danger-bg px-2 py-0.5 text-[11px] font-medium text-danger">
                                  <EyeOff aria-hidden="true" className="size-3" />
                                  No access
                                </span>
                              ) : null}
                            </div>
                            {canEdit ? (
                              c.noAccess ? (
                                <Button size="sm" variant="secondary" className="shrink-0 whitespace-nowrap" disabled={busy} aria-label={`Allow ${a.displayName} to see ${c.studentName}`} onClick={() => void setAccess(c, false)}>
                                  Allow access
                                </Button>
                              ) : (
                                <Button size="sm" variant="ghost" className="shrink-0 whitespace-nowrap hover:text-danger" disabled={busy} aria-label={`Stop ${a.displayName} seeing ${c.studentName}`} onClick={() => setStopping({ account: a, child: c })}>
                                  Stop access
                                </Button>
                              )
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                  {canUnlink ? (
                    <td className="hidden px-5 py-2.5 text-right md:table-cell">
                      <Button size="sm" variant="ghost" className="hover:text-danger" aria-label={`Unlink ${a.displayName}`} onClick={() => setUnlinking(a)}>
                        <Unlink aria-hidden="true" className="size-3.5" />
                      </Button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {total > PAGE_SIZE ? (
        <nav className="flex items-center justify-between text-sm text-fg-muted" aria-label="Pagination">
          <span>
            Page {page} of {pages} · {total} accounts
          </span>
          <span className="flex items-center gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page">
              <ChevronLeft aria-hidden="true" className="size-4" />
            </Button>
            <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Next page">
              <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
          </span>
        </nav>
      ) : null}

      {linking ? (
        <LinkSheet
          canInvite={canInvite}
          searchUsers={searchUsers}
          describeUser={describeUser}
          searchGuardians={searchGuardians}
          describeGuardian={describeGuardian}
          onClose={() => setLinking(false)}
          onSave={async (userId, guardianId) => {
            const acc = await call<ParentAccount>(doFetch, 'POST', '/parent-links', { userId, guardianId });
            setLinking(false);
            toast.success(`Linked: ${acc.displayName}`);
            void load();
          }}
        />
      ) : null}
      {stopping ? (
        <ConfirmDialog open title={`Stop ${stopping.account.displayName} seeing ${stopping.child.studentName}?`} onClose={() => setStopping(null)}>
          <p className="text-sm text-fg-muted">
            Use this when a court order or the family asks for it. {stopping.child.studentName} stays on the guardian&apos;s file, but this account no longer sees them, from its next request.
          </p>
          <div className="mt-5 flex gap-2">
            <Button variant="destructive" loading={busy} onClick={() => void setAccess(stopping.child, true)}>
              Stop access
            </Button>
            <Button variant="secondary" onClick={() => setStopping(null)}>
              Cancel
            </Button>
          </div>
        </ConfirmDialog>
      ) : null}
      {unlinking ? (
        <ConfirmDialog open title={`Unlink ${unlinking.displayName}?`} onClose={() => setUnlinking(null)}>
          <p className="text-sm text-fg-muted">The account stays and can still sign in, but it will not see any child. You can link it again later.</p>
          <div className="mt-5 flex gap-2">
            <Button
              variant="destructive"
              loading={busy}
              onClick={() => {
                setBusy(true);
                void call(doFetch, 'DELETE', `/parent-links/${unlinking.userId}`)
                  .then(() => {
                    setUnlinking(null);
                    toast.success('Unlinked');
                    void load();
                  })
                  .catch((e: unknown) => toast.error(e instanceof Error ? e.message : 'Something went wrong.'))
                  .finally(() => setBusy(false));
              }}
            >
              Unlink
            </Button>
            <Button variant="secondary" onClick={() => setUnlinking(null)}>
              Cancel
            </Button>
          </div>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}

function LinkSheet(p: {
  canInvite: boolean;
  searchUsers: (q: string) => Promise<PickerOption[]>;
  describeUser: (id: string) => Promise<PickerOption | null>;
  searchGuardians: (q: string) => Promise<PickerOption[]>;
  describeGuardian: (id: string) => Promise<PickerOption | null>;
  onClose: () => void;
  onSave: (userId: string, guardianId: string) => Promise<void>;
}) {
  const [userId, setUserId] = useState('');
  const [guardianId, setGuardianId] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const local: Record<string, string> = {};
    if (!userId) local.userId = 'Choose an account.';
    if (!guardianId) local.guardianId = 'Choose a guardian.';
    setErrors(local);
    if (Object.keys(local).length) return;
    setSaving(true);
    setFormError('');
    try {
      await p.onSave(userId, guardianId);
    } catch (e) {
      if (e instanceof ApiError && Object.keys(e.fields).length) setErrors(e.fields);
      else setFormError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet open title="Link a parent account" description="The account will see every child linked to this guardian, except links you mark No access." onClose={p.onClose}>
      <div className="flex flex-1 flex-col gap-4">
        <SearchPicker
          label="Account"
          required
          value={userId}
          onChange={setUserId}
          search={p.searchUsers}
          describe={p.describeUser}
          error={errors.userId}
          hint={p.canInvite ? undefined : 'The parent needs an account first. Ask someone who can add users.'}
        />
        {p.canInvite ? (
          <p className="-mt-2 text-xs text-fg-subtle">
            No account yet?{' '}
            <Link to="/users" className="font-medium text-accent hover:underline">
              Add the parent on Users
            </Link>{' '}
            and share their invite link, then come back.
          </p>
        ) : null}
        <SearchPicker label="Guardian" required value={guardianId} onChange={setGuardianId} search={p.searchGuardians} describe={p.describeGuardian} error={errors.guardianId} hint="Search by name or phone, as they are on the child's file." />
        {formError ? (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        ) : null}
        <div className="sticky -bottom-8 -mx-8 -mb-8 mt-auto flex gap-2 border-t border-line-subtle bg-surface px-8 py-4">
          <Button loading={saving} onClick={() => void save()}>
            Link
          </Button>
          <Button variant="secondary" onClick={p.onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
