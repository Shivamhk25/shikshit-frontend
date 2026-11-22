import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ArrowLeft, Copy, Lock, Plus, Search, ShieldCheck, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, ConfirmDialog, Input, PageHeader } from '../../design-system';
import { useAccessState } from '../../shell/AccessProvider';
import { useAuth } from '../../shell/AuthProvider';
import { API_BASE } from '../../shell/web-session';
import { buildMatrix, createRolesApi, diff, grantsFrom, selectionFrom, words, type CatalogPermission, type MatrixModule, type Role, type RoleDetail, type RolesApi, type Scope, type Selection } from './rolesApi';

type View = { kind: 'list' } | { kind: 'edit'; role: RoleDetail | null };

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

/** IAM-02: roles and what each may do. Built-in roles are read-only; clone one to make your own. */
export function RolesPage({ api: injected }: { api?: RolesApi }) {
  const { session } = useAuth();
  const api = useMemo(() => injected ?? createRolesApi(session, API_BASE), [injected, session]);
  const access = useAccessState();
  const can = (code: string) => access.phase === 'ready' && access.access.can(code);
  const [view, setView] = useState<View>({ kind: 'list' });
  const [roles, setRoles] = useState<Role[] | null>(null);
  const [catalog, setCatalog] = useState<CatalogPermission[] | null>(null);
  const [error, setError] = useState('');
  const [cloning, setCloning] = useState<Role | null>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const [r, c] = await Promise.all([api.list(), api.catalog()]);
      setRoles(r);
      setCatalog(c);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    }
  }, [api]);

  useEffect(() => void load(), [load]);

  const open = async (r: Role) => {
    try {
      setView({ kind: 'edit', role: await api.get(r.id) });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong.');
    }
  };

  if (view.kind === 'edit' && catalog) {
    return (
      <RoleEditor
        api={api}
        catalog={catalog}
        role={view.role}
        canSave={view.role ? !view.role.isSystem && can('iam.roles.edit') : can('iam.roles.create')}
        onClone={view.role && can('iam.roles.create') ? () => setCloning(view.role) : undefined}
        onDone={() => {
          setView({ kind: 'list' });
          void load();
        }}
        cloneDialog={cloning ? <CloneDialog api={api} role={cloning} onClose={() => setCloning(null)} onCloned={(d) => { setCloning(null); setView({ kind: 'edit', role: d }); void load(); }} /> : null}
      />
    );
  }

  return (
    <section className="space-y-4">
      <PageHeader
        title="Roles"
        description="What each kind of staff member can see and do. Built-in roles cannot be changed; clone one to make your own."
        actions={
          can('iam.roles.create') ? (
            <Button onClick={() => setView({ kind: 'edit', role: null })} disabled={!catalog}>
              <Plus aria-hidden="true" className="size-4" />
              New role
            </Button>
          ) : undefined
        }
      />
      {error ? (
        <div role="alert" className="space-y-3 rounded-lg border border-danger-line bg-surface p-6 shadow-soft">
          <p className="text-fg">{error}</p>
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      ) : !roles ? (
        <p role="status" className="text-sm text-fg-muted">
          Loading roles…
        </p>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {roles.map((r) => (
            <li key={r.id}>
              <Card className="flex h-full flex-col gap-4 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-1">
                    <h2 className="font-display text-lg font-semibold text-fg">{r.name}</h2>
                    {r.description ? <p className="text-sm text-fg-muted">{r.description}</p> : null}
                  </div>
                  {r.isSystem ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-subtle px-2.5 py-0.5 text-xs font-medium text-fg-muted">
                      <Lock aria-hidden="true" className="size-3" />
                      Built-in
                    </span>
                  ) : null}
                </div>
                <p className="flex gap-4 text-sm text-fg-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <Users aria-hidden="true" className="size-4" />
                    {plural(r.holderCount, 'person', 'people')}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck aria-hidden="true" className="size-4" />
                    {plural(r.permissionCount, 'permission')}
                  </span>
                </p>
                <div className="mt-auto flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => void open(r)} aria-label={`${r.isSystem || !can('iam.roles.edit') ? 'View' : 'Edit'} ${r.name}`}>
                    {r.isSystem || !can('iam.roles.edit') ? 'View' : 'Edit'}
                  </Button>
                  {can('iam.roles.create') ? (
                    <Button size="sm" variant="ghost" onClick={() => setCloning(r)} aria-label={`Clone ${r.name}`}>
                      <Copy aria-hidden="true" className="size-3.5" />
                      Clone
                    </Button>
                  ) : null}
                  {!r.isSystem && can('iam.roles.delete') ? (
                    <Button size="sm" variant="ghost" className="hover:text-danger" onClick={() => setDeleting(r)} aria-label={`Delete ${r.name}`}>
                      <Trash2 aria-hidden="true" className="size-3.5" />
                    </Button>
                  ) : null}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
      {cloning ? <CloneDialog api={api} role={cloning} onClose={() => setCloning(null)} onCloned={(d) => { setCloning(null); setView({ kind: 'edit', role: d }); void load(); }} /> : null}
      {deleting ? <DeleteDialog api={api} role={deleting} onClose={() => setDeleting(null)} onDeleted={() => { setDeleting(null); void load(); }} /> : null}
    </section>
  );
}

function CloneDialog({ api, role, onClose, onCloned }: { api: RolesApi; role: Role; onClose: () => void; onCloned: (d: RoleDetail) => void }) {
  const [name, setName] = useState(`${role.name} (copy)`);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      onCloned(await api.clone(role.id, name.trim()));
      toast.success(`Copied ${role.name}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <ConfirmDialog open title={`Clone ${role.name}`} onClose={onClose}>
      <Input label="Name of the new role" value={name} onChange={(e) => setName(e.target.value)} error={error || undefined} />
      <div className="mt-5 flex gap-2">
        <Button loading={busy} disabled={!name.trim()} onClick={() => void submit()}>
          Clone
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </ConfirmDialog>
  );
}

function DeleteDialog({ api, role, onClose, onDeleted }: { api: RolesApi; role: Role; onClose: () => void; onDeleted: () => void }) {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await api.remove(role.id);
      toast.success(`Deleted ${role.name}`);
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <ConfirmDialog open title={`Delete ${role.name}?`} onClose={onClose}>
      <p className="text-sm text-fg-muted">{role.holderCount > 0 ? `${plural(role.holderCount, 'person', 'people')} still ${role.holderCount === 1 ? 'has' : 'have'} this role. Give them another role first.` : 'Nobody has this role. It will be removed.'}</p>
      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="mt-5 flex gap-2">
        <Button variant="destructive" loading={busy} disabled={role.holderCount > 0} onClick={() => void submit()}>
          Delete
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
      </div>
    </ConfirmDialog>
  );
}

function RoleEditor({ api, catalog, role, canSave, onClone, onDone, cloneDialog }: { api: RolesApi; catalog: CatalogPermission[]; role: RoleDetail | null; canSave: boolean; onClone?: () => void; onDone: () => void; cloneDialog: ReactNode }) {
  const matrix = useMemo(() => buildMatrix(catalog), [catalog]);
  const [name, setName] = useState(role?.name ?? '');
  const [description, setDescription] = useState(role?.description ?? '');
  const [sel, setSel] = useState<Selection>(() => selectionFrom(role?.grants ?? []));
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);
  const readOnly = !canSave;

  const grants = useMemo(() => grantsFrom(sel, matrix), [sel, matrix]);
  const changes = diff(role?.grants ?? [], grants);
  const dirty = !role || changes.added + changes.removed + changes.changed > 0 || name !== role.name || description !== (role.description ?? '');

  const toggle = (code: string) => {
    if (readOnly) return;
    const granted = new Set(sel.granted);
    if (granted.has(code)) granted.delete(code);
    else granted.add(code);
    setSel({ ...sel, granted });
  };
  const setRow = (m: MatrixModule, on: boolean) => {
    if (readOnly) return;
    const granted = new Set(sel.granted);
    for (const r of m.rows) for (const code of Object.values(r.actions)) (on ? granted.add(code) : granted.delete(code));
    setSel({ ...sel, granted });
  };
  const setScope = (key: string, scope: Scope) => setSel({ ...sel, rowScope: { ...sel.rowScope, [key]: scope } });

  const save = async () => {
    if (!name.trim()) return setNameError('Give the role a name.');
    setSaving(true);
    setError('');
    setNameError('');
    try {
      const input = { name: name.trim(), description: description.trim() || null, grants };
      if (role) await api.update(role.id, input);
      else await api.create(input);
      toast.success(`Saved ${name.trim()}`);
      onDone();
    } catch (err) {
      const e = err as { fields?: Record<string, string>; message?: string };
      if (e.fields?.name) setNameError(e.fields.name);
      else setError(e.fields?.grants ?? e.message ?? 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const q = filter.trim().toLowerCase();
  const shown = matrix
    .map((m) => ({ ...m, rows: m.rows.filter((r) => !q || r.label.toLowerCase().includes(q) || m.label.toLowerCase().includes(q)) }))
    .filter((m) => m.rows.length > 0);

  return (
    <section className="space-y-6 pb-24">
      <button type="button" onClick={onDone} className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft aria-hidden="true" className="size-4" />
        All roles
      </button>
      <PageHeader
        title={role ? role.name : 'New role'}
        description={role?.isSystem ? 'A built-in role. It cannot be changed; clone it to make your own version.' : 'Tick what people with this role may do. You can only give permissions you have yourself.'}
        actions={
          onClone ? (
            <Button variant="secondary" onClick={onClone}>
              <Copy aria-hidden="true" className="size-4" />
              Clone
            </Button>
          ) : undefined
        }
      />
      {!readOnly ? (
        <Card className="grid gap-4 p-5 md:grid-cols-2">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} error={nameError || undefined} />
          <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} hint="Optional. Who this role is for." />
        </Card>
      ) : null}

      <div className="relative max-w-sm">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
        <input type="search" aria-label="Filter permissions" placeholder="Filter by area" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 w-full rounded-md border border-line bg-surface pl-10 pr-3 text-sm text-fg shadow-soft placeholder:text-fg-subtle hover:border-line-strong focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle" />
      </div>

      {shown.map((m) => {
        const codes = m.rows.flatMap((r) => Object.values(r.actions));
        const all = codes.every((c) => sel.granted.has(c));
        return (
          <Card key={m.module}>
            <div className="flex items-center justify-between gap-3 border-b border-line-subtle px-5 py-3.5">
              <h2 id={`m-${m.module}`} className="font-display text-base font-semibold text-fg">
                {m.label}
              </h2>
              {!readOnly ? (
                <button type="button" className="text-xs font-medium text-accent-fg hover:underline" onClick={() => setRow(m, !all)}>
                  {all ? 'Clear all' : 'Select all'}
                </button>
              ) : null}
            </div>
            <div className="overflow-x-auto">
            <table className="w-full text-left text-sm" aria-labelledby={`m-${m.module}`}>
              <thead className="border-b border-line-subtle text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
                <tr>
                  <th scope="col" className="sticky left-0 z-10 bg-surface px-5 py-3 font-semibold">
                    Area
                  </th>
                  {m.actions.map((a) => (
                    <th key={a} scope="col" className="px-3 py-3 text-center font-semibold">
                      {words(a)}
                    </th>
                  ))}
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Reaches
                  </th>
                </tr>
              </thead>
              <tbody>
                {m.rows.map((r) => {
                  const any = Object.values(r.actions).some((c) => sel.granted.has(c));
                  return (
                    <tr key={r.key} className="border-b border-line-subtle last:border-0">
                      <th scope="row" className="sticky left-0 z-10 bg-surface px-5 py-2.5 font-medium text-fg sm:whitespace-nowrap">
                        {r.label}
                        {r.sensitive ? (
                          <span className="mt-0.5 flex items-center gap-1 text-xs font-normal text-warning sm:ml-2 sm:mt-0 sm:inline-flex">
                            <Lock aria-hidden="true" className="size-3" />
                            Personal data
                          </span>
                        ) : null}
                      </th>
                      {m.actions.map((a) => {
                        const code = r.actions[a];
                        return (
                          <td key={a} className="px-3 py-2.5 text-center">
                            {code ? <input type="checkbox" aria-label={`${words(a)} ${r.label}`} checked={sel.granted.has(code)} disabled={readOnly} onChange={() => toggle(code)} className="size-4 accent-accent" /> : null}
                          </td>
                        );
                      })}
                      <td className="whitespace-nowrap px-5 py-2.5 text-fg-muted">
                        {r.scopable && any ? (
                          <select aria-label={`Who ${r.label.toLowerCase()} reaches`} value={sel.rowScope[r.key] ?? 'tenant'} disabled={readOnly} onChange={(e) => setScope(r.key, e.target.value as Scope)} className="h-8 rounded-md border border-line bg-surface px-2 text-sm text-fg">
                            <option value="tenant">Whole school</option>
                            <option value="class_section">Assigned class sections</option>
                          </select>
                        ) : any ? (
                          'Whole school'
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </Card>
        );
      })}

      {!readOnly ? (
        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-line-subtle bg-surface/95 px-4 py-4 backdrop-blur md:-mx-8 md:px-8">
          <Button loading={saving} disabled={!dirty} onClick={() => void save()}>
            {role ? 'Save changes' : 'Create role'}
          </Button>
          <Button variant="secondary" onClick={onDone}>
            Cancel
          </Button>
          <span className="text-sm text-fg-muted" aria-live="polite">
            {role ? `${changes.added} added, ${changes.removed} removed${changes.changed ? `, ${changes.changed} changed` : ''}. ${role.holderCount ? `${plural(role.holderCount, 'person', 'people')} will get this change.` : 'Nobody has this role yet.'}` : `${plural(grants.length, 'permission')} ticked.`}
          </span>
          {error ? (
            <p role="alert" className="w-full text-sm text-danger">
              {error}
            </p>
          ) : null}
        </div>
      ) : null}
      {cloneDialog}
    </section>
  );
}
