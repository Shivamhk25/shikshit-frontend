import { useState, type FormEvent } from 'react';
import { Button, Input } from '../design-system';
import { useAuth } from './AuthProvider';

export function SignInPage() {
  const { signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('Enter your username and password.');
      return;
    }
    setBusy(true);
    setError(null);
    const result = await signIn(username, password);
    setBusy(false);
    if (!result.ok) setError(result.message);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <form onSubmit={(e) => void submit(e)} className="w-full max-w-sm space-y-5 rounded-lg border border-line bg-surface p-8" aria-labelledby="signin-title">
        <div className="space-y-1">
          <h1 id="signin-title" className="text-xl font-semibold text-fg">
            Sign in
          </h1>
          <p className="text-sm text-fg-muted">Use the username and password your school gave you.</p>
        </div>
        <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoCapitalize="none" autoFocus />
        <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" error={error ?? undefined} />
        <Button type="submit" loading={busy} className="w-full">
          Sign in
        </Button>
      </form>
    </main>
  );
}
