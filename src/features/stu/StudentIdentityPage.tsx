import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { IdCard, Loader2, Lock, Printer, Search, ShieldAlert, UserRound, UserSearch } from 'lucide-react';
import { Button, Card, PageHeader, cx } from '../../design-system';
import { useAccessState } from '../../shell/AccessProvider';
import { useAuth } from '../../shell/AuthProvider';
import { formatDate } from '../adm/dates';
import {
  classLabel, contactText, createIdentityApi, DEBOUNCE_MS, GENDER_LABELS, guardianTags, IdentityError, MAX_QUERY, relationLabel, searchTerm, STATUS_LABELS,
  type IdCardPreview, type IdentityCard, type IdentityMatch,
} from './identity';

type Search = { phase: 'idle' } | { phase: 'loading' } | { phase: 'ready'; items: IdentityMatch[] } | { phase: 'error'; message: string };
type Card_ = { phase: 'idle' } | { phase: 'loading' } | { phase: 'ready'; card: IdentityCard } | { phase: 'error'; message: string; status: number };

const PILL: Record<string, string> = {
  active: 'border-success-line bg-success-bg text-success',
  paused: 'border-warning-line bg-warning-bg text-warning',
  transferred: 'border-line bg-subtle text-fg-muted',
  alumni: 'border-info-line bg-info-bg text-info',
};

function StatusPill({ status }: { status: string }) {
  return <span className={cx('inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium', PILL[status] ?? PILL.transferred)}>{STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status}</span>;
}

/** A round photo, or the child's initial when there is none. */
function Portrait({ url, name, className }: { url: string | null; name: string; className?: string }) {
  return url ? (
    <img src={url} alt={`Photo of ${name}`} className={cx('shrink-0 rounded-md object-cover', className)} />
  ) : (
    <span aria-hidden="true" className={cx('flex shrink-0 items-center justify-center rounded-md bg-accent-subtle font-display text-xl font-semibold text-accent-fg', className)}>
      {name.trim().charAt(0).toUpperCase() || <UserRound className="size-5" />}
    </span>
  );
}

/** The ID card itself, drawn from the fields the server sends. Fixed brand colours so it prints dark on white in any theme. */
export function IdCardPaper({ card, photoUrl }: { card: IdCardPreview; photoUrl: string | null }) {
  const phone = card.emergencyPhone;
  return (
    <article aria-label={`ID card of ${card.studentName}`} data-testid="id-card" className="w-full max-w-[22rem] break-inside-avoid overflow-hidden rounded-xl border border-brand-ink bg-white text-brand-ink-deep shadow-card [print-color-adjust:exact] print:max-w-[85.6mm] print:rounded-none print:shadow-none">
      <header className="bg-brand-ink px-4 py-2.5 text-center">
        <p className="font-display text-sm font-semibold uppercase tracking-[0.1em] text-white">{card.instituteName}</p>
        <div aria-hidden="true" className="mx-auto mt-1.5 h-px w-16 bg-brand-gold" />
      </header>
      <div className="flex gap-4 p-4">
        <Portrait url={photoUrl} name={card.studentName} className="size-24 text-3xl" />
        <div className="min-w-0 flex-1">
          <p className="font-display text-lg font-semibold leading-tight">{card.studentName}</p>
          <p className="mt-0.5 text-sm font-semibold tracking-wide">{card.registrationCode}</p>
          <dl className="mt-2 space-y-0.5 text-xs">
            <div className="flex gap-1"><dt className="sr-only">Class</dt><dd className="font-medium">{card.classSection ?? "—"}</dd></div>
            <div className="flex gap-1"><dt className="text-brand-ink">Roll no.</dt><dd className="font-medium">{card.rollNumber ?? '—'}</dd></div>
            <div className="flex gap-1"><dt className="text-brand-ink">Born</dt><dd className="font-medium">{formatDate(card.dateOfBirth)}</dd></div>
          </dl>
        </div>
      </div>
      <dl className="space-y-0.5 border-t border-brand-gold px-4 py-3 text-xs">
        <div className="flex gap-1"><dt className="text-brand-ink">Guardian</dt><dd className="font-medium">{card.primaryGuardianName ?? '—'}</dd></div>
        <div className="flex gap-1"><dt className="text-brand-ink">Emergency</dt><dd className="font-medium">{phone ?? 'Hidden'}</dd></div>
        <div className="flex gap-1"><dt className="text-brand-ink">Valid until</dt><dd className="font-medium">{card.validUntil ? formatDate(card.validUntil) : '—'}{card.academicYear ? ` (${card.academicYear})` : ''}</dd></div>
      </dl>
    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-fg-subtle">{label}</dt>
      <dd className="mt-0.5 text-sm text-fg">{children}</dd>
    </div>
  );
}

function Hidden() {
  return (
    <span className="inline-flex items-center gap-1 text-fg-muted">
      <Lock aria-hidden="true" className="size-3.5" />
      Hidden
    </span>
  );
}

function Contact({ value, visible }: { value: string | null; visible: boolean }) {
  return value ? <>{value}</> : visible ? <span className="text-fg-muted">{contactText(value, visible)}</span> : <Hidden />;
}

function CardView({ card, photoUrl }: { card: IdentityCard; photoUrl: string | null }) {
  const e = card.enrollment;
  return (
    <div data-testid="identity-card" className="space-y-6">
      <Card className="p-5 print:hidden sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row">
          <Portrait url={photoUrl} name={card.fullName} className="size-28" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-2xl font-semibold tracking-tight text-fg">{card.fullName}</h2>
              <StatusPill status={card.status} />
            </div>
            <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
              <Field label="Registration code">{card.registrationCode}</Field>
              <Field label="Date of birth">{formatDate(card.dateOfBirth)}</Field>
              <Field label="Gender">{GENDER_LABELS[card.gender] ?? card.gender}</Field>
              <Field label="Class this year">{e ? `${classLabel(e.className, e.sectionName)} · ${e.academicYear}` : classLabel(null, null)}</Field>
              <Field label="Roll number">{e?.rollNumber ?? '—'}</Field>
            </dl>
          </div>
        </div>
      </Card>

      <Card className="p-5 print:hidden sm:p-6">
        <h3 className="font-display text-lg font-semibold text-fg">Guardians</h3>
        {!card.contactsVisible ? (
          <p className="mt-1 flex items-center gap-2 text-sm text-fg-muted">
            <ShieldAlert aria-hidden="true" className="size-4 shrink-0" />
            Phone numbers and email addresses are hidden for your role.
          </p>
        ) : null}
        {card.guardians.length === 0 ? (
          <p className="mt-3 text-sm text-fg-muted">No guardian is linked to this student yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line-subtle">
            {card.guardians.map((g) => (
              <li key={g.id} className="py-3 first:pt-0 last:pb-0">
                <p className="text-sm font-medium text-fg">
                  {g.name} <span className="font-normal text-fg-muted">· {relationLabel(g.relation)}</span>
                </p>
                <dl className="mt-1 grid gap-x-8 gap-y-1 text-sm sm:grid-cols-2">
                  <div className="flex gap-2"><dt className="text-fg-subtle">Phone</dt><dd><Contact value={g.phone} visible={card.contactsVisible} /></dd></div>
                  <div className="flex gap-2"><dt className="text-fg-subtle">Email</dt><dd className="break-all"><Contact value={g.email} visible={card.contactsVisible} /></dd></div>
                </dl>
                {guardianTags(g).length ? (
                  <ul aria-label={`About ${g.name}`} className="mt-2 flex flex-wrap gap-1.5">
                    {guardianTags(g).map((t) => (
                      <li key={t} className="rounded-full border border-line bg-subtle px-2 py-0.5 text-xs text-fg-muted">{t}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5 print:border-0 print:p-0 print:shadow-none sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <h3 className="font-display text-lg font-semibold text-fg">ID card preview</h3>
            <p className="text-sm text-fg-muted">Printing sends only the card to the printer.</p>
          </div>
          <Button type="button" variant="secondary" onClick={() => window.print()}>
            <Printer aria-hidden="true" className="size-4" />
            Print ID card
          </Button>
        </div>
        <div className="mt-4 print:mt-0">
          <IdCardPaper card={card.idCard} photoUrl={photoUrl} />
        </div>
      </Card>
    </div>
  );
}

/** STU-01 Student identity: search for a student, then one identity card with an ID-card preview that prints. */
export function StudentIdentityPage() {
  const { session } = useAuth();
  const access = useAccessState();
  const api = useMemo(() => createIdentityApi(session), [session]);
  const canView = access.phase === 'ready' && access.access.can('stu.student_identity.view');

  const [text, setText] = useState('');
  const [results, setResults] = useState<Search>({ phase: 'idle' });
  const [chosen, setChosen] = useState<IdentityMatch | null>(null);
  const selected = chosen?.id ?? null;
  const [card, setCard] = useState<Card_>({ phase: 'idle' });
  const [photo, setPhoto] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const searchSeq = useRef(0);
  const cardSeq = useRef(0);
  const term = searchTerm(text);

  useEffect(() => {
    const seq = ++searchSeq.current;
    if (!term || !canView) {
      setResults({ phase: 'idle' });
      return;
    }
    setResults({ phase: 'loading' });
    const t = setTimeout(() => {
      api.search(term).then(
        (items) => seq === searchSeq.current && setResults({ phase: 'ready', items }),
        (e: unknown) => seq === searchSeq.current && setResults({ phase: 'error', message: e instanceof Error ? e.message : 'Something went wrong. Please try again.' }),
      );
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [api, term, canView, retry]);

  const open = useCallback(
    (m: IdentityMatch) => {
      const seq = ++cardSeq.current;
      setChosen(m);
      setPhoto(null);
      setCard({ phase: 'loading' });
      api.card(m.id).then(
        (c) => {
          if (seq !== cardSeq.current) return;
          setCard({ phase: 'ready', card: c });
          if (c.hasPhoto) void api.photo(m.id).then((u) => seq === cardSeq.current && setPhoto(u));
        },
        (e: unknown) => seq === cardSeq.current && setCard({ phase: 'error', message: e instanceof Error ? e.message : 'Something went wrong. Please try again.', status: e instanceof IdentityError ? e.status : 0 }),
      );
    },
    [api],
  );

  const header = <PageHeader eyebrow="Students" title="Student identity" description="Find a student to see their codes, class, guardians and ID card." />;

  if (access.phase === 'ready' && !canView) {
    return (
      <div className="space-y-8">
        {header}
        <Card className="flex flex-col items-center gap-2 p-10 text-center" role="alert">
          <Lock aria-hidden="true" className="size-8 text-fg-subtle" />
          <p className="font-display text-lg font-semibold text-fg">You cannot view student identity</p>
          <p className="max-w-md text-sm text-fg-muted">Ask your school administrator to give your role this screen.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="print:hidden">{header}</div>
      <div className="grid gap-8 lg:grid-cols-[22rem_1fr]">
        <section aria-label="Find a student" className="space-y-4 print:hidden">
          <div>
            <label htmlFor="identity-search" className="mb-1.5 block text-sm font-medium text-fg">Name or registration code</label>
            <div className="relative">
              <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" />
              <input
                id="identity-search"
                type="search"
                value={text}
                maxLength={MAX_QUERY}
                autoComplete="off"
                onChange={(e) => setText(e.target.value)}
                aria-describedby="identity-hint"
                className="h-11 w-full rounded-md border border-line bg-surface pl-9 pr-3 text-base text-fg shadow-soft hover:border-line-strong focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle"
              />
            </div>
            <p id="identity-hint" className="mt-1.5 text-xs text-fg-muted">Type at least 2 characters.</p>
          </div>

          <div role="status" aria-live="polite">
            {results.phase === 'idle' ? (
              <Card className="flex items-center gap-3 p-4 text-sm text-fg-muted">
                <UserSearch aria-hidden="true" className="size-5 shrink-0 text-fg-subtle" />
                {text.trim().length === 0 ? 'Search to find a student.' : 'Keep typing: at least 2 characters.'}
              </Card>
            ) : null}
            {results.phase === 'loading' ? (
              <p className="flex items-center gap-2 p-2 text-sm text-fg-muted"><Loader2 aria-hidden="true" className="size-4 animate-spin" />Searching…</p>
            ) : null}
            {results.phase === 'ready' && results.items.length === 0 ? (
              <Card className="p-4 text-sm text-fg-muted">No student matches “{term}”. Check the spelling or try the registration code.</Card>
            ) : null}
          </div>
          {results.phase === 'error' ? (
            <Card role="alert" className="space-y-3 p-4">
              <p className="text-sm text-danger">{results.message}</p>
              <Button type="button" variant="secondary" size="sm" onClick={() => setRetry((n) => n + 1)}>Try again</Button>
            </Card>
          ) : null}
          {results.phase === 'ready' && results.items.length > 0 ? (
            <ul aria-label="Search results" className="divide-y divide-line-subtle overflow-hidden rounded-lg border border-line bg-surface shadow-card">
              {results.items.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    aria-pressed={selected === m.id}
                    onClick={() => open(m)}
                    className={cx('flex min-h-14 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-subtle focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-accent-subtle', selected === m.id && 'bg-accent-subtle')}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-fg">{m.fullName}</span>
                      <span className="block truncate text-xs text-fg-muted">{m.registrationCode} · {classLabel(m.className, m.sectionName)}</span>
                    </span>
                    {m.status !== 'active' ? <StatusPill status={m.status} /> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>

        <section aria-label="Identity card" className="min-w-0">
          {card.phase === 'idle' ? (
            <Card className="flex flex-col items-center gap-2 p-10 text-center print:hidden">
              <IdCard aria-hidden="true" className="size-8 text-fg-subtle" />
              <p className="font-display text-lg font-semibold text-fg">No student chosen</p>
              <p className="max-w-sm text-sm text-fg-muted">Search on the left and choose a student to see their identity card.</p>
            </Card>
          ) : null}
          {card.phase === 'loading' ? (
            <Card role="status" className="flex items-center gap-2 p-6 text-sm text-fg-muted"><Loader2 aria-hidden="true" className="size-4 animate-spin" />Loading the card…</Card>
          ) : null}
          {card.phase === 'error' ? (
            <Card role="alert" className="space-y-3 p-6">
              <p className="text-sm text-danger">{card.message}</p>
              {card.status !== 404 && card.status !== 403 ? (
                <Button type="button" variant="secondary" size="sm" onClick={() => chosen && open(chosen)}>Try again</Button>
              ) : null}
            </Card>
          ) : null}
          {card.phase === 'ready' ? <CardView card={card.card} photoUrl={photo} /> : null}
        </section>
      </div>
    </div>
  );
}
