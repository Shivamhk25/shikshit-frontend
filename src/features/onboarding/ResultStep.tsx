import { useState } from 'react';
import { ApiError } from '../../crud/client';
import { Button } from '../../design-system';
import { formatDate } from './format';
import type { ImportApi, ImportBatch, ImportEntity } from './importApi';

function Bar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-subtle" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label="Progress">
      <div className="h-full bg-accent transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Progress while importing or rolling back, then the outcome, with the undo while it is still allowed. */
export function ResultStep({
  api,
  batch,
  entity,
  canRollback,
  onChange,
  refresh,
  onDone,
}: {
  api: ImportApi;
  batch: ImportBatch;
  entity: ImportEntity | undefined;
  canRollback: boolean;
  onChange: (b: ImportBatch) => void;
  refresh: () => Promise<ImportBatch | null>;
  onDone: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const noun = entity?.title.toLowerCase() ?? 'records';

  if (batch.status === 'committing' || batch.status === 'rolling_back') {
    const word = batch.status === 'committing' ? 'Importing' : 'Rolling back';
    return (
      <div className="space-y-4 rounded-xl border border-line bg-surface p-8" role="status" aria-live="polite">
        <p className="text-lg font-medium text-fg">
          {word} {batch.fileName}…
        </p>
        <Bar done={batch.progressDone} total={batch.progressTotal} />
        <p className="text-sm text-fg-muted">
          {batch.progressDone} of {batch.progressTotal}. You can leave this page; it carries on.
        </p>
      </div>
    );
  }

  if (batch.status === 'rejected') {
    return (
      <div className="space-y-4 rounded-xl border border-line bg-surface p-8" role="status">
        <p className="m-0 text-lg font-medium text-fg">This file was rejected. Nothing was imported.</p>
        {batch.rejectReason ? (
          <p className="m-0 text-fg">
            <span className="text-fg-muted">Reason: </span>
            {batch.rejectReason}
          </p>
        ) : null}
        <p className="m-0 text-sm text-fg-muted">Correct the data and upload the file again.</p>
        <Button onClick={onDone}>Back to imports</Button>
      </div>
    );
  }

  if (batch.status === 'failed') {
    return (
      <div className="space-y-4 rounded-xl border border-danger-line bg-danger-bg p-8" role="alert">
        <p className="text-lg font-medium text-danger">This file could not be processed.</p>
        <p className="text-fg">{batch.failure ?? 'Something went wrong. Nothing was saved.'}</p>
        <Button variant="secondary" onClick={onDone}>
          Back to imports
        </Button>
      </div>
    );
  }

  const rollback = async () => {
    setBusy(true);
    setError(null);
    try {
      onChange(await api.rollback(batch.id));
      setConfirming(false);
      void refresh();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (batch.status === 'rolled_back') {
    const kept = batch.committedRows - batch.revertedRows;
    return (
      <div className="space-y-4 rounded-xl border border-line bg-surface p-8" role="status">
        <p className="text-lg font-medium text-fg">
          Rolled back {batch.revertedRows} of {batch.committedRows} {noun}.
        </p>
        {kept > 0 ? <p className="text-fg-muted">{kept === 1 ? '1 record was' : `${kept} records were`} changed after the import, so they were left as they are.</p> : null}
        <Button onClick={onDone}>Back to imports</Button>
      </div>
    );
  }

  // committed
  return (
    <div className="space-y-5 rounded-xl border border-line bg-surface p-8">
      <div role="status" className="space-y-1">
        <p className="text-lg font-medium text-success">{batch.committedRows === 1 ? '1 row imported.' : `${batch.committedRows} rows imported.`}</p>
        <p className="text-fg-muted">
          {entity?.title ?? 'Your data'} is now available across the app.
          {batch.errorRows > 0 ? ` ${batch.errorRows} ${batch.errorRows === 1 ? 'row was' : 'rows were'} skipped because of problems.` : ''}
        </p>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onDone}>Done</Button>
        {canRollback && batch.rollbackDeadline ? (
          confirming ? (
            <span className="flex flex-wrap items-center gap-2" role="group" aria-label="Confirm rollback">
              <span className="text-sm text-fg">Undo this import? Records you have edited since will be kept.</span>
              <Button variant="danger" size="sm" loading={busy} onClick={() => void rollback()}>
                Yes, roll back
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                Keep it
              </Button>
            </span>
          ) : (
            <Button variant="secondary" onClick={() => setConfirming(true)}>
              Roll back
            </Button>
          )
        ) : null}
      </div>
      {canRollback && batch.rollbackDeadline ? <p className="text-sm text-fg-muted">You can undo this until {formatDate(batch.rollbackDeadline)}.</p> : null}
    </div>
  );
}
