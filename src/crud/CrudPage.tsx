import { useCallback, useEffect, useId, useMemo, useRef, useState, type FormEvent } from 'react';
import { ChevronLeft, ChevronRight, FilePlus, Inbox, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router-dom';
import { Button, Card, ConfirmDialog, Input, PageHeader, Sheet } from '../design-system';
import { useAccessState } from '../shell/AccessProvider';
import { ApiError, type CrudClient } from './client';
import { SearchPicker, type PickerOption } from './SearchPicker';
import { blankValues, type CrudDescriptor, type FieldDef, type FilterDef, type FormValues, type RowAction } from './descriptor';

const PAGE_SIZE = 25;

const STATUS_TONE: Record<string, string> = {
  active: 'border-success-line bg-success-bg text-success',
  enrolled: 'border-success-line bg-success-bg text-success',
  completed: 'border-info-line bg-info-bg text-info',
  paused: 'border-warning-line bg-warning-bg text-warning',
  withdrawn: 'border-warning-line bg-warning-bg text-warning',
  new: 'border-info-line bg-info-bg text-info',
  contacted: 'border-warning-line bg-warning-bg text-warning',
  visit_scheduled: 'border-warning-line bg-warning-bg text-warning',
  converted: 'border-success-line bg-success-bg text-success',
  submitted: 'border-info-line bg-info-bg text-info',
  under_review: 'border-warning-line bg-warning-bg text-warning',
  accepted: 'border-success-line bg-success-bg text-success',
  rejected: 'border-danger-line bg-danger-bg text-danger',
};

/** A status column reads as a small pill: green for live, amber for on hold, grey for everything that has ended. */
function StatusBadge({ value, label }: { value: string; label?: string }) {
  const text = label ?? (value ? value[0].toUpperCase() + value.slice(1) : '—');
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS_TONE[value] ?? 'border-line bg-subtle text-fg-muted'}`}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {text}
    </span>
  );
}

type OptionsClient = (endpoint: string) => CrudClient<Record<string, unknown> & { id: string }, never>;

const toOption = (f: FieldDef, row: Record<string, unknown>): PickerOption => {
  const r = f.remote!;
  const detail = r.detail && row[r.detail] ? ` (${String(row[r.detail])})` : '';
  return { value: String(row[r.value]), label: `${String(row[r.label])}${detail}` };
};

function searchRemote(client: OptionsClient, f: FieldDef, q: string): Promise<PickerOption[]> {
  if (q && q.length < (f.remote!.minChars ?? 0)) return Promise.resolve([]);
  return client(f.remote!.endpoint)
    .list({ page: 1, pageSize: 20, sort: undefined, q: q || undefined })
    .then((r) => r.items.map((row) => toOption(f, row)));
}

function describeRemote(client: OptionsClient, f: FieldDef, id: string, row?: Record<string, unknown>): Promise<PickerOption | null> {
  const known = f.remote!.currentLabel && row ? row[f.remote!.currentLabel] : null;
  if (f.remote!.currentLabel) return Promise.resolve(known ? { value: id, label: String(known) } : null);
  return client(f.remote!.endpoint)
    .get(id)
    .then((row) => toOption(f, row))
    .catch(() => null);
}

export function FieldControl({ field, value, error, onChange, options }: { field: FieldDef; value: string | number | boolean; error?: string; onChange: (v: string | number | boolean) => void; options?: { value: string; label: string }[] }) {
  const id = useId();
  if (field.kind === 'checkbox') {
    return (
      <label className="flex items-center gap-2 text-sm text-fg">
        <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
        {field.label}
      </label>
    );
  }
  if (field.kind === 'text' || field.kind === 'number' || field.kind === 'date' || field.kind === 'datetime') {
    return (
      <Input
        label={field.required ? `${field.label} *` : field.label}
        type={field.kind === 'number' ? 'number' : field.kind === 'date' ? 'date' : field.kind === 'datetime' ? 'datetime-local' : 'text'}
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

const FILTER_CONTROL = 'h-10 rounded-md border border-line bg-surface px-3 text-sm text-fg shadow-soft hover:border-line-strong focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle';

/** One filter above the table: a labelled select, or a tick box that narrows the list when ticked. */
function FilterControl({ filter, value, options, onChange }: { filter: FilterDef; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  if (filter.kind === 'toggle') {
    return (
      <label className="flex h-10 items-center gap-2 text-sm text-fg">
        <input type="checkbox" checked={value === 'true'} onChange={(e) => onChange(e.target.checked ? 'true' : '')} />
        {filter.label}
      </label>
    );
  }
  return (
    <select aria-label={filter.label} className={FILTER_CONTROL} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{`All ${filter.label.toLowerCase()}`}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
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
  const [urlParams] = useSearchParams();
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
  const [acting, setActing] = useState<{ action: RowAction<T>; row: T } | null>(null);
  // A link from another screen (for example the admissions dashboard) can open the list already filtered: ?status=new.
  const [filterValues, setFilterValues] = useState<Record<string, string>>(() => {
    return Object.fromEntries((d.filters ?? []).flatMap((f) => (urlParams.get(f.key) ? [[f.key, urlParams.get(f.key) as string]] : [])));
  });
  const [filterOptions, setFilterOptions] = useState<Record<string, { value: string; label: string }[]>>({});
  const [remote, setRemote] = useState<Record<string, { value: string; label: string }[]>>({});

  // Options that come from another resource (for example the academic year of a term) load when the form first opens.
  useEffect(() => {
    if (!editing || !optionsClient) return;
    d.fields.forEach((f) => {
      const src = f.remote;
      if (!src || src.search || remote[f.key]) return;
      optionsClient(src.endpoint)
        .list({ page: 1, pageSize: 200, sort: undefined })
        .then((r) => setRemote((prev) => ({ ...prev, [f.key]: r.items.map((row) => ({ value: String(row[src.value]), label: String(row[src.label]) })) })))
        .catch(() => setRemote((prev) => ({ ...prev, [f.key]: [] })));
    });
  }, [editing, optionsClient, d.fields, remote]);

  // Filters whose options come from another resource (the class filter) load once, when the page opens.
  useEffect(() => {
    if (!optionsClient) return;
    (d.filters ?? []).forEach((f) => {
      const src = f.remote;
      if (!src) return;
      optionsClient(src.endpoint)
        .list({ page: 1, pageSize: 200, sort: undefined })
        .then((r) => setFilterOptions((prev) => ({ ...prev, [f.key]: r.items.map((row) => ({ value: String(row[src.value]), label: String(row[src.label]) })) })))
        .catch(() => setFilterOptions((prev) => ({ ...prev, [f.key]: [] })));
    });
  }, [optionsClient, d.filters]);

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
      const r = await client.list({ page, pageSize: PAGE_SIZE, sort, q: query, filters: filterValues });
      if (mine !== latest.current) return; // a newer request superseded this one
      setRows(r.items);
      setTotal(r.total);
      setState('ready');
    } catch (e) {
      if (mine !== latest.current) return;
      setError(e instanceof ApiError ? e.message : 'Something went wrong.');
      setState('error');
    }
  }, [client, page, sort, query, filterValues]);

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
      const msg = editing.mode === 'create' ? `${cap(d.singular)} added.` : `${cap(d.singular)} saved.`;
      setNotice(msg);
      toast.success(msg);
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
      toast.success(`${cap(d.singular)} deleted.`);
      setDeleting(null);
      if (rows.length === 1 && page > 1) setPage(page - 1);
      else await load();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  const runAction = async () => {
    if (!acting || !optionsClient) return;
    setSaving(true);
    setFormError('');
    try {
      const result = await optionsClient(acting.action.endpoint(acting.row)).create({} as never);
      const msg = acting.action.success(result as Record<string, unknown>);
      setNotice(msg);
      toast.success(msg);
      setActing(null);
      await load();
    } catch (err) {
      const fields = err instanceof ApiError ? Object.values(err.fields) : [];
      setFormError(fields.length > 0 ? fields.join(' ') : err instanceof ApiError ? err.message : 'Something went wrong.');
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

  const filtered = Object.values(filterValues).some(Boolean);
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rowActions = (d.rowActions ?? []).filter((a) => can(a.permission));
  const showActions = canEdit || canDelete || rowActions.length > 0;
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const cols = useMemo(() => d.columns, [d.columns]);

  return (
    <section className="space-y-4">
      <PageHeader
        title={d.title}
        description={total > 0 ? `${total} ${total === 1 ? d.singular : d.title.toLowerCase()}` : undefined}
        actions={
          canCreate ? (
            <Button onClick={openCreate}>
              <Plus aria-hidden="true" className="size-4" />
              Add {d.singular}
            </Button>
          ) : null
        }
      />

      <div className="flex flex-wrap items-center gap-3">
      <div className="relative w-full max-w-sm">
        <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
        <input type="search" aria-label={`Search ${d.title.toLowerCase()}`} placeholder={d.searchPlaceholder} value={search} onChange={(e) => setSearch(e.target.value)} className="h-10 w-full rounded-md border border-line bg-surface pl-10 pr-3 text-sm text-fg shadow-soft placeholder:text-fg-subtle hover:border-line-strong focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle" />
      </div>
      {(d.filters ?? []).map((f) => (
        <FilterControl
          key={f.key}
          filter={f}
          value={filterValues[f.key] ?? ''}
          options={f.options ?? filterOptions[f.key] ?? []}
          onChange={(v) => {
            setFilterValues((prev) => ({ ...prev, [f.key]: v }));
            setPage(1);
          }}
        />
      ))}
      </div>

      {/* the toast is what people see; this live region is what a screen reader hears */}
      <div role="status" aria-live="polite" className="sr-only">
        {notice}
      </div>

      {state === 'error' ? (
        <div role="alert" className="space-y-3 rounded-lg border border-danger-line bg-surface p-6 shadow-soft">
          <p className="text-fg">{error}</p>
          <Button variant="secondary" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm" aria-busy={state === 'loading'}>
            <thead className="border-b border-line-subtle text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
              <tr>
                {cols.map((c) => (
                  <th key={c.key} scope="col" aria-sort={c.sort && sortKey === c.sort ? (descending ? 'descending' : 'ascending') : undefined} className="whitespace-nowrap px-5 py-3.5 font-semibold">
                    {c.sort ? (
                      <button type="button" className="inline-flex items-center gap-1 uppercase tracking-[inherit] hover:text-fg" onClick={() => toggleSort(c.sort!)}>
                        {c.label}
                        {sortKey === c.sort ? <span aria-hidden="true">{descending ? '↓' : '↑'}</span> : null}
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                ))}
                {showActions ? (
                  <th scope="col" className="px-5 py-3.5 text-right font-semibold">
                    Actions
                  </th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {state === 'ready' && rows.length === 0 ? (
                <tr>
                  <td colSpan={cols.length + (showActions ? 1 : 0)} className="px-5 py-16 text-center text-fg-muted">
                    <Inbox aria-hidden="true" className="mx-auto mb-3 size-6 text-fg-subtle" />
                    {query || filtered ? (query ? `No ${d.title.toLowerCase()} match “${query}”.` : `No ${d.title.toLowerCase()} match these filters.`) : `No ${d.title.toLowerCase()} yet.`}
                    {!query && !filtered && canCreate ? ` Use “Add ${d.singular}” to create the first one.` : ''}
                  </td>
                </tr>
              ) : null}
              {state === 'loading' && rows.length === 0 ? (
                <tr>
                  <td colSpan={cols.length + (showActions ? 1 : 0)} className="px-5 py-16 text-center text-fg-muted">
                    Loading…
                  </td>
                </tr>
              ) : null}
              {rows.map((row) => (
                <tr key={row.id} className="border-b border-line-subtle transition-colors last:border-0 hover:bg-canvas">
                  {cols.map((c, i) => (
                    <td key={c.key} className={i === 0 ? 'whitespace-nowrap px-5 py-3.5 font-medium text-fg' : 'px-5 py-3.5 text-fg-muted'}>
                      {c.key === 'status' ? (
                        <StatusBadge value={String((row as Record<string, unknown>).status ?? '')} label={c.render ? c.render(row) : undefined} />
                      ) : c.render ? (
                        c.render(row)
                      ) : (
                        String((row as Record<string, unknown>)[c.key] ?? '—')
                      )}
                    </td>
                  ))}
                  {showActions ? (
                    <td className="space-x-1 whitespace-nowrap px-5 py-2.5 text-right">
                      {rowActions
                        .filter((a) => !a.visible || a.visible(row))
                        .map((a) => (
                          <Button
                            key={a.key}
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setFormError('');
                              setActing({ action: a, row });
                            }}
                            aria-label={`${a.label} ${d.label(row)}`}
                          >
                            <FilePlus aria-hidden="true" className="size-3.5" />
                            {a.label}
                          </Button>
                        ))}
                      {canEdit ? (
                        <Button size="sm" variant="ghost" onClick={() => openEdit(row)} aria-label={`Edit ${d.label(row)}`}>
                          <Pencil aria-hidden="true" className="size-3.5" />
                          Edit
                        </Button>
                      ) : null}
                      {canDelete ? (
                        <Button size="sm" variant="ghost" className="hover:text-danger" onClick={() => setDeleting(row)} aria-label={`Delete ${d.label(row)}`}>
                          <Trash2 aria-hidden="true" className="size-3.5" />
                          Delete
                        </Button>
                      ) : null}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {state === 'ready' && total > 0 ? (
        <nav className="flex items-center justify-between text-sm text-fg-muted" aria-label="Pagination">
          <span>
            Showing {from}–{to} of {total}
          </span>
          <span className="flex items-center gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft aria-hidden="true" className="size-4" />
              Previous
            </Button>
            <Button size="sm" variant="secondary" disabled={page >= lastPage} onClick={() => setPage(page + 1)}>
              Next
              <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
          </span>
        </nav>
      ) : null}

      {editing ? (
        <Sheet open title={editing.mode === 'create' ? `Add ${d.singular}` : `Edit ${d.singular}`} onClose={close}>
          <form onSubmit={(e) => void submit(e)} className="flex flex-1 flex-col gap-4" noValidate>
            {editing.mode === 'edit' && d.editExtra ? d.editExtra(editing.row as T, { setValue: (key, value) => setValues((prev) => ({ ...prev, [key]: value })) }) : null}
            {d.fields.map((f) =>
              f.remote?.search && optionsClient ? (
                <SearchPicker
                  key={f.key}
                  label={f.label}
                  required={f.required}
                  hint={f.hint}
                  error={fieldErrors[f.key]}
                  value={String(values[f.key] ?? '')}
                  onChange={(v) => setValues({ ...values, [f.key]: v })}
                  search={(q) => searchRemote(optionsClient, f, q)}
                  describe={(id) => describeRemote(optionsClient, f, id, editing.mode === 'edit' ? (editing.row as Record<string, unknown>) : undefined)}
                />
              ) : (
                <FieldControl key={f.key} field={f} value={values[f.key] ?? ''} error={fieldErrors[f.key]} options={remote[f.key]} onChange={(v) => setValues({ ...values, [f.key]: v })} />
              ),
            )}
            {formError ? (
              <p role="alert" className="text-sm text-danger">
                {formError}
              </p>
            ) : null}
            <div className="sticky -bottom-8 -mx-8 -mb-8 mt-auto flex gap-2 border-t border-line-subtle bg-surface px-8 py-4">
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

      {acting ? (
        <ConfirmDialog open title={acting.action.confirm(acting.row).title} onClose={() => setActing(null)}>
          <p className="text-sm text-fg-muted">{acting.action.confirm(acting.row).body}</p>
          {formError ? (
            <p role="alert" className="mt-3 text-sm text-danger">
              {formError}
            </p>
          ) : null}
          <div className="mt-5 flex gap-2">
            <Button loading={saving} onClick={() => void runAction()}>
              {acting.action.label}
            </Button>
            <Button variant="secondary" onClick={() => setActing(null)}>
              Cancel
            </Button>
          </div>
        </ConfirmDialog>
      ) : null}

      {deleting ? (
        <ConfirmDialog open title={`Delete ${d.singular}?`} onClose={() => setDeleting(null)}>
          <p className="text-sm text-fg-muted">“{d.label(deleting)}” will be removed from the list.</p>
          {formError ? (
            <p role="alert" className="mt-3 text-sm text-danger">
              {formError}
            </p>
          ) : null}
          <div className="mt-5 flex gap-2">
            <Button variant="destructive" loading={saving} onClick={() => void confirmDelete()}>
              Delete
            </Button>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
          </div>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
