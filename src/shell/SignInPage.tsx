import { useState, type FormEvent } from 'react';
import { CODE_HINT, CodeInput, SecretPanel } from './mfa';
import { BookOpenCheck, KeyRound, Lock, ShieldCheck, UserRound } from 'lucide-react';
import { Button, Input, Logo } from '../design-system';
import { useAuth } from './AuthProvider';

const POINTS = [
  { icon: BookOpenCheck, title: 'One record for every learner', text: 'Classes, enrolments and guardians kept in one careful register.' },
  { icon: ShieldCheck, title: 'Access that follows each role', text: 'Teachers see their own sections; the office sees the whole school.' },
  { icon: KeyRound, title: 'Every change accounted for', text: 'Reads and edits of student records are written to an audit trail.' },
];

/** The fine diagonal lines behind the brand panel, drawn as a repeating SVG so nothing is downloaded. */
const PATTERN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpath d='M0 24L24 0' stroke='%23ffffff' stroke-opacity='0.05' stroke-width='1'/%3E%3C/svg%3E\")";

/** Where sign-in is: the password, then (two-step sign-in, FND-05) a code, or a first-time setup. */
type Step = { kind: 'password' } | { kind: 'verify'; token: string } | { kind: 'setup'; token: string; secret?: string; otpauthUri?: string };

export function SignInPage() {
  const { signIn, verifyMfa, startMfaSetup, confirmMfaSetup } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<Step>({ kind: 'password' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const restart = (message: string) => {
    setStep({ kind: 'password' });
    setPassword('');
    setCode('');
    setError(message);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (step.kind === 'password') {
      if (!username.trim() || !password) return setError('Enter your username and password.');
      setBusy(true);
      const r = await signIn(username, password);
      if (!r.ok && r.code === 'mfa_required' && 'challengeToken' in r) {
        if (r.step === 'setup') {
          const s = await startMfaSetup(r.challengeToken);
          setStep(s.ok ? { kind: 'setup', token: r.challengeToken, secret: s.secret, otpauthUri: s.otpauthUri } : { kind: 'password' });
          if (!s.ok) setError(s.message);
        } else setStep({ kind: 'verify', token: r.challengeToken });
      } else if (!r.ok) setError(r.message);
      setBusy(false);
      return;
    }
    if (!code.trim()) return setError('Enter the code.');
    setBusy(true);
    const r = step.kind === 'verify' ? await verifyMfa(step.token, code) : await confirmMfaSetup(step.token, code);
    setBusy(false);
    if (r.ok) return;
    if (r.code === 'challenge_expired' || r.code === 'account_locked') restart(r.message);
    else {
      setCode('');
      setError(r.message);
    }
  };

  const title = step.kind === 'password' ? 'Sign in' : step.kind === 'verify' ? 'Enter your code' : 'Set up two-step sign-in';
  const intro =
    step.kind === 'password'
      ? 'Use the username and password your school gave you.'
      : step.kind === 'verify'
        ? 'Open your authenticator app and type the 6-digit code for Shikshit.'
        : 'Your school asks administrators to confirm each sign-in with a phone app. It takes a minute, once.';

  return (
    <div className="grid min-h-screen bg-canvas lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <aside
        className="relative hidden overflow-hidden bg-brand-ink text-white lg:flex lg:flex-col lg:justify-between lg:p-14 xl:p-20"
        style={{ backgroundImage: `radial-gradient(110% 70% at 0% 0%, rgba(184,147,90,0.10), transparent 55%), radial-gradient(90% 70% at 100% 100%, rgba(13,26,45,0.9), transparent 60%), ${PATTERN}` }}
      >
        <Logo tone="light" size={40} />
        <div className="max-w-lg space-y-10">
          <div className="space-y-5">
            <span aria-hidden="true" className="block h-px w-14 bg-brand-gold" />
            <p className="font-display text-[2.75rem] font-medium leading-[1.12] tracking-tight">The quiet, dependable system behind a well-run school.</p>
            <p className="text-base leading-relaxed text-white/70">Admissions, academics and the daily record of every learner, in one place your whole staff can trust.</p>
          </div>
          <ul className="space-y-5">
            {POINTS.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-4">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-white/15 bg-white/5 text-brand-gold-soft">
                  <Icon aria-hidden="true" className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-white">{title}</span>
                  <span className="block text-sm text-white/65">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-xs text-white/45">© {new Date().getFullYear()} Shikshit</p>
      </aside>

      <main className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-[400px]">
          <div className="mb-10 lg:hidden">
            <Logo size={36} />
          </div>
          <form onSubmit={(e) => void submit(e)} noValidate aria-labelledby="signin-title" className="space-y-7">
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-accent-fg">
                <span aria-hidden="true" className="h-px w-6 bg-brand-gold" />
                Your school workspace
              </p>
              <h1 id="signin-title" className="font-display text-4xl font-semibold tracking-tight text-fg">
                {title}
              </h1>
              <p className="text-sm text-fg-muted">{intro}</p>
            </div>
            {step.kind !== 'password' ? (
              <div className="space-y-5">
                {step.kind === 'setup' && step.secret && step.otpauthUri ? <SecretPanel secret={step.secret} otpauthUri={step.otpauthUri} /> : null}
                <CodeInput value={code} onChange={setCode} label={step.kind === 'setup' ? 'Code from the app' : 'Code'} />
                {step.kind === 'verify' ? <p className="text-sm text-fg-muted">{CODE_HINT}</p> : null}
              </div>
            ) : (
            <div className="space-y-5">
              <Input
                label="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
                fieldSize="lg"
                leading={<UserRound />}
              />
              <Input
                label="Password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                fieldSize="lg"
                leading={<Lock />}
                revealable
              />
            </div>
            )}
            {error ? (
              <p role="alert" className="rounded-md border border-danger-line bg-danger-bg px-4 py-3 text-sm text-danger">
                {error}
              </p>
            ) : null}
            <Button type="submit" size="lg" loading={busy} className="w-full">
              {step.kind === 'password' ? 'Sign in' : step.kind === 'verify' ? 'Continue' : 'Turn on and sign in'}
            </Button>
            {step.kind === 'password' ? (
              <p className="border-t border-line-subtle pt-6 text-center text-sm text-fg-muted">Trouble signing in? Your school administrator can reset your password.</p>
            ) : (
              <p className="border-t border-line-subtle pt-6 text-center text-sm text-fg-muted">
                Lost your phone? Use a recovery code, or ask your school administrator to reset two-step sign-in.{' '}
                <button type="button" className="font-medium text-accent-fg hover:underline" onClick={() => restart('')}>
                  Start again
                </button>
              </p>
            )}
          </form>
        </div>
      </main>
    </div>
  );
}
