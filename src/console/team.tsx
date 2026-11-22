import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Check, Copy, Lock, Plus, ShieldCheck, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, ConfirmDialog, Input, Logo, PageHeader, Sheet } from '../design-system';
import { ApiError } from '../crud/client';
import { API_BASE } from '../shell/web-session';
import { useConsole } from './ConsoleApp';

/** SAD-04 (decision 0019): the Shikshit team's platform accounts. Two-step sign-in is always on for them (0017). */

export interface Account {
  id: string;
  email: string;
  name: string;
  status: 'invited' | 'active' | 'disabled';
  mfaEnabled: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}
type Action = 'disable' | 'enable' | 'reset-mfa' | 'reset-password';

const STATUS: Record<Account['status'], { label: string; tone: string }> = {
  active: { label: 'Active', tone: 'border-success-line bg-success-bg text-success' },
  invited: { label: 'Invited', tone: 'border-info-line bg-info-bg text-info' },
  disabled: { label: 'Disabled', tone: 'border-line bg-subtle text-fg-muted' },
};

const ACTIONS: Record<Action, { label: string; done: string; confirm?: string; danger?: boolean }> = {
  'reset-password': { label: 'New password link', done: 'New link ready' },
  'reset-mfa': { label: 'Reset authenticator', done: 'Authenticator reset', confirm: 'Use this when they lost their phone. They are signed out everywhere and set up their authenticator again at their next sign-in.' },
  disable: { label: 'Disable', done: 'Disabled', confirm: 'They are signed out everywhere and cannot sign in to the console until enabled again.', danger: true },
  enable: { label: 'Enable', done: 'Enabled' },
};

function actionsFor(a: Account): Action[] {
  if (a.status === 'disabled') return ['enable'];
  return a.status === 'invited' ? ['reset-password', 'disable'] : ['reset-password', 'reset-mfa', 'disable'];
}

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : 'Never');

/** The console's own address, so a link can be shown in full. */
const consoleLink = (path: string) => `${window.location.origin}${window.location.pathname.startsWith('/console') ? '/console' : ''}${path}`;

function useTeamApi() {
  const { session } = useConsole();
  return useMemo(() => {
    const call = async <T,>(method: string, path: string, body?: unknown): Promise<T> => {
      const res = await session.fetch(path, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
      if (!res.ok) {
        let p: { code?: string; detail?: string; errors?: { field: string; message: string }[] } = {};
        try {
          p = (await res.json()) as typeof p;
        } catch {
          /* not JSON */
        }
        const fields: Record<string, string> = {};
        for (const e of p.errors ?? []) fields[e.field] ??= e.message;
        throw new ApiError(res.status, p.code ?? 'error', fields, p.detail ?? 'Something went wrong. Please try again.');
      }
      return (await res.json()) as T;
    };
    return {
      list: () => call<{ items: Account[] }>('GET', '/platform/users').then((r) => r.items),
      create: (email: string, name: string) => call<Account & { link: string; emailQueued?: boolean }>('POST', '/platform/users', { email, name }),
      act: (id: string, action: Action) => call<Account & { link?: string; emailQueued?: boolean }>('POST', `/platform/users/${id}/${action}`),
    };
  }, [session]);
}

export function TeamPage() {
  const api = useTeamApi();
  const { me } = useConsole();
  const [rows, setRows] = useState<Account[] | null>(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [link, setLink] = useState<{ name: string; url: string; invite: boolean; emailedTo?: string } | null>(null);
  const [confirming, setConfirming] = useState<{ a: Account; action: Action } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRows(await api.list());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    }
  }, [api]);
  useEffect(() => void load(), [load]);

  const run = async (a: Account, action: Action) => {
    setBusy(true);
    try {
      const r = await api.act(a.id, action);
      setConfirming(null);
      if (r.link) setLink({ name: r.name, url: consoleLink(r.link), invite: r.status === 'invited', emailedTo: r.emailQueued ? r.email : undefined });
      else toast.success(`${ACTIONS[action].done}: ${r.name}`);
      void load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="Platform"
        title="Team"
        description="Everyone at Shikshit who can sign in to this console. Each of them confirms every sign-in with an authenticator app."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus aria-hidden="true" className="size-4" />
            Invite
          </Button>
        }
      />
      {error ? (
        <p role="alert" className="text-danger">
          {error}
        </p>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm" aria-busy={rows === null}>
            <thead className="border-b border-line-subtle text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
              <tr>
                <th scope="col" className="px-5 py-3.5 font-semibold">Name</th>
                <th scope="col" className="px-5 py-3.5 font-semibold">Status</th>
                <th scope="col" className="hidden px-5 py-3.5 font-semibold md:table-cell">Two-step</th>
                <th scope="col" className="hidden px-5 py-3.5 font-semibold lg:table-cell">Last sign-in</th>
                <th scope="col" className="hidden px-5 py-3.5 text-right font-semibold md:table-cell">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(rows ?? []).map((a) => {
                const self = a.id === me?.id;
                return (
                  <tr key={a.id} className="border-b border-line-subtle last:border-0 hover:bg-canvas">
                    <td className="px-5 py-3.5">
                      <span className="block font-medium text-fg">
                        {a.name}
                        {self ? <span className="ml-2 text-xs font-normal text-fg-subtle">(you)</span> : null}
                      </span>
                      <span className="block text-xs text-fg-subtle">{a.email}</span>
                      {self ? null : (
                        <span className="mt-2 flex flex-wrap gap-1 md:hidden">
                          {actionsFor(a).map((action) => (
                            <Button key={action} size="sm" variant={ACTIONS[action].danger ? 'danger' : 'secondary'} disabled={busy} onClick={() => (ACTIONS[action].confirm ? setConfirming({ a, action }) : void run(a, action))}>
                              {ACTIONS[action].label}
                            </Button>
                          ))}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${STATUS[a.status].tone}`}>
                        <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
                        {STATUS[a.status].label}
                      </span>
                    </td>
                    <td className="hidden px-5 py-3.5 text-fg-muted md:table-cell">
                      {a.mfaEnabled ? (
                        <span className="inline-flex items-center gap-1.5">
                          <ShieldCheck aria-hidden="true" className="size-4 text-success" />
                          Set up
                        </span>
                      ) : (
                        'At first sign-in'
                      )}
                    </td>
                    <td className="hidden whitespace-nowrap px-5 py-3.5 text-fg-muted lg:table-cell">{when(a.lastLoginAt)}</td>
                    <td className="hidden space-x-1 whitespace-nowrap px-5 py-2.5 text-right md:table-cell">
                      {self
                        ? null
                        : actionsFor(a).map((action) => (
                            <Button key={action} size="sm" variant={ACTIONS[action].danger ? 'danger' : 'secondary'} disabled={busy} aria-label={`${ACTIONS[action].label} ${a.name}`} onClick={() => (ACTIONS[action].confirm ? setConfirming({ a, action }) : void run(a, action))}>
                              {ACTIONS[action].label}
                            </Button>
                          ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
      {adding ? (
        <InviteSheet
          onClose={() => setAdding(false)}
          onSave={async (email, name) => {
            const r = await api.create(email, name);
            setAdding(false);
            setLink({ name: r.name, url: consoleLink(r.link), invite: true, emailedTo: r.emailQueued ? r.email : undefined });
            void load();
          }}
        />
      ) : null}
      {link ? <LinkDialog link={link} onClose={() => setLink(null)} /> : null}
      {confirming ? (
        <ConfirmDialog open title={`${ACTIONS[confirming.action].label}: ${confirming.a.name}?`} onClose={() => setConfirming(null)}>
          <p className="text-sm text-fg-muted">{ACTIONS[confirming.action].confirm}</p>
          <div className="mt-5 flex gap-2">
            <Button variant="destructive" loading={busy} onClick={() => void run(confirming.a, confirming.action)}>
              {ACTIONS[confirming.action].label}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(null)}>
              Cancel
            </Button>
          </div>
        </ConfirmDialog>
      ) : null}
    </section>
  );
}

function InviteSheet({ onClose, onSave }: { onClose: () => void; onSave: (email: string, name: string) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const save = async () => {
    const local: Record<string, string> = {};
    if (!name.trim()) local.name = 'Enter their name.';
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) local.email = 'Enter a valid email address.';
    setErrors(local);
    if (Object.keys(local).length) return;
    setSaving(true);
    try {
      await onSave(email.trim(), name.trim());
    } catch (e) {
      setErrors(e instanceof ApiError && Object.keys(e.fields).length ? e.fields : { email: e instanceof Error ? e.message : 'Something went wrong.' });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet open title="Invite to the console" description="They get a one-time link to set a password, then set up an authenticator app at their first sign-in." onClose={onClose}>
      <div className="flex flex-1 flex-col gap-4">
        <Input label="Name" required value={name} error={errors.name} onChange={(e) => setName(e.target.value)} />
        <Input label="Work email" type="email" required value={email} error={errors.email} onChange={(e) => setEmail(e.target.value)} hint="They sign in with this." />
        <div className="sticky -bottom-8 -mx-8 -mb-8 mt-auto flex gap-2 border-t border-line-subtle bg-surface px-8 py-4">
          <Button loading={saving} onClick={() => void save()}>
            <UserPlus aria-hidden="true" className="size-4" />
            Invite
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function LinkDialog({ link, onClose }: { link: { name: string; url: string; invite: boolean; emailedTo?: string }; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <ConfirmDialog open title={link.invite ? 'Invite link' : 'New password link'} onClose={onClose} className="max-w-lg">
      <p className="text-sm text-fg-muted">
        {link.emailedTo ? (
          <>
            We emailed this link to <span className="font-medium text-fg">{link.emailedTo}</span>. You can also copy it here.{' '}
          </>
        ) : (
          <>
            Send this to <span className="font-medium text-fg">{link.name}</span> privately.{' '}
          </>
        )}
        It works once and expires in {link.invite ? '7 days' : '24 hours'}. It is not shown again.
      </p>
      <p className="mt-3 break-all rounded-md border border-line-subtle bg-canvas p-3 font-mono text-xs text-fg" data-testid="platform-link">
        {link.url}
      </p>
      <div className="mt-5 flex gap-2">
        <Button
          variant="secondary"
          onClick={() =>
            void navigator.clipboard.writeText(link.url).then(
              () => setCopied(true),
              () => toast.error('Copy did not work. Select the link and copy it.'),
            )
          }
        >
          {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
          {copied ? 'Copied' : 'Copy link'}
        </Button>
        <Button onClick={onClose}>Done</Button>
      </div>
    </ConfirmDialog>
  );
}

/** /accept-invite on the console: set a password from a one-time link. Works without being signed in. */
export function ConsoleAcceptInvite({ fetchFn = (...a) => fetch(...a), onDone }: { fetchFn?: typeof fetch; onDone: () => void }) {
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token') ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 10) return setError('Choose a password of at least 10 characters.');
    if (password !== confirm) return setError('The two passwords are not the same.');
    setBusy(true);
    try {
      const res = await fetchFn(`${API_BASE}/platform/auth/invite/accept`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) });
      if (res.status === 204) return setDone(true);
      const p = (await res.json().catch(() => ({}))) as { detail?: string };
      setError(p.detail ?? 'Something went wrong. Please try again.');
    } catch {
      setError('Cannot reach the server. Check your connection.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-ink px-6 py-12">
      <div className="w-full max-w-[440px] space-y-6 rounded-xl border border-white/10 bg-surface p-8 shadow-float sm:p-10">
        <Logo size={32} />
        {done ? (
          <div className="space-y-4">
            <h1 className="font-display text-3xl font-semibold tracking-tight text-fg">Password set</h1>
            <p className="text-sm text-fg-muted">Sign in with your email and this password. You will set up an authenticator app next.</p>
            <Button className="w-full" size="lg" onClick={onDone}>
              Go to sign-in
            </Button>
          </div>
        ) : (
          <form onSubmit={(e) => void submit(e)} noValidate className="space-y-5" aria-labelledby="platform-accept-title">
            <div className="space-y-2">
              <h1 id="platform-accept-title" className="font-display text-3xl font-semibold tracking-tight text-fg">
                Set your password
              </h1>
              <p className="text-sm text-fg-muted">For your Shikshit platform account. Use at least 10 characters.</p>
            </div>
            <Input label="New password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" fieldSize="lg" leading={<Lock />} revealable />
            <Input label="Type it again" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" fieldSize="lg" leading={<Lock />} />
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
    </div>
  );
}
