import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { createWebSession } from '../../shell/web-session';
import { ShellApp } from '../../shell/ShellApp';
import type { Approval, ApprovalDetail, Delegation } from './approvalsApi';
import { MAX_HANDOVER_DAYS, forText, scopeText, toLocalInput, validateHandover, type HandoverForm } from './logic';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const at = (ms: number) => new Date(Date.now() + ms).toISOString();

const deleg = (id: string, o: Partial<Delegation> = {}): Delegation => ({
  id,
  delegatorId: 'me',
  delegatorName: 'Asha Verma',
  delegateId: 'u-head',
  delegateName: 'Kavita Rao',
  startsAt: at(-DAY),
  endsAt: at(6 * DAY),
  reason: 'Away at a conference',
  typeKeys: null,
  endedAt: null,
  createdAt: at(-DAY),
  status: 'active',
  ...o,
});

const approval = (o: Partial<Approval> = {}): Approval => ({
  id: 'a1', typeKey: 'fee.concession', typeTitle: 'Fee concession', subjectId: 's1', summary: 'Concession for Kabir', amount: null, requesterId: 'u-req', requesterName: 'Ravi Nair',
  status: 'pending', currentStep: 2, stepCount: 3, stepName: 'Principal', createdAt: at(-DAY), decidedAt: null, ...o,
});

interface Opts {
  given?: Delegation[];
  received?: Delegation[];
  inbox?: Approval[];
  detail?: ApprovalDetail;
  /** Answer to POST /approvals/delegations. */
  create?: () => Response;
  /** Answer to POST .../end. */
  end?: () => Response;
  /** Answer to GET /colleagues. */
  colleagues?: () => Response;
  visit?: boolean;
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function mount(o: Opts = {}, url = '/approvals?tab=handovers') {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = new URL(String(input), 'http://x');
    const path = u.pathname.replace('/api/v1', '');
    const method = init?.method ?? 'GET';
    calls.push({ method, path: path + u.search, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (path === '/auth/refresh') return json(200, { accessToken: 'a1', accessTokenExpiresAt: at(900_000), refreshTokenExpiresAt: at(9e8), mustChangePassword: false });
    if (path === '/me/access')
      return json(200, {
        user: { id: 'me', name: 'Asha', tier: 'tenant' }, tenant: { id: 't1', name: 'School', brand: { primary: '#1F3A5F' }, modules: ['wfl', 'iam'] },
        ...(o.visit ? { visit: { by: 'Rohan', reason: 'Checking a report', expiresAt: at(1_800_000) } } : {}),
        permissions: [], scopes: {}, fieldMasks: {}, workspace: { home: 'x', navigation: [{ screenId: 'approvals', label: 'Approvals', order: 1 }] }, mobile: { tabs: [], features: [] }, approvals: { canApprove: [] }, version: 1,
      });
    if (path === '/colleagues') return o.colleagues ? o.colleagues() : json(200, { items: [{ id: 'me', displayName: 'Asha Verma', label: 'Principal' }, { id: 'u-head', displayName: 'Kavita Rao', label: 'Teacher, Head of Department' }], page: { number: 1, size: 25, total: 2 } });
    if (path === '/approvals/delegations' && method === 'GET') return json(200, { given: o.given ?? [], received: o.received ?? [] });
    if (path === '/approvals/delegations' && method === 'POST') return o.create ? o.create() : json(201, deleg('new'));
    if (/^\/approvals\/delegations\/[^/]+\/end$/.test(path)) return o.end ? o.end() : json(200, deleg('d1', { status: 'ended', endedAt: at(0) }));
    if (path === '/approvals') return json(200, { items: o.inbox ?? [], page: { number: 1, size: 20, total: (o.inbox ?? []).length } });
    if (path === '/approvals/mine') return json(200, { items: [], page: { number: 1, size: 20, total: 0 } });
    if (path === '/approvals/a1' && o.detail) return json(200, o.detail);
    return json(404, {});
  }) as typeof fetch;
  render(
    <MemoryRouter initialEntries={[url]}>
      <ShellApp session={createWebSession(fetchFn)} />
    </MemoryRouter>,
  );
  return { calls };
}

async function fillAndChoose(endsAt: string) {
  await userEvent.click(await screen.findByRole('button', { name: /Hand over my approvals/ }));
  const dialog = await screen.findByRole('dialog');
  await userEvent.type(within(dialog).getByLabelText(/^Colleague \*$/), 'Kav');
  const results = within(dialog).getByLabelText('Colleague results');
  await waitFor(() => expect(within(results).getByRole('option', { name: /Kavita Rao/ })).toBeInTheDocument());
  await userEvent.selectOptions(results, 'u-head');
  fireEvent.change(within(dialog).getByLabelText(/^Ends/), { target: { value: endsAt } });
  return dialog;
}

describe('handover form checks', () => {
  const now = new Date('2026-11-24T10:00:00');
  const ok: HandoverForm = { delegateId: 'u1', startMode: 'now', startsAt: '', endsAt: '2026-12-01T10:00', reason: '' };
  it('accepts a good handover', () => {
    expect(validateHandover(ok, now)).toEqual({});
  });
  it('needs a colleague and an end', () => {
    expect(validateHandover({ ...ok, delegateId: '', endsAt: '' }, now)).toEqual({ delegateId: 'Choose the colleague who will decide for you.', endsAt: 'Say when the handover ends.' });
  });
  it('allows up to 90 days from the start and no more', () => {
    expect(validateHandover({ ...ok, endsAt: '2027-02-22T10:00' }, now)).toEqual({});
    expect(validateHandover({ ...ok, endsAt: '2027-02-22T10:01' }, now).endsAt).toBe(`A handover lasts at most ${MAX_HANDOVER_DAYS} days.`);
    // counted from a later start
    expect(validateHandover({ ...ok, startMode: 'later', startsAt: '2026-12-10T09:00', endsAt: '2027-03-10T09:00' }, now)).toEqual({});
    expect(validateHandover({ ...ok, startMode: 'later', startsAt: '2026-12-10T09:00', endsAt: '2027-03-10T09:30' }, now).endsAt).toMatch(/at most 90 days/);
  });
  it('rejects an end that is not after the start, and a start in the past', () => {
    expect(validateHandover({ ...ok, endsAt: '2026-11-24T09:00' }, now).endsAt).toBe('The end must be after the start.');
    expect(validateHandover({ ...ok, startMode: 'later', startsAt: '2026-11-23T10:00' }, now).startsAt).toBe('The start cannot be in the past.');
    expect(validateHandover({ ...ok, startMode: 'later', startsAt: '', endsAt: '2026-12-01T10:00' }, now).startsAt).toBe('Say when the handover starts.');
  });
  it('limits the reason to 300 characters', () => {
    expect(validateHandover({ ...ok, reason: 'x'.repeat(301) }, now).reason).toMatch(/at most 300/);
    expect(validateHandover({ ...ok, reason: 'x'.repeat(300) }, now)).toEqual({});
  });
  it('words the scope and the "for" marker', () => {
    expect(scopeText({ typeKeys: null })).toBe('All requests');
    expect(scopeText({ typeKeys: ['fee.waiver'] })).toBe('Only fee.waiver');
    expect(forText({ delegatedFromName: 'Asha Verma' })).toBe('For Asha Verma');
    expect(forText({ delegatedFromName: null })).toBeNull();
  });
});

describe('handovers', () => {
  it('lists what I gave (active first, past below) and what I received', async () => {
    mount({
      given: [deleg('d1'), deleg('d2', { delegateName: 'Meena Das', status: 'expired', reason: '' }), deleg('d3', { delegateName: 'Sunil Bose', status: 'ended', endedAt: at(-2 * DAY) })],
      received: [deleg('r1', { delegatorName: 'Dr. Iyer', delegatorId: 'u-iyer', delegateId: 'me', delegateName: 'Asha Verma', typeKeys: ['fee.concession'] })],
    });
    const given = await screen.findByRole('list', { name: 'Handed over by me' });
    expect(within(given).getByText('Kavita Rao')).toBeInTheDocument();
    expect(within(given).getByText('Active')).toBeInTheDocument();
    expect(within(given).getByRole('button', { name: 'End handover to Kavita Rao now' })).toBeInTheDocument();
    const past = screen.getByRole('list', { name: 'Handed over by me, past' });
    expect(within(past).getByText('Finished')).toBeInTheDocument();
    expect(within(past).getByText('Ended early')).toBeInTheDocument();
    expect(within(past).queryByRole('button', { name: /End handover/ })).not.toBeInTheDocument();
    const received = screen.getByRole('list', { name: 'Handed to me' });
    expect(within(received).getByText('Dr. Iyer')).toBeInTheDocument();
    expect(within(received).getByText('Only fee.concession')).toBeInTheDocument();
    expect(within(received).queryByRole('button', { name: /End/ })).not.toBeInTheDocument();
  });

  it('explains empty lists', async () => {
    mount();
    expect(await screen.findByText('You have not handed your approvals to anyone.')).toBeInTheDocument();
    expect(screen.getByText(/Nobody has handed their approvals to you/)).toBeInTheDocument();
  });

  it('sends a handover that starts now, without a start time', async () => {
    const { calls } = mount();
    const end = toLocalInput(new Date(Date.now() + 7 * DAY));
    const dialog = await fillAndChoose(end);
    await userEvent.type(within(dialog).getByLabelText(/Reason/), '  Away at a conference ');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Hand over' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.path === '/approvals/delegations')).toBeTruthy());
    const body = calls.find((c) => c.method === 'POST' && c.path === '/approvals/delegations')?.body as Record<string, unknown>;
    expect(body).toEqual({ delegateId: 'u-head', endsAt: new Date(end).toISOString(), reason: 'Away at a conference' });
    expect(body).not.toHaveProperty('startsAt');
    expect(body).not.toHaveProperty('typeKeys');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('sends a later start when chosen', async () => {
    const { calls } = mount();
    const start = toLocalInput(new Date(Date.now() + 2 * DAY));
    const end = toLocalInput(new Date(Date.now() + 9 * DAY));
    const dialog = await fillAndChoose(end);
    await userEvent.click(within(dialog).getByRole('radio', { name: 'Later' }));
    fireEvent.change(within(dialog).getByLabelText('Start date and time'), { target: { value: start } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Hand over' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/approvals/delegations')).toBe(true));
    expect(calls.find((c) => c.method === 'POST' && c.path === '/approvals/delegations')?.body).toMatchObject({ startsAt: new Date(start).toISOString(), endsAt: new Date(end).toISOString() });
  });

  it('stops a handover longer than 90 days or without a colleague before asking the server', async () => {
    const { calls } = mount();
    await userEvent.click(await screen.findByRole('button', { name: /Hand over my approvals/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Hand over' }));
    expect(await within(dialog).findByText('Choose the colleague who will decide for you.')).toBeInTheDocument();
    expect(within(dialog).getByText('Say when the handover ends.')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByLabelText(/^Ends/), { target: { value: toLocalInput(new Date(Date.now() + 120 * DAY)) } });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Hand over' }));
    expect(await within(dialog).findByText(/lasts at most 90 days/)).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST' && c.path === '/approvals/delegations')).toBe(false);
  });

  it('says plainly when the person has no approvals to hand over (403)', async () => {
    mount({ create: () => json(403, { code: 'forbidden', detail: 'Not allowed.' }) });
    const dialog = await fillAndChoose(toLocalInput(new Date(Date.now() + 7 * DAY)));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Hand over' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(/only when you can decide some yourself/);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('shows the server\'s field messages on a 400', async () => {
    mount({ create: () => json(400, { code: 'validation_failed', detail: 'Check the form.', errors: [{ field: 'delegateId', message: 'That person is not active.' }] }) });
    const dialog = await fillAndChoose(toLocalInput(new Date(Date.now() + 7 * DAY)));
    await userEvent.click(within(dialog).getByRole('button', { name: 'Hand over' }));
    expect(await within(dialog).findByText('That person is not active.')).toBeInTheDocument();
  });

  it('finds colleagues through the colleague lookup without the user-list permission', async () => {
    const { calls } = mount();
    await userEvent.click(await screen.findByRole('button', { name: /Hand over my approvals/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Hand over' })).toBeEnabled();
    await userEvent.type(within(dialog).getByLabelText(/^Colleague \*$/), 'Kav');
    const results = within(dialog).getByLabelText('Colleague results');
    await waitFor(() => expect(within(results).getByRole('option', { name: 'Kavita Rao (Teacher, Head of Department)' })).toBeInTheDocument());
    expect(within(results).queryByRole('option', { name: /Asha Verma/ })).not.toBeInTheDocument();
    expect(calls.some((c) => c.path.startsWith('/users'))).toBe(false);
    expect(calls.some((c) => c.path === '/colleagues?page=1&pageSize=25&q=Kav')).toBe(true);
  });

  it('does not search for a single letter, which the server refuses', async () => {
    const { calls } = mount();
    await userEvent.click(await screen.findByRole('button', { name: /Hand over my approvals/ }));
    const dialog = await screen.findByRole('dialog');
    await userEvent.type(within(dialog).getByLabelText(/^Colleague \*$/), 'K');
    await new Promise((r) => setTimeout(r, 400));
    expect(calls.some((c) => c.path.includes('q=K'))).toBe(false);
  });

  it('shows an error when the colleague lookup is refused', async () => {
    mount({ colleagues: () => json(403, { code: 'permission_denied', detail: 'Not allowed.' }) });
    await userEvent.click(await screen.findByRole('button', { name: /Hand over my approvals/ }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByRole('alert')).toBeInTheDocument();
  });

  it('asks before ending a handover now, and ends it only when confirmed', async () => {
    const { calls } = mount({ given: [deleg('d1')] });
    await userEvent.click(await screen.findByRole('button', { name: 'End handover to Kavita Rao now' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(confirm).toHaveTextContent(/will stop being able to decide for you right away/);
    expect(calls.some((c) => c.path.endsWith('/end'))).toBe(false);
    await userEvent.click(within(confirm).getByRole('button', { name: 'Keep it' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(calls.some((c) => c.path.endsWith('/end'))).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'End handover to Kavita Rao now' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'End handover' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/approvals/delegations/d1/end')).toBe(true));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(calls.filter((c) => c.method === 'GET' && c.path === '/approvals/delegations').length).toBeGreaterThan(1);
  });

  it('refreshes the list when the handover is already over (409)', async () => {
    const { calls } = mount({ given: [deleg('d1')], end: () => json(409, { code: 'conflict', detail: 'Already over.' }) });
    await userEvent.click(await screen.findByRole('button', { name: 'End handover to Kavita Rao now' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'End handover' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(calls.filter((c) => c.path === '/approvals/delegations' && c.method === 'GET').length).toBeGreaterThan(1);
  });

  it('shows nothing of handovers in a support visit and does not ask the server', async () => {
    const { calls } = mount({ visit: true });
    expect(await screen.findByText('Approvals are not shown in a support visit')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Hand over/ })).not.toBeInTheDocument();
    expect(calls.some((c) => c.path.startsWith('/approvals'))).toBe(false);
  });
});

describe('handover markers', () => {
  const delegated = approval({ delegatedFromId: 'u-iyer', delegatedFromName: 'Dr. Iyer' });
  const detailOf = (a: Approval, o: Partial<ApprovalDetail> = {}): ApprovalDetail => ({
    ...a,
    steps: [{ step: 2, name: 'Principal', status: 'pending', decidedBy: null, decidedAt: null }],
    events: [
      { step: null, actorId: 'u-req', actorName: 'Ravi Nair', action: 'submitted', comment: '', createdAt: at(-2 * DAY) },
      { step: 1, actorId: 'u-head', actorName: 'Kavita Rao', action: 'approved', comment: 'Looks fine.', createdAt: at(-DAY), onBehalfOfId: 'u-iyer', onBehalfOfName: 'Dr. Iyer' },
      { step: 1, actorId: 'u-acc', actorName: 'Meera Iyer', action: 'approved', comment: '', createdAt: at(-DAY + HOUR) },
    ],
    canDecide: true,
    canCancel: false,
    ...o,
  });

  it('marks an inbox row I may decide for someone else, and not the others', async () => {
    mount({ inbox: [delegated, approval({ id: 'a2', summary: 'Own request' })] }, '/approvals');
    const row = await screen.findByRole('button', { name: /Open Fee concession: Concession for Kabir/ });
    expect(within(row).getByText('For Dr. Iyer')).toBeInTheDocument();
    const other = screen.getByRole('button', { name: /Own request/ });
    expect(within(other).queryByText(/^For /)).not.toBeInTheDocument();
  });

  it('says "on behalf of" in the history, and who I am deciding for', async () => {
    mount({ inbox: [delegated], detail: detailOf(delegated) }, '/approvals?id=a1');
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText(/who handed their approvals to you/)).toBeInTheDocument();
    const history = within(dialog).getByRole('heading', { name: 'History' }).closest('section') as HTMLElement;
    expect(within(history).getAllByText(/on behalf of/)).toHaveLength(1);
    expect(within(history).getByText(/Kavita Rao/).closest('p')).toHaveTextContent('Kavita Rao approved at step 1 on behalf of Dr. Iyer');
    expect(within(history).getByText(/Meera Iyer/).closest('p')).not.toHaveTextContent('on behalf');
  });
});
