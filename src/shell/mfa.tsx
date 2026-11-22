import { useEffect, useState, type FormEvent } from 'react';
import { Check, Copy, Download, KeyRound, ShieldCheck, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, ConfirmDialog, Input } from '../design-system';
import { useAuth } from './AuthProvider';
import { API_BASE } from './web-session';

/** Two-step sign-in (FND-05) screens: the code step, setup with an authenticator app, recovery codes, and the
 * Profile card to turn it on or off. */

export const CODE_HINT = 'The 6-digit code from your authenticator app, or one of your recovery codes.';

/** A one-time code field: numeric keypad on phones, and the browser can fill it from an SMS-style autofill. */
export function CodeInput({ value, onChange, label = 'Code', error }: { value: string; onChange: (v: string) => void; label?: string; error?: string }) {
  return <Input label={label} value={value} onChange={(e) => onChange(e.target.value)} inputMode="text" autoComplete="one-time-code" autoCapitalize="none" spellCheck={false} autoFocus fieldSize="lg" leading={<KeyRound />} error={error} maxLength={20} />;
}

/** The secret to add to an authenticator app: a link that opens the app on a phone, and the key to type on a computer. */
export function SecretPanel({ secret, otpauthUri }: { secret: string; otpauthUri: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(secret.replace(/\s/g, ''));
      setCopied(true);
    } catch {
      toast.error('Copy did not work. Select the key and copy it.');
    }
  };
  return (
    <div className="space-y-4 rounded-lg border border-line-subtle bg-canvas p-5">
      <ol className="list-decimal space-y-1.5 pl-5 text-sm text-fg-muted">
        <li>Open an authenticator app: Google Authenticator, Microsoft Authenticator or similar.</li>
        <li>Add an account, choose to enter a key, and type the key below. If you are on your phone, tap “Open in app” instead.</li>
        <li>Type the 6-digit code the app shows.</li>
      </ol>
      <p className="break-all font-mono text-lg tracking-wider text-fg" data-testid="mfa-secret">
        {secret}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => void copy()}>
          {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
          {copied ? 'Copied' : 'Copy key'}
        </Button>
        <a href={otpauthUri} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-surface px-3 text-sm text-fg shadow-soft hover:border-line-strong">
          <Smartphone aria-hidden="true" className="size-4" />
          Open in app
        </a>
      </div>
    </div>
  );
}

/** Recovery codes, shown once: copy or download them before going on. */
export function RecoveryCodes({ codes }: { codes: string[] }) {
  const text = `Shikshit recovery codes\nEach works once, if you lose your phone.\n\n${codes.join('\n')}\n`;
  const download = () => {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'shikshit-recovery-codes.txt';
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div className="space-y-4">
      <p className="text-sm text-fg-muted">If you lose your phone, each of these codes signs you in once. Keep them somewhere safe; they are not shown again.</p>
      <ul className="grid grid-cols-2 gap-2 rounded-lg border border-line-subtle bg-canvas p-4 font-mono text-sm text-fg" data-testid="recovery-codes">
        {codes.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={() => void navigator.clipboard.writeText(text).then(() => toast.success('Copied'), () => toast.error('Copy did not work.'))}>
          <Copy aria-hidden="true" className="size-4" />
          Copy
        </Button>
        <Button size="sm" variant="secondary" onClick={download}>
          <Download aria-hidden="true" className="size-4" />
          Download
        </Button>
      </div>
    </div>
  );
}

/** After a first-time setup at sign-in, the app opens with the recovery codes until they are acknowledged. */
export function RecoveryCodesDialog() {
  const { recoveryCodes, dismissRecoveryCodes } = useAuth();
  if (!recoveryCodes) return null;
  return (
    <ConfirmDialog open title="Two-step sign-in is on" onClose={dismissRecoveryCodes} className="max-w-lg">
      <RecoveryCodes codes={recoveryCodes} />
      <Button className="mt-5" onClick={dismissRecoveryCodes}>
        I have saved them
      </Button>
    </ConfirmDialog>
  );
}

type Status = { enabled: boolean; required: boolean; recoveryCodesLeft: number };

async function call<T>(doFetch: typeof fetch, method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const res = await doFetch(`${API_BASE}${path}`, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  if (!res.ok) {
    let detail = 'Something went wrong. Please try again.';
    try {
      detail = ((await res.json()) as { detail?: string }).detail ?? detail;
    } catch {
      /* not JSON */
    }
    throw new Error(detail);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

/** Profile card: two-step sign-in status, turning it on (secret, first code, recovery codes) and off. */
export function TwoStepCard() {
  const { session } = useAuth();
  const doFetch: typeof fetch = (...a) => session.fetch(...a);
  const [status, setStatus] = useState<Status | null>(null);
  const [setup, setSetup] = useState<{ secret: string; otpauthUri: string } | null>(null);
  const [codes, setCodes] = useState<string[] | null>(null);
  const [turningOff, setTurningOff] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = () =>
    call<Status>(doFetch, 'GET', '/me/mfa')
      .then(setStatus)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Something went wrong.'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void load(), []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };
  const start = () => run(async () => setSetup(await call(doFetch, 'POST', '/me/mfa/setup')));
  const confirm = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const r = await call<{ recoveryCodes: string[] }>(doFetch, 'POST', '/me/mfa/confirm', { code: code.trim() });
      setCodes(r.recoveryCodes);
      setSetup(null);
      setCode('');
      await load();
    });
  };
  const turnOff = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await call(doFetch, 'POST', '/me/mfa/disable', { code: code.trim() });
      setTurningOff(false);
      setCode('');
      toast.success('Two-step sign-in is off');
      await load();
    });
  };

  return (
    <Card className="max-w-2xl space-y-4 p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent-subtle text-accent-fg">
          <ShieldCheck aria-hidden="true" className="size-5" />
        </span>
        <div className="space-y-1">
          <h2 className="font-display text-lg font-semibold text-fg">Two-step sign-in</h2>
          <p className="text-sm text-fg-muted">
            {!status
              ? 'Loading…'
              : status.enabled
                ? `On. Signing in asks for a code from your authenticator app. ${status.recoveryCodesLeft} recovery codes left.`
                : 'Off. Turn it on so a stolen password alone cannot open your account.'}
          </p>
          {status?.required ? <p className="text-sm text-fg-muted">Your school requires it for your account.</p> : null}
        </div>
      </div>
      {codes ? (
        <>
          <RecoveryCodes codes={codes} />
          <Button size="sm" onClick={() => setCodes(null)}>
            I have saved them
          </Button>
        </>
      ) : setup ? (
        <form onSubmit={confirm} className="space-y-4" noValidate>
          <SecretPanel secret={setup.secret} otpauthUri={setup.otpauthUri} />
          <CodeInput value={code} onChange={setCode} label="Code from the app" />
          <div className="flex gap-2">
            <Button type="submit" loading={busy} disabled={!code.trim()}>
              Turn on
            </Button>
            <Button type="button" variant="secondary" onClick={() => setSetup(null)}>
              Cancel
            </Button>
          </div>
        </form>
      ) : status && !status.enabled ? (
        <Button onClick={() => void start()} loading={busy}>
          Turn on two-step sign-in
        </Button>
      ) : status && !status.required ? (
        <Button variant="danger" onClick={() => setTurningOff(true)}>
          Turn off
        </Button>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
      {turningOff ? (
        <ConfirmDialog open title="Turn off two-step sign-in?" onClose={() => setTurningOff(false)}>
          <form onSubmit={turnOff} className="space-y-4" noValidate>
            <p className="text-sm text-fg-muted">Your password alone will open your account again. Enter a current code to confirm.</p>
            <CodeInput value={code} onChange={setCode} />
            <div className="flex gap-2">
              <Button type="submit" variant="destructive" loading={busy} disabled={!code.trim()}>
                Turn off
              </Button>
              <Button type="button" variant="secondary" onClick={() => setTurningOff(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </ConfirmDialog>
      ) : null}
    </Card>
  );
}
