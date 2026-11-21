import { useId, useRef, useState, type DragEvent } from 'react';
import { ApiError } from '../../crud/client';
import { Button, cx } from '../../design-system';
import { COMMIT_MODES, STRATEGIES, fileProblem, saveBlob } from './format';
import type { CommitMode, ImportApi, ImportBatch, ImportEntity, Strategy } from './importApi';

function Choice<T extends string>({ legend, options, value, onChange }: { legend: string; options: { value: T; label: string; hint: string }[]; value: T; onChange: (v: T) => void }) {
  const name = useId();
  return (
    <fieldset className="m-0 min-w-0 space-y-2 border-0 p-0">
      <legend className="mb-2 p-0 text-sm font-medium text-fg">{legend}</legend>
      <div className="space-y-2">
        {options.map((o) => (
          <label key={o.value} className={cx('flex cursor-pointer gap-3 rounded-lg border p-3', value === o.value ? 'border-accent bg-accent-subtle' : 'border-line bg-surface hover:bg-subtle')}>
            <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} className="mt-1" />
            <span>
              <span className="block font-medium text-fg">{o.label}</span>
              <span className="block text-sm text-fg-muted">{o.hint}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Choose what to import and how, then pick the file. Checking the file starts as soon as it is uploaded. */
export function PrepareStep({ api, entities, canImport, onUploaded, entityKey, onEntityChange }: { api: ImportApi; entities: ImportEntity[]; canImport: boolean; onUploaded: (b: ImportBatch) => void; entityKey: string; onEntityChange: (key: string) => void }) {
  const [strategy, setStrategy] = useState<Strategy>('upsert');
  const [commitMode, setCommitMode] = useState<CommitMode>('all_or_nothing');
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const selectId = useId();
  const entity = entities.find((e) => e.key === entityKey);

  if (entities.length === 0) {
    return (
      <div className="rounded-lg border border-line bg-surface p-6" role="status">
        <p className="font-medium text-fg">Nothing to import yet</p>
        <p className="text-fg-muted">You do not have access to any kind of data that can be imported. Ask your school administrator if you need it.</p>
      </div>
    );
  }

  const choose = (f: File | undefined) => {
    setError(null);
    if (!f) return;
    const problem = fileProblem(f);
    setFileError(problem);
    setFile(problem ? null : f);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    choose(e.dataTransfer.files[0]);
  };

  const downloadTemplate = async () => {
    setError(null);
    try {
      saveBlob(await api.template(entityKey), `${entityKey}-template.csv`);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'The template could not be downloaded.');
    }
  };

  const submit = async () => {
    if (!file || !entity) return;
    setBusy(true);
    setError(null);
    try {
      onUploaded(await api.upload({ entity: entity.key, strategy, commitMode, file }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-5 rounded-xl border border-line bg-surface p-6">
        <div className="space-y-1">
          <label htmlFor={selectId} className="text-sm font-medium text-fg">
            What are you importing?
          </label>
          <select id={selectId} value={entityKey} onChange={(e) => onEntityChange(e.target.value)} className="h-10 w-full rounded-md border border-line bg-surface px-3 text-base text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring">
            {entities.map((e) => (
              <option key={e.key} value={e.key}>
                {e.title}
              </option>
            ))}
          </select>
        </div>
        {entity ? (
          <div className="space-y-2 rounded-lg bg-subtle p-4">
            <p className="m-0 text-sm font-medium text-fg">Columns in the file</p>
            <ul className="m-0 list-none space-y-1 p-0 text-sm text-fg-muted">
              {entity.columns.map((c) => (
                <li key={c.key}>
                  <span className="font-medium text-fg">{c.label}</span>
                  {c.required ? <span className="text-danger"> required</span> : null}
                  {c.hint ? ` · ${c.hint}` : c.allowed && c.allowed.length > 0 ? ` · one of ${c.allowed.join(', ')}` : ''}
                </li>
              ))}
            </ul>
            <Button variant="secondary" size="sm" onClick={() => void downloadTemplate()} disabled={!canImport}>
              Download the CSV template
            </Button>
          </div>
        ) : null}
        <Choice legend="If a code is already in the system" options={STRATEGIES} value={strategy} onChange={setStrategy} />
        <Choice legend="When some rows have problems" options={COMMIT_MODES} value={commitMode} onChange={setCommitMode} />
      </div>

      <div className="space-y-4 rounded-xl border border-line bg-surface p-6">
        <p className="text-sm font-medium text-fg">Your file</p>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cx('flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-6 text-center', dragging ? 'border-accent bg-accent-subtle' : 'border-line-strong bg-canvas')}
        >
          {file ? (
            <>
              <p className="font-medium text-fg">{file.name}</p>
              <p className="text-sm text-fg-muted">{(file.size / 1024).toFixed(file.size < 10240 ? 1 : 0)} KB</p>
            </>
          ) : (
            <>
              <p className="font-medium text-fg">Drop a file here</p>
              <p className="text-sm text-fg-muted">CSV or Excel (.xlsx), up to 10 MB and 20,000 rows</p>
            </>
          )}
          <input ref={input} type="file" accept=".csv,.xlsx" className="sr-only" aria-label="Choose a file" disabled={!canImport} onChange={(e) => choose(e.target.files?.[0])} />
          <Button variant="secondary" onClick={() => input.current?.click()} disabled={!canImport}>
            {file ? 'Choose a different file' : 'Choose a file'}
          </Button>
        </div>
        {fileError ? (
          <p role="alert" className="text-sm text-danger">
            {fileError}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        ) : null}
        {!canImport ? <p className="text-sm text-fg-muted">You can look at imports but not start one. Ask your school administrator for access.</p> : null}
        <Button onClick={() => void submit()} disabled={!file || !canImport} loading={busy} className="w-full">
          Check my file
        </Button>
        <p className="text-sm text-fg-muted">Checking changes nothing. You will see every row and its problems before anything is saved.</p>
      </div>
    </div>
  );
}
