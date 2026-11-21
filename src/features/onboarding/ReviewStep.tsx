import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../../crud/client';
import { Button, cx } from '../../design-system';
import { ROW_LABEL, saveBlob } from './format';
import type { ImportApi, ImportBatch, ImportEntity, ImportRow, RowStatus } from './importApi';

const PAGE_SIZE = 25;

type Filter = 'all' | 'error' | 'valid';

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'bad' | 'warn' }) {
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <p className={cx('m-0 text-2xl font-semibold', tone === 'ok' && 'text-success', tone === 'bad' && value > 0 && 'text-danger', tone === 'warn' && value > 0 && 'text-warning', !tone && 'text-fg')}>{value}</p>
      <p className="m-0 text-sm text-fg-muted">{label}</p>
    </div>
  );
}

function RowsTable({ api, batch, entity, filter }: { api: ImportApi; batch: ImportBatch; entity: ImportEntity | undefined; filter: Filter }) {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setPage(1), [filter]);
  const load = useCallback(() => {
    setError(null);
    const status: RowStatus | undefined = filter === 'all' ? undefined : filter;
    api
      .rows(batch.id, { page, pageSize: PAGE_SIZE, status })
      .then((p) => {
        setRows(p.items);
        setTotal(p.total);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.'));
  }, [api, batch.id, page, filter]);
  useEffect(load, [load]);

  const cols = entity?.columns ?? [];
  if (error) {
    return (
      <div role="alert" className="space-y-3 rounded-lg border border-line bg-surface p-6">
        <p className="text-fg">{error}</p>
        <Button variant="secondary" onClick={load}>
          Try again
        </Button>
      </div>
    );
  }
  if (!rows) {
    return (
      <p role="status" className="text-fg-muted">
        Loading rows…
      </p>
    );
  }
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-left text-sm">
          <caption className="sr-only">Rows in your file</caption>
          <thead className="border-b border-line bg-subtle text-fg-muted">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Line
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Result
              </th>
              {cols.map((c) => (
                <th key={c.key} scope="col" className="px-4 py-3 font-medium">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={cols.length + 2} className="px-4 py-10 text-center text-fg-muted">
                  {filter === 'error' ? 'No rows need fixing.' : 'No rows to show.'}
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const problems = r.problems.filter((p) => p.severity === 'error');
                const notes = r.problems.filter((p) => p.severity === 'warning');
                return (
                  <tr key={r.rowNo} className="border-b border-line align-top last:border-0">
                    <td className="px-4 py-3 text-fg-muted">{r.rowNo}</td>
                    <td className="px-4 py-3">
                      <span
                        className={cx(
                          'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium',
                          r.status === 'error' ? 'bg-danger-bg text-danger' : r.status === 'warning' ? 'bg-warning-bg text-warning' : 'bg-success-bg text-success',
                        )}
                      >
                        {ROW_LABEL[r.status]}
                      </span>
                      {r.action ? <span className="ml-2 text-xs text-fg-muted">{r.action === 'create' ? 'will be added' : 'will be updated'}</span> : null}
                    </td>
                    {cols.map((c) => {
                      const cellProblems = [...problems, ...notes].filter((p) => p.column === c.key);
                      return (
                        <td key={c.key} className="px-4 py-3 text-fg">
                          {r.cells[c.key] ?? <span className="text-fg-subtle">—</span>}
                          {cellProblems.map((p) => (
                            <p key={p.code + p.message} className={cx('mt-1 text-xs', p.severity === 'error' ? 'text-danger' : 'text-warning')}>
                              {p.message}
                            </p>
                          ))}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      {rows.some((r) => r.problems.some((p) => !p.column || !cols.some((c) => c.key === p.column))) ? (
        <ul className="m-0 list-none space-y-1 p-0 text-sm text-danger" aria-label="Other problems">
          {rows.flatMap((r) => r.problems.filter((p) => !p.column || !cols.some((c) => c.key === p.column)).map((p) => <li key={`${r.rowNo}-${p.code}-${p.message}`}>{`Line ${r.rowNo}: ${p.message}`}</li>))}
        </ul>
      ) : null}
      {total > PAGE_SIZE ? (
        <nav className="flex items-center justify-between text-sm text-fg-muted" aria-label="Pagination">
          <span>
            Page {page} of {pages}
          </span>
          <span className="space-x-2">
            <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </Button>
            <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </span>
        </nav>
      ) : null}
    </div>
  );
}

/** What the server found in the file. Shows progress while it checks, then every row with its problems. */
export function ReviewStep({
  api,
  batch,
  entity,
  canCommit,
  onChange,
  refresh,
  onStartOver,
}: {
  api: ImportApi;
  batch: ImportBatch;
  entity: ImportEntity | undefined;
  canCommit: boolean;
  onChange: (b: ImportBatch) => void;
  refresh: () => Promise<ImportBatch | null>;
  onStartOver: () => void;
}) {
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (batch.status !== 'validated') {
    return (
      <div className="space-y-3 rounded-xl border border-line bg-surface p-8 text-center" role="status" aria-live="polite">
        <p className="text-lg font-medium text-fg">Checking {batch.fileName}…</p>
        <p className="text-fg-muted">{batch.totalRows} rows. This usually takes a few seconds.</p>
      </div>
    );
  }

  const ready = batch.validRows + batch.warningRows;
  const blocked = batch.commitMode === 'all_or_nothing' && batch.errorRows > 0;

  const commit = async () => {
    setBusy(true);
    setError(null);
    try {
      onChange(await api.commit(batch.id));
      void refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };
  const downloadErrors = async () => {
    try {
      saveBlob(await api.errorsFile(batch.id), `${batch.fileName.replace(/\.[^.]+$/, '')}-to-fix.csv`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The file could not be downloaded.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-fg">{batch.fileName}</h2>
          <p className="text-sm text-fg-muted">Nothing has been saved yet.</p>
        </div>
        <Button variant="ghost" onClick={onStartOver}>
          Start over
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Rows in the file" value={batch.totalRows} />
        <Stat label="Ready to import" value={ready} tone="ok" />
        <Stat label="Need fixing" value={batch.errorRows} tone="bad" />
        <Stat label="With a note" value={batch.warningRows} tone="warn" />
      </div>

      {batch.failure ? (
        <p role="alert" className="rounded-lg border border-danger-line bg-danger-bg p-4 text-danger">
          {batch.failure}
        </p>
      ) : null}
      {(batch.fileProblems ?? []).map((p) => (
        <p key={p.message} className="rounded-lg border border-warning-line bg-warning-bg p-3 text-sm text-warning">
          {p.message}
        </p>
      ))}

      {blocked ? (
        <div role="alert" className="space-y-2 rounded-lg border border-line bg-surface p-4">
          <p className="font-medium text-fg">
            {batch.errorRows} {batch.errorRows === 1 ? 'row needs' : 'rows need'} fixing before this file can be imported.
          </p>
          <p className="text-sm text-fg-muted">Download the rows to fix, correct them in the file, and upload it again. Or start over and choose “Import the valid rows”.</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Show rows" className="inline-flex rounded-lg border border-line bg-surface p-1">
          {(
            [
              ['all', 'All rows'],
              ['error', `Need fixing (${batch.errorRows})`],
              ['valid', 'Ready'],
            ] as [Filter, string][]
          ).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)} className={cx('rounded-md border-0 px-3 py-1.5 text-sm font-medium', filter === k ? 'bg-accent text-on-accent' : 'bg-transparent text-fg-muted hover:text-fg')}>
              {label}
            </button>
          ))}
        </div>
        {batch.errorRows > 0 ? (
          <Button variant="secondary" size="sm" onClick={() => void downloadErrors()}>
            Download rows to fix
          </Button>
        ) : null}
      </div>

      <RowsTable api={api} batch={batch} entity={entity} filter={filter} />

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Button onClick={() => void commit()} disabled={blocked || ready === 0 || !canCommit} loading={busy}>
          {ready === 1 ? 'Import 1 row' : `Import ${ready} rows`}
        </Button>
        {!canCommit ? <p className="text-sm text-fg-muted">You can review this file, but only someone with import approval can import it.</p> : null}
        {canCommit && ready === 0 ? <p className="text-sm text-fg-muted">No row is ready to import.</p> : null}
      </div>
    </div>
  );
}
