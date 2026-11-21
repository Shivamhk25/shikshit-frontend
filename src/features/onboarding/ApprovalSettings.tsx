import { useEffect, useId, useState } from 'react';
import { ApiError } from '../../crud/client';
import { Button } from '../../design-system';
import type { ImportApi } from './importApi';

/**
 * The institute's switch for "a second person approves every import". Everyone with view access sees the state; only
 * someone who may manage it can change it. Turning approval off asks first, because it lets one person import data
 * without a second check. A change affects files uploaded from then on.
 */
export function ApprovalSettings({ api, canManage }: { api: ImportApi; canManage: boolean }) {
  const [required, setRequired] = useState<boolean | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  useEffect(() => {
    let stop = false;
    api
      .settings()
      .then((s) => !stop && setRequired(s.importApprovalRequired))
      .catch(() => !stop && setRequired(null));
    return () => {
      stop = true;
    };
  }, [api]);

  if (required === null) return null;

  const save = async (value: boolean) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const s = await api.updateSettings(value);
      setRequired(s.importApprovalRequired);
      setConfirming(false);
      setMessage(s.importApprovalRequired ? 'Approval is on. New files need a second person.' : 'Approval is off. New files can be imported by their uploader.');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = () => {
    if (required) setConfirming(true);
    else void save(true);
  };

  return (
    <section aria-labelledby={`${id}-h`} className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-6">
      <h2 id={`${id}-h`} className="m-0 text-lg font-semibold text-fg">
        Approval
      </h2>
      <label className="flex items-start gap-3">
        <input type="checkbox" checked={required} disabled={!canManage || busy} onChange={toggle} className="mt-1" />
        <span>
          <span className="block font-medium text-fg">Another person approves every import</span>
          <span className="block text-sm text-fg-muted">
            An admin or principal who did not upload a file approves it before it is imported. A change applies to files uploaded from then on; files already uploaded keep the rule they were uploaded under.
          </span>
        </span>
      </label>
      {!canManage ? <p className="m-0 text-sm text-fg-muted">Only someone who manages approval can change this.</p> : null}
      {confirming ? (
        <div role="group" aria-label="Confirm turning approval off" className="flex flex-col gap-2 rounded-lg border border-warning-line bg-warning-bg p-4">
          <p className="m-0 text-sm text-fg">Turn approval off? One person will be able to upload and import data without a second check.</p>
          <div className="flex gap-2">
            <Button variant="danger" size="sm" loading={busy} onClick={() => void save(false)}>
              Turn approval off
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
              Keep it on
            </Button>
          </div>
        </div>
      ) : null}
      {message ? (
        <p role="status" className="m-0 text-sm text-success">
          {message}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="m-0 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </section>
  );
}
