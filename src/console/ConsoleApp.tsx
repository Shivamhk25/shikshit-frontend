import { createContext, useContext, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { Link, NavLink, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { Building2, Lock, LogOut, Mail, ShieldCheck, Users } from 'lucide-react';
import { Toaster } from 'sonner';
import { Button, Input, Logo, ThemeProvider, cx } from '../design-system';
import { CodeInput, SecretPanel } from '../shell/mfa';
import { createPlatformSession, type Challenge, type PlatformMe, type PlatformSession } from './platform-session';
import { InstituteDetailPage, InstitutesPage, NewInstitutePage } from './institutes';
import { ConsoleAcceptInvite, TeamPage } from './team';

/** The Super Admin console (SAD-01..03, decision 0017): its own sign-in, always two-step, and its own session. */

type State = { phase: 'loading' } | { phase: 'signedOut' } | { phase: 'signedIn'; me: PlatformMe };

const ConsoleContext = createContext<{ session: PlatformSession; me: PlatformMe | null; signOut: () => Promise<void> } | null>(null);

// eslint-disable-next-line react-refresh/only-export-components
export function useConsole() {
  const c = useContext(ConsoleContext);
  if (!c) throw new Error('useConsole must be used inside <ConsoleApp>');
  return c;
}

export function ConsoleApp({ session: injected, fetchFn }: { session?: PlatformSession; fetchFn?: typeof fetch }) {
  const session = useMemo(() => injected ?? createPlatformSession(), [injected]);
  const [state, setState] = useState<State>({ phase: 'loading' });
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const loadMe = async () => {
    const res = await session.fetch('/platform/me');
    if (!res.ok) return setState({ phase: 'signedOut' });
    setState({ phase: 'signedIn', me: (await res.json()) as PlatformMe });
  };
  useEffect(() => {
    void session.restore().then((ok) => (ok ? loadMe() : setState({ phase: 'signedOut' })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  const signOut = async () => {
    await session.logout();
    setState({ phase: 'signedOut' });
  };
  const value = { session, me: state.phase === 'signedIn' ? state.me : null, signOut };

  return (
    <ThemeProvider initialChoice="light">
      <ConsoleContext.Provider value={value}>
        {pathname === '/accept-invite' ? (
          <ConsoleAcceptInvite fetchFn={fetchFn} onDone={() => navigate('/', { replace: true })} />
        ) : state.phase === 'loading' ? (
          <div role="status" className="flex min-h-screen items-center justify-center bg-canvas text-sm text-fg-muted">
            Loading…
          </div>
        ) : state.phase === 'signedOut' ? (
          <ConsoleSignIn onSignedIn={() => void loadMe()} />
        ) : (
          <ConsoleShell>
            <Routes>
              <Route index element={<InstitutesPage />} />
              <Route path="new" element={<NewInstitutePage />} />
              <Route path="institutes/:id" element={<InstituteDetailPage />} />
              <Route path="team" element={<TeamPage />} />
              <Route path="*" element={<InstitutesPage />} />
            </Routes>
          </ConsoleShell>
        )}
        <Toaster position="bottom-right" toastOptions={{ classNames: { toast: '!rounded-lg !border !border-line-subtle !bg-surface !text-fg !shadow-float !font-sans' } }} />
      </ConsoleContext.Provider>
    </ThemeProvider>
  );
}

function ConsoleShell({ children }: { children: ReactNode }) {
  const { me, signOut } = useConsole();
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-canvas text-fg">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-brand-ink text-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:gap-6 sm:px-8">
          <Link to="/" className="flex items-center gap-3" aria-label="Institutes">
            <Logo tone="light" size={28} />
            <span className="hidden rounded-full border border-brand-gold/40 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-brand-gold-soft sm:inline">Platform</span>
          </Link>
          <nav className="flex flex-1 items-center gap-1 text-sm">
            <NavLink end to="/" className={({ isActive }) => cx('flex items-center gap-2 rounded-md px-3 py-1.5', isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:text-white')}>
              <Building2 aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">Institutes</span>
              <span className="sr-only sm:hidden">Institutes</span>
            </NavLink>
            <NavLink to="/team" className={({ isActive }) => cx('flex items-center gap-2 rounded-md px-3 py-1.5', isActive ? 'bg-white/10 text-white' : 'text-white/70 hover:text-white')}>
              <Users aria-hidden="true" className="size-4" />
              <span className="hidden sm:inline">Team</span>
              <span className="sr-only sm:hidden">Team</span>
            </NavLink>
          </nav>
          <span className="hidden text-sm text-white/70 md:inline">{me?.name}</span>
          <button
            type="button"
            onClick={() => void signOut().then(() => navigate('/'))}
            aria-label="Sign out"
            className="flex size-9 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white"
          >
            <LogOut aria-hidden="true" className="size-4" />
          </button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-8 lg:py-12">{children}</main>
    </div>
  );
}

type Step = { kind: 'password' } | (Challenge & { secret?: string; otpauthUri?: string });

function ConsoleSignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const { session } = useConsole();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<Step>({ kind: 'password' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const restart = (message: string) => {
    setStep({ kind: 'password' });
    setPassword('');
    setCode('');
    setError(message || null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (step.kind === 'password') {
        if (!email.trim() || !password) {
          setError('Enter your email and password.');
          return;
        }
        const ch = await session.login(email.trim(), password);
        if (ch.kind === 'setup') {
          const s = await session.startSetup(ch.token);
          setStep({ ...ch, ...s });
        } else setStep(ch);
        return;
      }
      if (!code.trim()) {
        setError('Enter the code.');
        return;
      }
      await session.finish(step, code.trim());
      onSignedIn();
    } catch (err) {
      const e2 = err as { code?: string; message?: string };
      if (e2.code === 'challenge_expired' || e2.code === 'account_locked') restart(e2.message ?? '');
      else {
        setCode('');
        setError(e2.message ?? 'Something went wrong.');
      }
    } finally {
      setBusy(false);
    }
  };

  const title = step.kind === 'password' ? 'Platform sign-in' : step.kind === 'verify' ? 'Enter your code' : 'Set up two-step sign-in';
  const intro =
    step.kind === 'password'
      ? 'For the Shikshit team. Schools sign in at their own address.'
      : step.kind === 'verify'
        ? 'Open your authenticator app and type the 6-digit code for Shikshit platform.'
        : 'Every platform account confirms each sign-in with a phone app. Add it now; it takes a minute, once.';

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-ink px-6 py-12">
      <div className="w-full max-w-[440px] rounded-xl border border-white/10 bg-surface p-8 shadow-float sm:p-10">
        <div className="mb-8 flex items-center justify-between">
          <Logo size={32} />
          <span className="flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
            <ShieldCheck aria-hidden="true" className="size-3.5" />
            Platform
          </span>
        </div>
        <form onSubmit={(e) => void submit(e)} noValidate aria-labelledby="console-signin-title" className="space-y-6">
          <div className="space-y-2">
            <h1 id="console-signin-title" className="font-display text-3xl font-semibold tracking-tight text-fg">
              {title}
            </h1>
            <p className="text-sm text-fg-muted">{intro}</p>
          </div>
          {step.kind === 'password' ? (
            <div className="space-y-4">
              <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" autoFocus fieldSize="lg" leading={<Mail />} />
              <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" fieldSize="lg" leading={<Lock />} revealable />
            </div>
          ) : (
            <div className="space-y-4">
              {step.kind === 'setup' && step.secret && step.otpauthUri ? <SecretPanel secret={step.secret} otpauthUri={step.otpauthUri} /> : null}
              <CodeInput value={code} onChange={setCode} label={step.kind === 'setup' ? 'Code from the app' : 'Code'} />
            </div>
          )}
          {error ? (
            <p role="alert" className="rounded-md border border-danger-line bg-danger-bg px-4 py-3 text-sm text-danger">
              {error}
            </p>
          ) : null}
          <Button type="submit" size="lg" loading={busy} className="w-full">
            {step.kind === 'password' ? 'Continue' : step.kind === 'verify' ? 'Sign in' : 'Turn on and sign in'}
          </Button>
          {step.kind !== 'password' ? (
            <p className="border-t border-line-subtle pt-5 text-center text-sm text-fg-muted">
              Lost your phone? An operator can reset your authenticator on the server.{' '}
              <button type="button" className="font-medium text-accent-fg hover:underline" onClick={() => restart('')}>
                Start again
              </button>
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}
