import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Button, Input } from '../design-system';
import { useAccessState } from '../shell/AccessProvider';
import { ApiError, type CrudClient } from './client';
import { blankValues, type CrudDescriptor, type FieldDef, type FormValues } from './descriptor';

const PAGE_SIZE = 25;

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const titleId = useId();
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-overlay" onClick={onClose} aria-hidden="true" />
      <aside ref={ref} role="dialog" aria-modal="true" aria-labelledby={titleId} className="relative z-10 flex h-full w-full max-w-md flex-col gap-4 overflow-y-auto border-l border-line bg-surface p-6">
        <h2 id={titleId} className="text-lg font-semibold text-fg">
          {title}
        </h2>
        {children}
      </aside>
    </div>
  );
}

function FieldControl({ field, value, error, onChange, options }: { field: FieldDef; value: string | number | boolean; error?: string; onChange: (v: string | number | boolean) => void; options?: { value: string; label: string }[] }) {
  const id = useId();
  if (field.kind === 'checkbox') {
    return (
      <label className="flex items-center gap-2 text-sm text-fg">
        <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
        {field.label}
      </label>
    );
  }
  if (field.kind === 'text' || field.kind === 'number' || field.kind === 'date') {
    return (
      <Input
        label={field.required ? `${field.label} *` : field.label}
        type={field.kind === 'number' ? 'number' : field.kind === 'date' ? 'date' : 'text'}
        step={field.step}
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
        error={error}
        hint={field.hint}
        maxLength={field.maxLength}
        min={field.min}
        max={field.max}
      />
    );
  }
  const common = 'w-full rounded-md border bg-surface px-3 text-base text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring ' + (error ? 'border-danger' : 'border-line');
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {field.required ? `${field.label} *` : field.label}
      </label>
      {field.kind === 'select' ? (
        <select id={id} className={`${common} h-10`} value={String(value)} onChange={(e) => onChange(e.target.value)} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-e` : undefined}>
          {!field.required ? <option value="">—</option> : null}
          {field.required && value === '' ? (
            <option value="" disabled>
              Choose…
            </option>
          ) : null}
          {(options ?? field.options)?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <textarea id={id} className={`${common} min-h-24 py-2`} value={String(value)} onChange={(e) => onChange(e.target.value)} maxLength={field.maxLength} aria-invalid={error ? true : undefined} aria-describedby={error ? `${id}-e` : undefined} />
      )}
      {error ? (
        <p id={`${id}-e`} className="text-sm text-danger">
          {error}
        </p>
      ) : field.hint ? (
        <p className="text-sm text-fg-muted">{field.hint}</p>
      ) : null}
    </div>
  );
}

type Editing = { mode: 'create' } | { mode: 'edit'; row: { id: string } };

/**
 * List page for one resource: search, sortable columns, paging, and a side-sheet form. Add / Edit / Delete appear only
 * for users who hold the matching permission; the server enforces the same rules on every request.
 */
export function CrudPage<T extends { id: string }>({
  descriptor: d,
  client,
  optionsClient,
}: {
  descriptor: CrudDescriptor<T>;
  client: CrudClient<T, Record<string, unknown>>;
  /** Builds a client for another resource; needed only by fields with `remote` options. */
  optionsClient?: (endpoint: string) => CrudClient<Record<string, unknown> & { id: string }, never>;
}) {
  const access = useAccessState();
  const can = (code: string) => access.phase === 'ready' && access.access.can(code);
  const canCreate = can(d.permissions.create);
  const canEdit = can(d.permissions.edit);
  const canDelete = can(d.permissions.delete);

  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(d.defaultSort);
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const latest = useRef(0);

  const [editing, setEditing] = useState<Editing | null>(null);
  const [values, setValues] = useState<FormValues>(() => blankValues(d.fields));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<T | null>(null);
  const [notice, setNotice] = useState('');
  const [remote, setRemote] = useState<Record<string, { value: string; label: string }[]>>({});

  // Options that come from another resource (for example the academic year of a term) load when the form first opens.
  useEffect(() => {
    if (!editing || !optionsClient) return;
    d.fields.forEach((f) => {
      const src = f.remote;
      if (!src || remote[f.key]) return;
      optionsClient(src.endpoint)
        .list({ page: 1, pageSize: 200, sort: undefined })
        .then((r) => setRemote((prev) => ({ ...prev, [f.key]: r.items.map((row) => ({ value: String(row[src.value]), label: String(row[src.label]) })) })))
        .catch(() => setRemote((prev) => ({ ...prev, [f.key]: [] })));
    });
  }, [editing, optionsClient, d.fields, remote]);

  useEffect(() => {
    const t = setTimeout(() => {
      setQuery(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    const mine = ++latest.current;
    setState('loading');
    try {
      const r = await client.list({ page, pageSize: PAGE_SIZE, sort, q: query });
      if (mine !== latest.current) return; // a newer request superseded this one
      setRows(r.items);
      setTotal(r.total);
      setState('ready');
    } catch (e) {
      if (mine !== latest.current) return;
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
      setState('error');
    }
  }, [client, page, sort, query]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = () => {
    setValues(blankValues(d.fields));
    setFieldErrors({});
    setFormError('');
    setEditing({ mode: 'create' });
  };
  const openEdit = (row: T) => {
    setValues(d.toForm(row));
    setFieldErrors({});
    setFormError('');
    setEditing({ mode: 'edit', row });
  };
  const close = useCallback(() => setEditing(null), []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setFieldErrors({});
    setFormError('');
    try {
      const input = d.toInput(values);
      if (editing.mode === 'create') await client.create(input);
      else await client.update(editing.row.id, input);
      setNotice(editing.mode === 'create' ? `${cap(d.singular)} added.` : `${cap(d.singular)} saved.`);
      setEditing(null);
      await load();
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length > 0) setFieldErrors(err.fields);
      else setFormError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setSaving(true);
    try {
      await client.remove(deleting.id);
      setNotice(`${cap(d.singular)} deleted.`);
      setDeleting(null);
      if (rows.length === 1 && page > 1) setPage(page - 1);
      else await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const sortKey = sort.replace(/^-/, '');
  const descending = sort.startsWith('-');
  const toggleSort = (key: string) => {
    setSort(sortKey === key && !descending ? `-${key}` : key);
    setPage(1);
  };

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showActions = canEdit || canDelete;
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const cols = useMemo(() => d.columns, [d.columns]);

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-fg">{d.title}</h1>
        {canCreate ? <Button onClick={openCreate}>Add {d.singular}</Button> : null}
      </header>

      <input type="search" aria-label={`Search ${d.title.toLowerCase()}`} placeholder={d.searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 w-full max-w-sm rounded-md border border-line bg-surface px-3 text-base text-fg placeholder:text-fg-subtle focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring" />

      <div role="status" aria-live="polite" className="min-h-5 text-sm text-success">
        {notice}
      </div>

      {state === 'error' ? (
        <div role="alert" className="space-y-3 rounded-lg border border-line bg-surface p-6">
          <p className="text-fg">{error}</p>
          <Button variant="secondary" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-left text-sm" aria-busy={state === 'loading'}>
            <thead className="border-b border-line bg-subtle text-fg-muted">
              <tr>
                {cols.map((c) => (
                  <th key={c.key} scope="col" aria-sort={c.sort && sortKey === c.sort ? (descending ? 'descending' : 'ascending') : undefined} className="px-4 py-3 font-medium">
                    {c.sort ? (
                      <button type="button" className="inline-flex items-center gap-1 hover:text-fg" onClick={() => toggleSort(c.sort!)}>
                        {c.label}
                        {sortKey === c.sort ? <span aria-hidden="true">{descending ? '↓' : '↑'}</span> : null}
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                ))}
                {showActions ? (
                  <th scope="col" className="px-4 py-3 text-right font-medium">
                    Actions
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {state === 'ready' && rows.length === 0 ? (
                <tr>
                  <td colSpan={cols.length + (showActions ? 1 : 0)} className="px-4 py-10 text-center text-fg-muted">
                    {query ? `No ${d.title.toLowerCase()} match “${query}”.` : `No ${d.title.toLowerCase()} yet.`}
                    {!query && canCreate ? ` Use “Add ${d.singular}” to create the first one.` : ''}
                  </td>
                </tr>
              ) : null}
              {state === 'loading' && rows.length === 0 ? (
                <tr>
                  <td colSpan={cols.length + (showActions ? 1 : 0)} className="px-4 py-10 text-center text-fg-muted">
                    Loading…
                  </td>
                </tr>
              ) : null}
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line last:border-0">
                  {cols.map((c) => (
                    <td key={c.key} className="px-4 py-3 text-fg">
                      {c.render ? c.render(row) : String((row as Record<string, unknown>)[c.key] ?? '—')}
                    </td>
                  ))}
                  {showActions ? (
                    <td className="space-x-2 px-4 py-3 text-right">
                      {canEdit ? (
                        <Button size="sm" variant="secondary" onClick={() => openEdit(row)} aria-label={`Edit ${d.label(row)}`}>
                          Edit
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button size="sm" variant="danger" onClick={() => setDeleting(row)} aria-label={`Delete ${d.label(row)}`}>
                          Delete
                        </Button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {state === 'ready' && total > 0 ? (
        <nav className="flex items-center justify-between text-sm text-fg-muted" aria-label="Pagination">
          <span>
            Showing {from}–{to} of {total}
          </span>
          <span className="space-x-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              Previous
            </Button>
            <Button size="sm" variant="secondary" disabled={page >= lastPage} onClick={() => setPage(page + 1)}>
              Next
            </Button>
          </span>
        </nav>
      ) : null}

      {editing ? (
        <Sheet title={editing.mode === 'create' ? `Add ${d.singular}` : `Edit ${d.singular}`} onClose={close}>
          <form onSubmit={(e) => void submit(e)} className="flex flex-1 flex-col gap-4" noValidate>
            {d.fields.map((f) => (
              <FieldControl key={f.key} field={f} value={values[f.key] ?? ''} error={fieldErrors[f.key]} options={remote[f.key]} onChange={(v) => setValues({ ...values, [f.key]: v })} />
            ))}
            {formError ? (
              <p role="alert" className="text-sm text-danger">
                {formError}
              </p>
            ) : null}
            <div className="mt-auto flex gap-2">
              <Button type="submit" loading={saving}>
                Save
              </Button>
              <Button type="button" variant="secondary" onClick={close}>
                Cancel
              </Button>
            </div>
          </form>
        </Sheet>
      ) : null}

      {deleting ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-overlay" onClick={() => setDeleting(null)} aria-hidden="true" />
          <div role="alertdialog" aria-modal="true" aria-label={`Delete ${d.singular}`} className="relative z-10 w-full max-w-sm space-y-4 rounded-lg border border-line bg-surface p-6">
            <h2 className="text-lg font-semibold text-fg">Delete {d.singular}?</h2>
            <p className="text-fg-muted">
              “{d.label(deleting)}” will be removed from the list.
            </p>
            {formError ? (
              <p role="alert" className="text-sm text-danger">
                {formError}
              </p>
            ) : null}
            <div className="flex gap-2">
              <Button variant="danger" loading={saving} onClick={() => void confirmDelete()}>
                Delete
              </Button>
              <Button variant="secondary" onClick={() => setDeleting(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
