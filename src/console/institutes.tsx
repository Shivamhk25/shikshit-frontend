import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Check, ChevronLeft, ChevronRight, Copy, Eye, Inbox, Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button, Card, ConfirmDialog, Input, PageHeader, cx } from '../design-system';
import { ApiError } from '../crud/client';
import { useConsole } from './ConsoleApp';
import { instituteUrl } from './platform-session';

/** SAD-01 directory, SAD-02 new-institute wizard, SAD-03 plans and modules. Backend: modules/sad-institutes.yaml. */

export type InstituteStatus = 'onboarding' | 'live' | 'suspended' | 'archived';

export interface Institute {
  id: string;
  code: string;
  name: string;
  status: InstituteStatus;
  planCode: string | null;
  planName: string | null;
  modules: string[];
  createdAt: string;
  wentLiveAt: string | null;
}

export interface Plan {
  code: string;
  name: string;
  modules: string[];
}

const PAGE_SIZE = 25;

const STATUS: Record<InstituteStatus, { label: string; tone: string }> = {
  onboarding: { label: 'Onboarding', tone: 'border-info-line bg-info-bg text-info' },
  live: { label: 'Live', tone: 'border-success-line bg-success-bg text-success' },
  suspended: { label: 'Suspended', tone: 'border-warning-line bg-warning-bg text-warning' },
  archived: { label: 'Archived', tone: 'border-line bg-subtle text-fg-muted' },
};

/** The moves the server allows from each status (institutes.go transitions), with how each is worded. */
const MOVES: Record<InstituteStatus, { to: InstituteStatus; label: string; confirm?: string; danger?: boolean }[]> = {
  onboarding: [
    { to: 'live', label: 'Go live', confirm: 'The school is open for everyday use. Its users can keep signing in as before.' },
    { to: 'archived', label: 'Archive', confirm: 'Archiving is final. Nobody can sign in to this institute again and its address stops working.', danger: true },
  ],
  live: [{ to: 'suspended', label: 'Suspend', confirm: 'Everyone at the school is refused within 30 seconds, until you reactivate it. Nothing is deleted.', danger: true }],
  suspended: [
    { to: 'live', label: 'Reactivate' },
    { to: 'archived', label: 'Archive', confirm: 'Archiving is final. Nobody can sign in to this institute again and its address stops working.', danger: true },
  ],
  archived: [],
};

/** Display names of the module codes plans sell. A code without one is shown as it is. */
// eslint-disable-next-line react-refresh/only-export-components
export const MODULE_NAMES: Record<string, string> = {
  iam: 'Users and roles', wfl: 'Approvals', onb: 'Onboarding', aca: 'Academics', adm: 'Admissions', stu: 'Students', fee: 'Fees',
  att: 'Attendance', exm: 'Exams', asg: 'Assignments', crt: 'Certificates', slf: 'Parent and student app', stf: 'Staff self-service',
  com: 'Messages', dsh: 'Dashboards', rpt: 'Reports', lrn: 'Learning', awd: 'Awards', cns: 'Counselling', trn: 'Transport', lib: 'Library',
  res: 'Resources', caf: 'Canteen', ops: 'Operations', hrp: 'HR and payroll', inv: 'Inventory', sec: 'Security', hlt: 'Health', dev: 'Devices',
  aia: 'AI assistant',
};
const moduleName = (m: string) => MODULE_NAMES[m] ?? m.toUpperCase();

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');

function useApi() {
  const { session } = useConsole();
  return useMemo(() => {
    const call = async <T,>(method: string, path: string, body?: unknown): Promise<T> => {
      let res: Response;
      try {
        res = await session.fetch(path, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
      } catch {
        throw new ApiError(0, 'network', {}, 'Cannot reach the server. Check your connection.');
      }
      if (!res.ok) {
        type Problem = { code?: string; detail?: string; errors?: { field: string; message: string }[] };
        let p: Problem = {};
        try {
          p = (await res.json()) as Problem;
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
      list: (q: URLSearchParams) => call<{ items: Institute[]; page: { total: number } }>('GET', `/platform/institutes?${q.toString()}`),
      get: (id: string) => call<Institute>('GET', `/platform/institutes/${id}`),
      plans: () => call<{ items: Plan[] }>('GET', '/platform/plans').then((r) => r.items),
      create: (body: unknown) => call<Institute & { adminUsername: string; adminInviteLink: string; adminEmailQueued?: boolean }>('POST', '/platform/institutes', body),
      setStatus: (id: string, status: InstituteStatus) => call<Institute>('POST', `/platform/institutes/${id}/status`, { status }),
      setModules: (id: string, modules: string[]) => call<Institute>('PUT', `/platform/institutes/${id}/modules`, { modules }),
      startVisit: (id: string, reason: string) => call<{ visitId: string; code: string; instituteCode: string; expiresAt: string }>('POST', `/platform/institutes/${id}/visits`, { reason }),
    };
  }, [session]);
}

function StatusBadge({ status }: { status: InstituteStatus }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.tone}`}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}

const field = 'h-10 rounded-md border border-line bg-surface px-3 text-sm text-fg shadow-soft hover:border-line-strong focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle';

export function InstitutesPage() {
  const api = useApi();
  const [rows, setRows] = useState<Institute[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setState('loading');
    try {
      const q = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE), sort: 'name' });
      if (search.trim()) q.set('q', search.trim());
      if (status) q.set('status', status);
      const r = await api.list(q);
      setRows(r.items);
      setTotal(r.page.total);
      setState('ready');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
      setState('error');
    }
  }, [api, page, search, status]);
  useEffect(() => {
    const t = setTimeout(() => void load(), search ? 250 : 0);
    return () => clearTimeout(t);
  }, [load, search]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <section className="space-y-4">
      <PageHeader
        eyebrow="Platform"
        title="Institutes"
        description="Every school on Shikshit. Create one, take it live, choose its modules."
        actions={
          <Link to="/new" className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-on-accent shadow-soft hover:bg-accent-hover">
            <Plus aria-hidden="true" className="size-4" />
            New institute
          </Link>
        }
      />
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
          <input type="search" aria-label="Search institutes" placeholder="Search by name or code" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className={`${field} w-full pl-10`} />
        </div>
        <select aria-label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} className={field}>
          <option value="">All statuses</option>
          {(Object.keys(STATUS) as InstituteStatus[]).map((s) => (
            <option key={s} value={s}>
              {STATUS[s].label}
            </option>
          ))}
        </select>
      </div>
      {state === 'error' ? (
        <div role="alert" className="space-y-3 rounded-lg border border-danger-line bg-surface p-6 shadow-soft">
          <p className="text-fg">{error}</p>
          <Button variant="secondary" size="sm" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full text-left text-sm" aria-busy={state === 'loading'}>
            <thead className="border-b border-line-subtle text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
              <tr>
                <th scope="col" className="px-5 py-3.5 font-semibold">Institute</th>
                <th scope="col" className="px-5 py-3.5 font-semibold">Status</th>
                <th scope="col" className="hidden px-5 py-3.5 font-semibold md:table-cell">Plan</th>
                <th scope="col" className="hidden px-5 py-3.5 font-semibold lg:table-cell">Modules</th>
                <th scope="col" className="hidden px-5 py-3.5 font-semibold lg:table-cell">Created</th>
              </tr>
            </thead>
            <tbody>
              {state === 'ready' && rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-fg-muted">
                    {search || status ? <Inbox aria-hidden="true" className="mx-auto mb-3 size-6 text-fg-subtle" /> : <Building2 aria-hidden="true" className="mx-auto mb-3 size-6 text-fg-subtle" />}
                    {search || status ? 'No institutes match.' : 'No institutes yet.'}
                  </td>
                </tr>
              ) : null}
              {rows.map((i) => (
                <tr key={i.id} className="border-b border-line-subtle transition-colors last:border-0 hover:bg-canvas">
                  <td className="px-5 py-3.5">
                    <Link to={`/institutes/${i.id}`} className="block font-medium text-fg hover:text-accent-fg">
                      {i.name}
                    </Link>
                    <span className="block font-mono text-xs text-fg-subtle">{i.code}</span>
                  </td>
                  <td className="px-5 py-3.5">
                    <StatusBadge status={i.status} />
                  </td>
                  <td className="hidden px-5 py-3.5 text-fg-muted md:table-cell">{i.planName ?? '—'}</td>
                  <td className="hidden px-5 py-3.5 text-fg-muted lg:table-cell">{i.modules.length}</td>
                  <td className="hidden px-5 py-3.5 text-fg-muted lg:table-cell">{day(i.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      {total > PAGE_SIZE ? (
        <nav className="flex items-center justify-between text-sm text-fg-muted" aria-label="Pagination">
          <span>
            Page {page} of {pages} · {total} institutes
          </span>
          <span className="flex items-center gap-2">
            <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Previous page">
              <ChevronLeft aria-hidden="true" className="size-4" />
            </Button>
            <Button size="sm" variant="secondary" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Next page">
              <ChevronRight aria-hidden="true" className="size-4" />
            </Button>
          </span>
        </nav>
      ) : null}
    </section>
  );
}

/** A code from a school name: "St. Mary's Convent School" -> "st-marys-convent-school". */
// eslint-disable-next-line react-refresh/only-export-components
export function suggestCode(name: string): string {
  return name
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

const STEPS = ['School', 'Plan', 'First administrator'] as const;

export function NewInstitutePage() {
  const api = useApi();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [v, setV] = useState({ name: '', code: '', codeTouched: false, planCode: '', username: '', displayName: '', email: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreatedInstitute | null>(null);

  useEffect(() => {
    api.plans().then(
      (p) => {
        setPlans(p);
        setV((x) => ({ ...x, planCode: x.planCode || p[0]?.code || '' }));
      },
      () => setFormError('Could not load the plans.'),
    );
  }, [api]);

  const check = (s: number): Record<string, string> => {
    const e: Record<string, string> = {};
    if (s === 0) {
      if (!v.name.trim()) e.name = "Enter the school's name.";
      if (!/^[a-z0-9][a-z0-9-]{1,62}$/.test(v.code)) e.code = 'Use 2 to 63 lowercase letters, digits or hyphens.';
    }
    if (s === 1 && !v.planCode) e.planCode = 'Choose a plan.';
    if (s === 2) {
      if (!v.displayName.trim()) e['admin.displayName'] = 'Enter their name.';
      if (v.username.trim().length < 3) e['admin.username'] = 'A username has 3 to 64 characters.';
    }
    return e;
  };
  const next = () => {
    const e = check(step);
    setErrors(e);
    if (!Object.keys(e).length) setStep(step + 1);
  };
  const create = async () => {
    const e = check(2);
    setErrors(e);
    if (Object.keys(e).length) return;
    setSaving(true);
    setFormError('');
    try {
      const adminEmail = v.email.trim() || null;
      const r = await api.create({
        code: v.code,
        name: v.name.trim(),
        planCode: v.planCode,
        admin: { username: v.username.trim(), displayName: v.displayName.trim(), email: adminEmail },
      });
      setCreated({ ...r, adminEmail });
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.fields).length) {
        setErrors(err.fields);
        if (err.fields.code || err.fields.name) setStep(0);
        else if (err.fields.planCode) setStep(1);
      } else setFormError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  if (created) return <CreatedPanel created={created} onDone={() => navigate(`/institutes/${created.id}`)} />;

  const plan = plans.find((p) => p.code === v.planCode);
  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Institutes
      </Link>
      <PageHeader title="New institute" description="Set up a school in three steps. It starts in onboarding; you take it live when it is ready." />
      <ol className="flex gap-2" aria-label="Steps">
        {STEPS.map((label, i) => (
          <li key={label} aria-current={i === step ? 'step' : undefined} className={cx('flex flex-1 items-center gap-2 rounded-md border px-3 py-2 text-sm', i === step ? 'border-accent bg-accent-subtle text-fg' : i < step ? 'border-line-subtle text-fg-muted' : 'border-line-subtle text-fg-subtle')}>
            <span className={cx('flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold', i < step ? 'bg-accent text-on-accent' : 'border border-current')}>{i < step ? <Check aria-hidden="true" className="size-3" /> : i + 1}</span>
            <span className="truncate">{label}</span>
          </li>
        ))}
      </ol>
      <Card className="space-y-5 p-6">
        {step === 0 ? (
          <>
            <Input label="School name" required value={v.name} error={errors.name} onChange={(e) => setV({ ...v, name: e.target.value, code: v.codeTouched ? v.code : suggestCode(e.target.value) })} />
            <Input
              label="Address code"
              required
              value={v.code}
              error={errors.code}
              hint={`The school's address: ${v.code || 'code'}.${(import.meta.env.VITE_INSTITUTE_DOMAIN as string | undefined) ?? '<domain>'}. It cannot be changed later.`}
              onChange={(e) => setV({ ...v, code: e.target.value.toLowerCase(), codeTouched: true })}
            />
          </>
        ) : null}
        {step === 1 ? (
          <div role="radiogroup" aria-label="Plan" className="grid gap-3 sm:grid-cols-3">
            {plans.map((p) => {
              const selected = p.code === v.planCode;
              return (
                <button key={p.code} type="button" role="radio" aria-checked={selected} onClick={() => setV({ ...v, planCode: p.code })} className={cx('rounded-lg border bg-surface p-4 text-left transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle', selected ? 'border-accent ring-1 ring-accent' : 'border-line-subtle hover:border-line-strong')}>
                  <span className="block font-medium text-fg">{p.name}</span>
                  <span className="block text-xs text-fg-muted">{p.modules.length} modules</span>
                </button>
              );
            })}
            {errors.planCode ? <p className="text-sm text-danger">{errors.planCode}</p> : null}
            {plan ? <p className="text-sm text-fg-muted sm:col-span-3">Includes {plan.modules.map(moduleName).join(', ')}. You can change modules later.</p> : null}
          </div>
        ) : null}
        {step === 2 ? (
          <>
            <p className="text-sm text-fg-muted">The school&apos;s first Admin. They get a one-time link to set their password and must set up two-step sign-in.</p>
            <Input label="Name" required value={v.displayName} error={errors['admin.displayName']} onChange={(e) => setV({ ...v, displayName: e.target.value })} />
            <Input label="Username" required autoComplete="off" value={v.username} error={errors['admin.username']} onChange={(e) => setV({ ...v, username: e.target.value })} />
            <Input label="Email" type="email" value={v.email} error={errors['admin.email']} onChange={(e) => setV({ ...v, email: e.target.value })} />
          </>
        ) : null}
        {formError ? (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        ) : null}
        <div className="flex gap-2 border-t border-line-subtle pt-5">
          {step > 0 ? (
            <Button variant="secondary" onClick={() => setStep(step - 1)}>
              Back
            </Button>
          ) : null}
          {step < 2 ? (
            <Button onClick={next}>Next</Button>
          ) : (
            <Button loading={saving} onClick={() => void create()}>
              Create institute
            </Button>
          )}
        </div>
      </Card>
    </section>
  );
}

/** The wizard's result, plus the address typed for the Admin (to say where the invite was emailed). */
type CreatedInstitute = Institute & { adminUsername: string; adminInviteLink: string; adminEmailQueued?: boolean; adminEmail: string | null };

function CreatedPanel({ created, onDone }: { created: CreatedInstitute; onDone: () => void }) {
  const full = instituteUrl(created.code, created.adminInviteLink);
  const [copied, setCopied] = useState(false);
  const link = full ?? created.adminInviteLink;
  return (
    <section className="mx-auto max-w-2xl space-y-6">
      <PageHeader eyebrow="Created" title={created.name} description={`The institute is in onboarding with ${created.modules.length} modules and the default roles.`} />
      <Card className="space-y-4 p-6">
        <h2 className="font-display text-lg font-semibold text-fg">Invite for {created.adminUsername}</h2>
        <p className="text-sm text-fg-muted">
          {created.adminEmailQueued && created.adminEmail
            ? `We emailed this link to ${created.adminEmail}. You can also copy it here.`
            : 'Send this link to the school’s Admin.'}{' '}
          It works once and expires in 7 days. It is not shown again.
          {full ? null : ' Open it on the school’s own address.'}
        </p>
        <p className="break-all rounded-md border border-line-subtle bg-canvas p-3 font-mono text-xs text-fg" data-testid="admin-invite-link">
          {link}
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            onClick={() =>
              void navigator.clipboard.writeText(link).then(
                () => setCopied(true),
                () => toast.error('Copy did not work. Select the link and copy it.'),
              )
            }
          >
            {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
            {copied ? 'Copied' : 'Copy link'}
          </Button>
          <Button onClick={onDone}>Open the institute</Button>
        </div>
      </Card>
    </section>
  );
}

export function InstituteDetailPage() {
  const { id = '' } = useParams();
  const api = useApi();
  const [inst, setInst] = useState<Institute | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState<(typeof MOVES)[InstituteStatus][number] | null>(null);
  const [busy, setBusy] = useState(false);
  const [visiting, setVisiting] = useState(false);

  const load = useCallback(async () => {
    try {
      const [i, p] = await Promise.all([api.get(id), api.plans()]);
      setInst(i);
      setModules(i.modules);
      setPlans(p);
    } catch (e) {
      setError(e instanceof ApiError && e.status === 404 ? 'This institute does not exist.' : e instanceof Error ? e.message : 'Something went wrong.');
    }
  }, [api, id]);
  useEffect(() => void load(), [load]);

  const sold = useMemo(() => [...new Set(plans.flatMap((p) => p.modules))].sort((a, b) => moduleName(a).localeCompare(moduleName(b))), [plans]);
  const dirty = !!inst && [...modules].sort().join() !== [...inst.modules].sort().join();

  const move = async (to: InstituteStatus) => {
    setBusy(true);
    try {
      setInst(await api.setStatus(id, to));
      setConfirming(null);
      toast.success(`Status: ${STATUS[to].label}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };
  const saveModules = async () => {
    setBusy(true);
    try {
      const i = await api.setModules(id, modules);
      setInst(i);
      setModules(i.modules);
      toast.success('Modules saved. The school sees the change on its next page.');
    } catch (e) {
      toast.error(e instanceof ApiError && Object.values(e.fields)[0] ? Object.values(e.fields)[0] : e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  if (error)
    return (
      <section role="alert" className="space-y-4">
        <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
          <ArrowLeft aria-hidden="true" className="size-4" />
          Institutes
        </Link>
        <p className="text-fg">{error}</p>
      </section>
    );
  if (!inst) return <section aria-busy="true" />;
  const address = instituteUrl(inst.code);

  return (
    <section className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-fg-muted hover:text-fg">
        <ArrowLeft aria-hidden="true" className="size-4" />
        Institutes
      </Link>
      <PageHeader
        title={inst.name}
        description={address ?? inst.code}
        actions={
          <>
            {inst.status === 'onboarding' || inst.status === 'live' ? (
              <Button variant="secondary" onClick={() => setVisiting(true)}>
                <Eye aria-hidden="true" className="size-4" />
                View as school
              </Button>
            ) : null}
            {MOVES[inst.status].map((m) => (
              <Button key={m.to} variant={m.danger ? 'danger' : 'primary'} disabled={busy} onClick={() => (m.confirm ? setConfirming(m) : void move(m.to))}>
                {m.label}
              </Button>
            ))}
          </>
        }
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="space-y-1 p-5">
          <p className="text-xs uppercase tracking-[0.08em] text-fg-subtle">Status</p>
          <StatusBadge status={inst.status} />
        </Card>
        <Card className="space-y-1 p-5">
          <p className="text-xs uppercase tracking-[0.08em] text-fg-subtle">Plan</p>
          <p className="font-medium text-fg">{inst.planName ?? '—'}</p>
        </Card>
        <Card className="space-y-1 p-5">
          <p className="text-xs uppercase tracking-[0.08em] text-fg-subtle">Live since</p>
          <p className="font-medium text-fg">{day(inst.wentLiveAt)}</p>
        </Card>
      </div>
      <Card className="space-y-4 p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-fg">Modules</h2>
            <p className="text-sm text-fg-muted">Turning a module off keeps its data; it comes back when turned on. Users and roles is always on.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" disabled={!dirty || busy} onClick={() => setModules(inst.modules)}>
              Undo changes
            </Button>
            <Button disabled={!dirty} loading={busy} onClick={() => void saveModules()}>
              Save modules
            </Button>
          </div>
        </div>
        <fieldset className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3" disabled={inst.status === 'archived'}>
          <legend className="sr-only">Modules</legend>
          {sold.map((m) => {
            const on = modules.includes(m);
            const locked = m === 'iam';
            return (
              <label key={m} className={cx('flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors', on ? 'border-accent/50 bg-accent-subtle' : 'border-line-subtle hover:border-line-strong', locked && 'cursor-default')}>
                <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={on} disabled={locked} onChange={() => setModules(on ? modules.filter((x) => x !== m) : [...modules, m])} />
                <span className="flex-1 text-fg">{moduleName(m)}</span>
                <span className="font-mono text-[11px] text-fg-muted">{m}</span>
              </label>
            );
          })}
        </fieldset>
      </Card>
      {visiting ? <VisitDialog institute={inst} start={(reason) => api.startVisit(id, reason)} onClose={() => setVisiting(false)} /> : null}
      {confirming ? (
        <ConfirmDialog open title={`${confirming.label} ${inst.name}?`} onClose={() => setConfirming(null)}>
          <p className="text-sm text-fg-muted">{confirming.confirm}</p>
          <div className="mt-5 flex gap-2">
            <Button variant={confirming.danger ? 'destructive' : 'primary'} loading={busy} onClick={() => void move(confirming.to)}>
              {confirming.label}
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

/** SAD-05 (decision 0018): a read-only visit to the school, after a reason the school will see. */
function VisitDialog({ institute, start, onClose }: { institute: Institute; start: (reason: string) => Promise<{ code: string; instituteCode: string; expiresAt: string }>; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<{ url: string; full: boolean; until: string } | null>(null);
  const submit = async () => {
    if (reason.trim().length < 10) {
      setError('Give a reason of at least 10 characters. The school sees it.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const v = await start(reason.trim());
      const path = `/support-visit?code=${v.code}`;
      const full = instituteUrl(v.instituteCode, path);
      const until = new Date(v.expiresAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      if (full) window.open(full, '_blank', 'noopener');
      setLink({ url: full ?? path, full: !!full, until });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <ConfirmDialog open title={`View ${institute.name} as the school`} onClose={onClose} className="max-w-lg">
      {link ? (
        <div className="space-y-3">
          <p className="text-sm text-fg-muted">
            The visit is read-only and ends at {link.until}. {link.full ? 'It opened in a new tab. If it did not, open this link:' : 'Open this link on the school’s own address:'}
          </p>
          <p className="break-all rounded-md border border-line-subtle bg-canvas p-3 font-mono text-xs text-fg" data-testid="visit-link">
            {link.url}
          </p>
          <p className="text-xs text-fg-subtle">The link works once. Every page you view is recorded in the school&apos;s audit trail with your reason.</p>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-fg-muted">You see what the school&apos;s Admin sees, for 30 minutes, and cannot change anything. The school sees your name, your reason and every page you open.</p>
          <label className="block space-y-1.5 text-sm">
            <span className="font-medium text-fg">Reason</span>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="For example: the fees report shows the wrong total for class 5"
              className="w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-fg shadow-soft placeholder:text-fg-subtle focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle"
            />
          </label>
          {error ? (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button loading={busy} onClick={() => void submit()}>
              Start visit
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </ConfirmDialog>
  );
}
