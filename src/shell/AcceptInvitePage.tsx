import { useState, type FormEvent } from 'react';
import { CheckCircle2, Lock } from 'lucide-react';
import { Button, Input, Logo } from '../design-system';
import { acceptInvite } from '../features/iam/usersApi';
import { API_BASE } from './web-session';

const MIN = 10;

/**
 * Public page behind an invite or password-reset link (/accept-invite?token=…). It sets the password and sends the
 * person to sign in. The token is read from the address once and never stored.
 */
export function AcceptInvitePage({ token = new URLSearchParams(window.location.search).get('token') ?? '', submit = acceptInvite }: { token?: string; submit?: typeof acceptInvite }) {
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const send = async (e: FormEvent) => {
    e.preventDefault();
    if (password.length < MIN) return setError(`Use at least ${MIN} characters. A short sentence is easy to remember.`);
    if (password !== repeat) return setError('The two passwords are not the same.');
    setBusy(true);
    setError(null);
    try {
      await submit(API_BASE, token, password);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-6 py-12">
      <div className="w-full max-w-[400px] space-y-10">
        <Logo size={36} />
        {!token ? (
          <p role="alert" className="text-sm text-fg-muted">
            This link is incomplete. Open the whole link from your message, or ask your school administrator for a new one.
          </p>
        ) : done ? (
          <div className="space-y-5" role="status">
            <CheckCircle2 aria-hidden="true" className="size-8 text-success" />
            <h1 className="font-display text-3xl font-semibold tracking-tight text-fg">Your password is set</h1>
            <p className="text-sm text-fg-muted">You can sign in now with your username and this password.</p>
            <a href="/" className="inline-flex h-12 w-full items-center justify-center rounded-md bg-accent px-5 text-md font-medium text-on-accent shadow-soft hover:bg-accent-hover">
              Go to sign in
            </a>
          </div>
        ) : (
          <form onSubmit={(e) => void send(e)} noValidate aria-labelledby="invite-title" className="space-y-7">
            <div className="space-y-2">
              <h1 id="invite-title" className="font-display text-4xl font-semibold tracking-tight text-fg">
                Set your password
              </h1>
              <p className="text-sm text-fg-muted">Choose at least {MIN} characters. Do not use your username.</p>
            </div>
            <div className="space-y-5">
              <Input label="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" autoFocus fieldSize="lg" leading={<Lock />} revealable />
              <Input label="Type it again" type="password" value={repeat} onChange={(e) => setRepeat(e.target.value)} autoComplete="new-password" fieldSize="lg" leading={<Lock />} revealable />
            </div>
            {error ? (
              <p role="alert" className="rounded-md border border-danger-line bg-danger-bg px-4 py-3 text-sm text-danger">
                {error}
              </p>
            ) : null}
            <Button type="submit" size="lg" loading={busy} className="w-full">
              Set password
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
