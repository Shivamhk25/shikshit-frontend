import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, ChevronLeft, ChevronRight, Copy, Inbox, Pencil, Plus, Search, ShieldCheck, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, ConfirmDialog, Input, PageHeader, Sheet } from '../../design-system';
import { useAccessState } from '../../shell/AccessProvider';
import { useAuth } from '../../shell/AuthProvider';
import { API_BASE } from '../../shell/web-session';
import { ApiError } from '../../crud/client';
import { createRolesApi, type Role, type RolesApi } from './rolesApi';
import { ACTIONS_BY_STATUS, absoluteLink, createUsersApi, isTemporarilyLocked, type User, type UserAction, type UserStatus, type UsersApi } from './usersApi';

const PAGE_SIZE = 25;

const STATUS: Record<UserStatus, { label: string; tone: string }> = {
  invited: { label: 'Invited', tone: 'border-info-line bg-info-bg text-info' },
  active: { label: 'Active', tone: 'border-success-line bg-success-bg text-success' },
  locked: { label: 'Locked', tone: 'border-warning-line bg-warning-bg text-warning' },
  disabled: { label: 'Disabled', tone: 'border-line bg-subtle text-fg-muted' },
};

const ACTION: Record<UserAction, { label: string; done: string; confirm?: string }> = {
  'reset-password': { label: 'Reset password', done: 'New password link ready' },
  lock: { label: 'Lock', done: 'Locked', confirm: 'They are signed out everywhere and cannot sign in until someone unlocks them.' },
  unlock: { label: 'Unlock', done: 'Unlocked' },
  deactivate: { label: 'Disable', done: 'Disabled', confirm: 'They are signed out everywhere and lose access to the school until reactivated.' },
  reactivate: { label: 'Reactivate', done: 'Reactivated' },
  'reset-mfa': { label: 'Reset two-step', done: 'Two-step sign-in reset', confirm: 'Use this when they lost their phone. Their authenticator and recovery codes stop working and they are signed out everywhere. Administrators set it up again at their next sign-in.' },
};

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never');

function StatusBadge({ user }: { user: User }) {
  const s = STATUS[user.status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.tone}`}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {isTemporarilyLocked(user) ? 'Locked for now' : s.label}
    </span>
  );
}

type OneTimeLink = { user: User; url: string; kind: 'invite' | 'reset'; emailedTo?: string };

/** The address a one-time link was emailed to, when the server queued it (FND-19). */
function emailedTo(u: User, queued?: boolean): string | undefined {
  return queued && u.email ? u.email : undefined;
}

/** Shows a one-time link with a copy button. The server never shows the link again, so the page says so. */
function LinkDialog({ link, onClose }: { link: OneTimeLink; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
    } catch {
      toast.error('Copy did not work. Select the link and copy it.');
    }
  };
  return (
    <ConfirmDialog open title={link.kind === 'invite' ? 'Invite link' : 'New password link'} onClose={onClose} className="max-w-lg">
      <p className="text-sm text-fg-muted">
        {link.emailedTo ? (
          <>
            We emailed this link to <span className="font-medium text-fg">{link.emailedTo}</span>. You can also copy it here.{' '}
          </>
        ) : (
          <>
            Send this link to <span className="font-medium text-fg">{link.user.displayName}</span>.{' '}
          </>
        )}
        It works once and expires in {link.kind === 'invite' ? '7 days' : '24 hours'}. It is not shown again.
      </p>
      <p className="break-all rounded-md border border-line-subtle bg-canvas p-3 font-mono text-xs text-fg" data-testid="one-time-link">
        {link.url}
      </p>
      <div className="flex gap-2">
        <Button onClick={() => void copy()}>
          {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
          {copied ? 'Copied' : 'Copy link'}
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Done
        </Button>
      </div>
    </ConfirmDialog>
  );
}

type Editing = { mode: 'create' } | { mode: 'edit'; user: User };

function UserForm({ editing, api, onSaved, onClose }: { editing: Editing; api: UsersApi; onSaved: (u: User, inviteLink?: string, emailQueued?: boolean) => void; onClose: () => void }) {
  const start = editing.mode === 'edit' ? editing.user : null;
  const [v, setV] = useState({ username: start?.username ?? '', displayName: start?.displayName ?? '', email: start?.email ?? '', phone: start?.phone ?? '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const orNull = (s: string) => (s.trim() ? s.trim() : null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const local: Record<string, string> = {};
    if (editing.mode === 'create' && v.username.trim().length < 3) local.username = 'A username has 3 to 64 characters.';
    if (!v.displayName.trim()) local.displayName = 'Enter a display name.';
    setErrors(local);
    if (Object.keys(local).length) return;
    setSaving(true);
    setFormError(null);
    try {
      if (editing.mode === 'create') {
        const u = await api.create({ username: v.username.trim(), displayName: v.displayName.trim(), email: orNull(v.email), phone: orNull(v.phone) });
        onSaved(u, u.inviteLink, u.emailQueued);
      } else {
        onSaved(await api.update(editing.user.id, { displayName: v.displayName.trim(), email: orNull(v.email), phone: orNull(v.phone) }));
      }
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) setErrors(err.fields);
      else setFormError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open title={editing.mode === 'create' ? 'Add user' : 'Edit user'} description={editing.mode === 'create' ? 'They get a link to set their own password. Give them roles from the shield button in the list.' : undefined} onClose={onClose}>
      <form onSubmit={(e) => void submit(e)} className="flex flex-1 flex-col gap-4" noValidate>
        {editing.mode === 'create' ? (
          <Input label="Username" required autoComplete="off" value={v.username} error={errors.username} hint="Used to sign in. It cannot be changed later." onChange={(e) => setV({ ...v, username: e.target.value })} />
        ) : (
          <p className="text-sm text-fg-muted">
            Username <span className="font-medium text-fg">{editing.user.username}</span>
          </p>
        )}
        <Input label="Display name" required value={v.displayName} error={errors.displayName} onChange={(e) => setV({ ...v, displayName: e.target.value })} />
        <Input label="Email" type="email" value={v.email} error={errors.email} onChange={(e) => setV({ ...v, email: e.target.value })} />
        <Input label="Phone" type="tel" value={v.phone} error={errors.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
        {formError ? (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        ) : null}
        <div className="sticky -bottom-8 -mx-8 -mb-8 mt-auto flex gap-2 border-t border-line-subtle bg-surface px-8 py-4">
          <Button type="submit" loading={saving}>
            {editing.mode === 'create' ? 'Add and get invite link' : 'Save'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

/** Gives a user their roles. The server refuses roles wider than the caller's own access and keeps the last Admin. */
function RolesSheet({ user, api, onClose }: { user: User; api: RolesApi; onClose: () => void }) {
  const [all, setAll] = useState<Role[] | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let live = true;
    Promise.all([api.list(), api.userRoles(user.id)])
      .then(([roles, held]) => {
        if (!live) return;
        setAll(roles);
        setChosen(new Set(held.map((r) => r.id)));
      })
      .catch((err: unknown) => live && setError(err instanceof Error ? err.message : 'Something went wrong.'));
    return () => {
      live = false;
    };
  }, [api, user.id]);
  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await api.setUserRoles(user.id, [...chosen]);
      toast.success(`Roles saved for ${user.displayName}`);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet open title={`Roles of ${user.displayName}`} description="Their access changes the next time their app talks to the school." onClose={onClose}>
      {!all && !error ? (
        <p role="status" className="text-sm text-fg-muted">
          Loading roles…
        </p>
      ) : null}
      {all ? (
        <fieldset className="flex flex-col gap-1">
          <legend className="sr-only">Roles</legend>
          {all.map((r) => (
            <label key={r.id} className="flex cursor-pointer items-start gap-3 rounded-md px-3 py-2.5 hover:bg-canvas">
              <input type="checkbox" className="mt-0.5 size-4 accent-accent" checked={chosen.has(r.id)} onChange={() => { const next = new Set(chosen); if (next.has(r.id)) next.delete(r.id); else next.add(r.id); setChosen(next); }} />
              <span>
                <span className="block text-sm font-medium text-fg">{r.name}</span>
                <span className="block text-xs text-fg-muted">{r.description ?? `${r.permissionCount} permissions`}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="sticky -bottom-8 -mx-8 -mb-8 mt-auto flex gap-2 border-t border-line-subtle bg-surface px-8 py-4">
        <Button loading={saving} disabled={!all} onClick={() => void save()}>
          Save roles
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </Sheet>
  );
}

/** IAM-01: the people who can sign in to this school, and (IAM-02) the roles each holds. */
export function UsersPage({ api: injected, rolesApi: injectedRoles }: { api?: UsersApi; rolesApi?: RolesApi }) {
  const { session } = useAuth();
  const api = useMemo(() => injected ?? createUsersApi(session, API_BASE), [injected, session]);
  const rolesApi = useMemo(() => injectedRoles ?? createRolesApi(session, API_BASE), [injectedRoles, session]);
  const [rolesFor, setRolesFor] = useState<User | null>(null);
  const access = useAccessState();
  const can = (code: string) => access.phase === 'ready' && access.access.can(code);
  const canCreate = can('iam.users.create');
  const canEdit = can('iam.users.edit');
  const canGiveRoles = canEdit && can('iam.roles.view');
  const me = access.phase === 'ready' ? access.payload.user.id : undefined;

  const [rows, setRows] = useState<User[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Editing | null>(null);
  const [link, setLink] = useState<OneTimeLink | null>(null);
  const [confirming, setConfirming] = useState<{ user: User; action: UserAction } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const r = await api.list({ page, pageSize: PAGE_SIZE, sort: 'displayName', q: search.trim() || undefined, filters: { status } });
      setRows(r.items);
      setTotal(r.total);
      setState('ready');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setState('error');
    }
  }, [api, page, search, status]);

  useEffect(() => {
    const t = setTimeout(() => void load(), search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const run = async (user: User, action: UserAction) => {
    setBusy(true);
    try {
      const u = await api.act(user.id, action);
      setConfirming(null);
      if (u.resetLink) setLink({ user: u, url: absoluteLink(u.resetLink), kind: 'reset', emailedTo: emailedTo(u, u.emailQueued) });
      else toast.success(`${ACTION[action].done}: ${u.displayName}`);
      void load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const actionsFor = (u: User): UserAction[] => {
    const list = isTemporarilyLocked(u) ? ['unlock' as UserAction, ...ACTIONS_BY_STATUS[u.status]] : ACTIONS_BY_STATUS[u.status];
    const withMfa: UserAction[] = u.mfaEnabled ? [...list, 'reset-mfa'] : list;
    return u.id === me ? withMfa.filter((a) => a !== 'lock' && a !== 'deactivate' && a !== 'reset-mfa') : withMfa;
  };
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="space-y-4">
      <PageHeader
        title="Users"
        description="Everyone who can sign in to your school. New users get a link to set their own password."
        actions={
          canCreate ? (
            <Button onClick={() => setEditing({ mode: 'create' })}>
              <Plus aria-hidden="true" className="size-4" />
              Add user
            </Button>
          ) : undefined
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <input type="search" aria-label="Search users" placeholder="Search by name, username or email" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="h-10 w-full rounded-md border border-line bg-surface pl-10 pr-3 text-sm text-fg shadow-soft placeholder:text-fg-subtle hover:border-line-strong focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle" />
        </div>
        <select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className="h-10 rounded-md border border-line bg-surface px-3 text-sm text-fg shadow-soft hover:border-line-strong focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle">
          <option value="">All statuses</option>
          {(Object.keys(STATUS) as UserStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS[s].label}
            </option>
          ))}
        </select>
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
                <th scope="col" className="px-5 py-3.5 font-semibold">Name</th>
                <th scope="col" className="hidden px-5 py-3.5 font-semibold md:table-cell">Email</th>
                <th scope="col" className="px-5 py-3.5 font-semibold">Status</th>
                <th scope="col" className="hidden whitespace-nowrap px-5 py-3.5 font-semibold lg:table-cell">Last sign-in</th>
                {canEdit ? <th scope="col" className="px-5 py-3.5 text-right font-semibold">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {state === 'ready' && rows.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 5 : 4} className="px-5 py-16 text-center text-fg-muted">
                    {search || status ? <Inbox aria-hidden="true" className="mx-auto mb-3 size-6 text-fg-subtle" /> : <UserPlus aria-hidden="true" className="mx-auto mb-3 size-6 text-fg-subtle" />}
                    {search || status ? 'No users match.' : 'No users yet.'}
                  </td>
                </tr>
              ) : null}
              {rows.map((u) => (
                <tr key={u.id} className="border-b border-line-subtle transition-colors last:border-0 hover:bg-canvas">
                  <td className="px-5 py-3.5">
                    <span className="block font-medium text-fg">{u.displayName}</span>
                    <span className="block text-xs text-fg-subtle">{u.username}</span>
                    {u.email ? <span className="block text-xs text-fg-subtle md:hidden">{u.email}</span> : null}
                  </td>
                  <td className="hidden px-5 py-3.5 text-fg-muted md:table-cell">{u.email ?? '—'}</td>
                  <td className="px-5 py-3.5">
                    <StatusBadge user={u} />
                  </td>
                  <td className="hidden whitespace-nowrap px-5 py-3.5 text-fg-muted lg:table-cell">{when(u.lastLoginAt)}</td>
                  {canEdit ? (
                    <td className="space-x-1 whitespace-nowrap px-5 py-2.5 text-right">
                      <Button size="sm" variant="ghost" aria-label={`Edit ${u.displayName}`} onClick={() => setEditing({ mode: 'edit', user: u })}>
                        <Pencil aria-hidden="true" className="size-3.5" />
                      </Button>
                      {canGiveRoles ? (
                        <Button size="sm" variant="ghost" aria-label={`Roles of ${u.displayName}`} onClick={() => setRolesFor(u)}>
                          <ShieldCheck aria-hidden="true" className="size-3.5" />
                        </Button>
                      ) : null}
                      {actionsFor(u).map((a) => (
                        <Button key={a} size="sm" variant={ACTION[a].confirm ? 'danger' : 'secondary'} disabled={busy} aria-label={`${ACTION[a].label} ${u.displayName}`} onClick={() => (ACTION[a].confirm ? setConfirming({ user: u, action: a }) : void run(u, a))}>
                          {ACTION[a].label}
                        </Button>
                      ))}
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
            Page {page} of {pages} · {total} users
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

      {editing ? (
        <UserForm
          editing={editing}
          api={api}
          onClose={() => setEditing(null)}
          onSaved={(u, inviteLink, emailQueued) => {
            setEditing(null);
            if (inviteLink) setLink({ user: u, url: absoluteLink(inviteLink), kind: 'invite', emailedTo: emailedTo(u, emailQueued) });
            else toast.success(`Saved: ${u.displayName}`);
            void load();
          }}
        />
      ) : null}
      {rolesFor ? <RolesSheet user={rolesFor} api={rolesApi} onClose={() => setRolesFor(null)} /> : null}
      {link ? <LinkDialog link={link} onClose={() => setLink(null)} /> : null}
      {confirming ? (
        <ConfirmDialog open title={`${ACTION[confirming.action].label} ${confirming.user.displayName}?`} onClose={() => setConfirming(null)}>
          <p className="text-sm text-fg-muted">{ACTION[confirming.action].confirm}</p>
          <div className="mt-5 flex gap-2">
            <Button variant="destructive" loading={busy} onClick={() => void run(confirming.user, confirming.action)}>
              {ACTION[confirming.action].label}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
          </div>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}
