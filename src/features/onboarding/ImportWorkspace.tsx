import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError } from '../../crud/client';
import { Button, cx } from '../../design-system';
import { useAccessState } from '../../shell/AccessProvider';
import { useAuth } from '../../shell/AuthProvider';
import { API_BASE } from '../../shell/web-session';
import { createImportApi, SETTLED, type ImportApi, type ImportBatch, type ImportEntity, type ImportPack } from './importApi';
import { PackPanel } from './PackPanel';
import { STATUS_LABEL, formatDate } from './format';
import { pollConfig } from './pollConfig';
import { PrepareStep } from './PrepareStep';
import { ResultStep } from './ResultStep';
import { ReviewStep } from './ReviewStep';

const STEPS = ['Prepare', 'Review', 'Import'] as const;


function stepOf(b: ImportBatch | null): number {
  if (!b) return 0;
  if (b.status === 'uploaded' || b.status === 'validating' || b.status === 'validated') return 1;
  return 2;
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="m-0 flex list-none items-center gap-2 p-0 text-sm" aria-label="Progress">
      {STEPS.map((s, i) => (
        <li key={s} className="flex items-center gap-2" aria-current={i === current ? 'step' : undefined}>
          <span
            className={cx(
              'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
              i < current ? 'bg-success-bg text-success' : i === current ? 'bg-accent text-on-accent' : 'bg-subtle text-fg-muted',
            )}
            aria-hidden="true"
          >
            {i < current ? '✓' : i + 1}
          </span>
          <span className={cx(i === current ? 'font-medium text-fg' : 'text-fg-muted')}>{s}</span>
          {i < STEPS.length - 1 ? <span className="mx-1 h-px w-8 bg-line" aria-hidden="true" /> : null}
        </li>
      ))}
    </ol>
  );
}

/** Loads a batch and keeps it fresh until it settles (checked, imported, rolled back or failed). */
function useBatch(api: ImportApi, id: string | null, pollMs: number) {
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return null;
    try {
      const b = await api.batch(id);
      setBatch(b);
      setError(null);
      return b;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      return null;
    }
  }, [api, id]);

  useEffect(() => {
    setBatch(null);
    setError(null);
  }, [id]);

  // Poll while the work runs in the background: after upload (checking), after commit (importing) and after a
  // rollback. It follows the status, so an action that restarts the work restarts the polling too. A failed poll
  // is retried after the same wait.
  const working = id !== null && (batch === null || !SETTLED.includes(batch.status));
  useEffect(() => {
    if (!working) return undefined;
    const t = setTimeout(() => void refresh(), batch || error ? pollMs : 0);
    return () => clearTimeout(t);
  }, [working, batch, error, refresh, pollMs]);

  return { batch, setBatch, error, refresh };
}

function RecentImports({ api, entities, onOpen, version }: { api: ImportApi; entities: ImportEntity[]; onOpen: (id: string) => void; version: number }) {
  const [items, setItems] = useState<ImportBatch[] | null>(null);
  useEffect(() => {
    let stop = false;
    api
      .batches(1, 8)
      .then((p) => !stop && setItems(p.items))
      .catch(() => !stop && setItems([]));
    return () => {
      stop = true;
    };
  }, [api, version]);
  const title = (key: string) => entities.find((e) => e.key === key)?.title ?? key;
  if (!items || items.length === 0) return null;
  return (
    <section aria-labelledby="recent-h" className="space-y-3">
      <h2 id="recent-h" className="text-lg font-semibold text-fg">
        Recent files
      </h2>
      <ul className="m-0 list-none divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface p-0">
        {items.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="m-0 truncate font-medium text-fg">{b.fileName}</p>
              <p className="m-0 text-sm text-fg-muted">
                {title(b.entity)} · {b.totalRows} rows · {formatDate(b.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-subtle px-2.5 py-0.5 text-xs font-medium text-fg-muted">{STATUS_LABEL[b.status]}</span>
              <Button variant="secondary" size="sm" onClick={() => onOpen(b.id)} aria-label={`Open ${b.fileName}`}>
                Open
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * The data-import workspace: prepare a file, review what was found, import it, and undo it if needed.
 * Everything the server decides (what can be imported, who may commit) is read from the API; the buttons shown here
 * only follow the permissions so people are not offered what would be refused.
 */
export function ImportWorkspace({ pollMs = pollConfig.ms }: { pollMs?: number }) {
  const { session } = useAuth();
  const access = useAccessState();
  const api = useMemo(() => createImportApi(session, API_BASE), [session]);
  const [entities, setEntities] = useState<ImportEntity[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string | null>(null);
  const [listVersion, setListVersion] = useState(0);
  const [pack, setPack] = useState<ImportPack | null>(null);
  const [chosen, setChosen] = useState('');
  const prepare = useRef<HTMLDivElement>(null);
  const { batch, setBatch, error, refresh } = useBatch(api, batchId, pollMs);
  const heading = useRef<HTMLHeadingElement>(null);

  const loadEntities = useCallback(() => {
    setLoadError(null);
    api
      .entities()
      .then(setEntities)
      .catch((e) => setLoadError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.'));
  }, [api]);
  useEffect(loadEntities, [loadEntities]);

  // The setup checklist is optional: a caller without the pack's domain permission gets a 404 and simply sees no panel.
  useEffect(() => {
    let stop = false;
    api
      .pack('academic')
      .then((p) => !stop && setPack(p))
      .catch(() => !stop && setPack(null));
    return () => {
      stop = true;
    };
  }, [api, listVersion]);

  const step = stepOf(batch);
  useEffect(() => {
    heading.current?.focus();
  }, [step]);

  if (access.phase !== 'ready') return null;
  const entityKey = entities?.some((e) => e.key === chosen) ? chosen : (entities?.[0]?.key ?? '');
  const can = (code: string) => access.access.can(code);

  const reset = () => {
    setBatchId(null);
    setListVersion((v) => v + 1);
  };

  return (
    <section className="space-y-6">
      <header className="space-y-3">
        <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold text-fg focus:outline-none">
          Import data
        </h1>
        <p className="max-w-2xl text-fg-muted">Bring your existing records in from a spreadsheet. Nothing is saved until you have reviewed the file and chosen to import it.</p>
        <Stepper current={step} />
      </header>

      {loadError ? (
        <div role="alert" className="space-y-3 rounded-lg border border-line bg-surface p-6">
          <p className="text-fg">{loadError}</p>
          <Button variant="secondary" onClick={loadEntities}>
            Try again
          </Button>
        </div>
      ) : !entities ? (
        <p role="status" className="text-fg-muted">
          Loading…
        </p>
      ) : (
        <>
          {!batchId ? (
            <>
              {pack ? (
                <PackPanel
                  pack={pack}
                  entities={entities}
                  canImport={can('onb.imports.import')}
                  selected={entityKey}
                  onChoose={(k) => {
                    setChosen(k);
                    if (typeof prepare.current?.scrollIntoView === 'function') prepare.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                />
              ) : null}
              <div ref={prepare} className="scroll-mt-4">
                <PrepareStep
                  api={api}
                  entities={entities}
                  entityKey={entityKey}
                  onEntityChange={setChosen}
                  canImport={can('onb.imports.import')}
                  onUploaded={(b) => {
                    setBatch(b);
                    setBatchId(b.id);
                  }}
                />
              </div>
              <RecentImports api={api} entities={entities} version={listVersion} onOpen={setBatchId} />
            </>
          ) : !batch ? (
            error ? (
              <div role="alert" className="space-y-3 rounded-lg border border-line bg-surface p-6">
                <p className="text-fg">{error}</p>
                <Button variant="secondary" onClick={reset}>
                  Back
                </Button>
              </div>
            ) : (
              <p role="status" className="text-fg-muted">
                Loading…
              </p>
            )
          ) : step === 1 ? (
            <ReviewStep api={api} batch={batch} entity={entities.find((e) => e.key === batch.entity)} canCommit={can('onb.imports.commit')} onChange={setBatch} refresh={refresh} onStartOver={reset} />
          ) : (
            <ResultStep api={api} batch={batch} entity={entities.find((e) => e.key === batch.entity)} canRollback={can('onb.imports.rollback')} onChange={setBatch} refresh={refresh} onDone={reset} />
          )}
        </>
      )}
    </section>
  );
}
