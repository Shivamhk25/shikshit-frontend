import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { createWebSession } from '../../shell/web-session';
import { ShellApp } from '../../shell/ShellApp';
import type { Approval, ApprovalDetail } from './approvalsApi';
import { rowTiming, stepText, waitingTime } from './logic';

const ago = (mins: number) => new Date(Date.now() - mins * 60_000).toISOString();

const base = (id: string, o: Partial<Approval> = {}): Approval => ({
  id,
  typeKey: 'fee.concession',
  typeTitle: 'Fee concession',
  subjectId: 's1',
  summary: `Concession for ${id}`,
  amount: 12500,
  requesterId: 'u-req',
  requesterName: 'Ravi Nair',
  status: 'pending',
  currentStep: 2,
  stepCount: 3,
  stepName: 'Principal',
  createdAt: ago(60 * 50),
  decidedAt: null,
  ...o,
});

const detailOf = (a: Approval, o: Partial<ApprovalDetail> = {}): ApprovalDetail => ({
  ...a,
  steps: [
    { step: 1, name: 'Accountant', status: 'approved', decidedBy: 'Meera Iyer', decidedAt: ago(60 * 40) },
    { step: 2, name: 'Principal', status: 'pending', decidedBy: null, decidedAt: null },
    { step: 3, name: 'Chairperson', status: 'pending', decidedBy: null, decidedAt: null },
  ],
  events: [
    { step: null, actorId: 'u-req', actorName: 'Ravi Nair', action: 'submitted', comment: 'Single parent, two children enrolled.', createdAt: ago(60 * 50) },
    { step: 1, actorId: 'u-acc', actorName: 'Meera Iyer', action: 'approved', comment: 'Documents checked.', createdAt: ago(60 * 40) },
  ],
  canDecide: true,
  canCancel: false,
  ...o,
});

interface Opts {
  inbox?: Approval[];
  mine?: Approval[];
  detail?: ApprovalDetail;
  /** What the server answers to approve/reject/cancel. */
  decide?: (kind: string) => Response | undefined;
  visit?: boolean;
  total?: number;
}

function mount(o: Opts = {}, url = '/approvals') {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const state = { detail: o.detail };
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const u = new URL(String(input), 'http://x');
    const path = u.pathname.replace('/api/v1', '');
    const method = init?.method ?? 'GET';
    calls.push({ method, path: path + u.search, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (path === '/auth/refresh') return json(200, { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 9e5).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 9e8).toISOString(), mustChangePassword: false });
    if (path === '/me/access')
      return json(200, {
        user: { id: 'me', name: 'Asha', tier: 'tenant' }, tenant: { id: 't1', name: 'School', brand: { primary: '#1F3A5F' }, modules: ['wfl'] },
        ...(o.visit ? { visit: { by: 'Rohan', reason: 'Checking a report', expiresAt: new Date(Date.now() + 18e5).toISOString() } } : {}),
        permissions: [], scopes: {}, fieldMasks: {}, workspace: { home: 'x', navigation: [{ screenId: 'approvals', label: 'Approvals', order: 1 }] }, mobile: { tabs: [], features: [] }, approvals: { canApprove: [] }, version: 1,
      });
    if (path === '/approvals') return json(200, { items: o.inbox ?? [], page: { number: Number(u.searchParams.get('page')), size: 20, total: o.total ?? (o.inbox ?? []).length } });
    if (path === '/approvals/mine') return json(200, { items: (o.mine ?? []).filter((a) => !u.searchParams.get('status') || a.status === u.searchParams.get('status')), page: { number: 1, size: 20, total: (o.mine ?? []).length } });
    const m = /^\/approvals\/([^/]+)(?:\/(approve|reject|cancel))?$/.exec(path);
    if (m && state.detail) {
      if (!m[2]) return json(200, state.detail);
      const forced = o.decide?.(m[2]);
      if (forced) return forced;
      return json(200, { ...state.detail, status: m[2] === 'approve' ? 'pending' : m[2] === 'reject' ? 'rejected' : 'cancelled', canDecide: false, canCancel: false });
    }
    return json(404, {});
  }) as typeof fetch;
  render(
    <MemoryRouter initialEntries={[url]}>
      <ShellApp session={createWebSession(fetchFn)} />
    </MemoryRouter>,
  );
  return { calls, state };
}

const waiting = base('a1');
const second = base('a2', { summary: 'Concession for Kabir', currentStep: 1, stepName: 'Accountant', amount: null });

describe('approvals', () => {
  it('shows the requests to decide, with step, requester and waiting time, and switches tabs', async () => {
    const { calls } = mount({ inbox: [waiting, second], mine: [base('m1', { status: 'approved', decidedAt: ago(60), summary: 'Trip fee waiver' }), base('m2', { status: 'rejected', decidedAt: ago(60), summary: 'Late fee waiver' })] });
    const row = await screen.findByRole('button', { name: /Open Fee concession: Concession for a1/ });
    expect(within(row).getByText('Step 2 of 3: Principal')).toBeInTheDocument();
    expect(within(row).getByText('From Ravi Nair')).toBeInTheDocument();
    expect(within(row).getByText('Waiting 2 days')).toBeInTheDocument();
    expect(within(row).getByText('Waiting')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /To decide/ })).toHaveAttribute('aria-selected', 'true');

    await userEvent.click(screen.getByRole('tab', { name: 'My requests' }));
    expect(await screen.findByText('Trip fee waiver')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'My requests' })).toHaveAttribute('aria-selected', 'true');
    expect(calls.some((c) => c.path.startsWith('/approvals/mine?'))).toBe(true);

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'rejected');
    await waitFor(() => expect(calls.some((c) => c.path.includes('status=rejected'))).toBe(true));
    expect(await screen.findByText('Late fee waiver')).toBeInTheDocument();
    expect(screen.queryByText('Trip fee waiver')).not.toBeInTheDocument();
  });

  it('moves between tabs with the arrow keys', async () => {
    mount({ inbox: [waiting], mine: [] });
    await screen.findByText('Concession for a1');
    screen.getByRole('tab', { name: /To decide/ }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'My requests' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'My requests' })).toHaveFocus();
  });

  it('approves with the step the person was looking at, and an optional comment', async () => {
    const { calls } = mount({ inbox: [waiting], detail: detailOf(waiting) });
    await userEvent.click(await screen.findByRole('button', { name: /Open Fee concession/ }));
    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('1. Accountant')).toBeInTheDocument();
    expect(within(dialog).getByText(/Approved by Meera Iyer/)).toBeInTheDocument();
    expect(within(dialog).getByText('Documents checked.')).toBeInTheDocument();
    await userEvent.type(within(dialog).getByLabelText(/Comment/), 'Fine by me');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(calls.find((c) => c.path.endsWith('/approve'))?.body).toEqual({ step: 2, comment: 'Fine by me' }));
    // the list is reloaded after a decision
    await waitFor(() => expect(calls.filter((c) => c.path.startsWith('/approvals?')).length).toBeGreaterThan(1));
  });

  it('approves without a comment', async () => {
    const { calls } = mount({ inbox: [waiting], detail: detailOf(waiting) });
    await userEvent.click(await screen.findByRole('button', { name: /Open Fee concession/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(calls.find((c) => c.path.endsWith('/approve'))?.body).toEqual({ step: 2 }));
  });

  it('will not reject without a comment, then sends it', async () => {
    const { calls } = mount({ inbox: [waiting], detail: detailOf(waiting) });
    await userEvent.click(await screen.findByRole('button', { name: /Open Fee concession/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Reject' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/Say why you are rejecting/);
    expect(calls.some((c) => c.path.endsWith('/reject'))).toBe(false);
    await userEvent.type(screen.getByLabelText(/Comment/), '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    expect(calls.some((c) => c.path.endsWith('/reject'))).toBe(false);
    await userEvent.type(screen.getByLabelText(/Comment/), 'Income proof missing');
    await userEvent.click(screen.getByRole('button', { name: 'Reject' }));
    await waitFor(() => expect(calls.find((c) => c.path.endsWith('/reject'))?.body).toEqual({ step: 2, comment: 'Income proof missing' }));
  });

  it('asks before withdrawing my own request', async () => {
    const mine = base('m1', { summary: 'My waiver' });
    const { calls } = mount({ mine: [mine], detail: detailOf(mine, { canDecide: false, canCancel: true }) }, '/approvals?tab=mine');
    await userEvent.click(await screen.findByRole('button', { name: /Open Fee concession: My waiver/ }));
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    await userEvent.click(await screen.findByRole('button', { name: 'Withdraw request' }));
    const confirm = await screen.findByRole('alertdialog');
    expect(calls.some((c) => c.path.endsWith('/cancel'))).toBe(false);
    await userEvent.click(within(confirm).getByRole('button', { name: 'Keep it' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(calls.some((c) => c.path.endsWith('/cancel'))).toBe(false);

    await userEvent.click(screen.getByRole('button', { name: 'Withdraw request' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Withdraw request' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path.endsWith('/cancel'))).toBe(true));
    expect(await within(await screen.findByRole('dialog')).findByText('Withdrawn')).toBeInTheDocument();
  });

  it('shows the latest request with a clear message when someone else decided first (409)', async () => {
    const moved = detailOf(base('a1', { currentStep: 3, stepName: 'Chairperson' }), { canDecide: false, steps: [
      { step: 1, name: 'Accountant', status: 'approved', decidedBy: 'Meera Iyer', decidedAt: ago(60) },
      { step: 2, name: 'Principal', status: 'approved', decidedBy: 'Dr. Rao', decidedAt: ago(1) },
      { step: 3, name: 'Chairperson', status: 'pending', decidedBy: null, decidedAt: null },
    ] });
    const { calls, state } = mount({ inbox: [waiting], detail: detailOf(waiting), decide: () => {
      state.detail = moved;
      return new Response(JSON.stringify({ code: 'conflict', detail: 'moved' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    } });
    await userEvent.click(await screen.findByRole('button', { name: /Open Fee concession/ }));
    await userEvent.type(await screen.findByLabelText(/Comment/), 'ok');
    await userEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(await screen.findByText(/Approved by Dr\. Rao/)).toBeInTheDocument();
    expect(screen.getAllByText(/Someone else already decided this/).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'GET' && c.path === '/approvals/a1').length).toBeGreaterThan(1);
  });

  it('opens the request named in the address', async () => {
    mount({ inbox: [waiting], detail: detailOf(waiting) }, '/approvals?id=a1');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(await screen.findByText('Your decision')).toBeInTheDocument();
  });

  it('explains an empty inbox and an empty list of my requests', async () => {
    mount({ inbox: [], mine: [] });
    expect(await screen.findByText('Nothing is waiting for you')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: 'My requests' }));
    expect(await screen.findByText('You have not sent any requests')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'approved');
    expect(await screen.findByText('No approved requests')).toBeInTheDocument();
  });

  it('pages through a long inbox', async () => {
    const { calls } = mount({ inbox: [waiting], total: 45 });
    expect(await screen.findByText('Page 1 of 3 · 45 requests')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(calls.some((c) => c.path.startsWith('/approvals?') && c.path.includes('page=2'))).toBe(true));
  });

  it('shows nothing of approvals in a read-only support visit, and does not ask the server', async () => {
    const { calls } = mount({ visit: true, inbox: [waiting] });
    expect(await screen.findByText('Approvals are not shown in a support visit')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Approvals' })).not.toBeInTheDocument();
    expect(calls.some((c) => c.path.startsWith('/approvals'))).toBe(false);
  });
});

describe('approval logic', () => {
  const now = new Date('2026-11-22T12:00:00Z');
  it('writes waiting time and steps for people', () => {
    expect(waitingTime('2026-11-22T11:59:50Z', now)).toBe('Just now');
    expect(waitingTime('2026-11-22T11:25:00Z', now)).toBe('35 min');
    expect(waitingTime('2026-11-22T07:00:00Z', now)).toBe('5 h');
    expect(waitingTime('2026-11-21T10:00:00Z', now)).toBe('1 day');
    expect(waitingTime('2026-11-16T10:00:00Z', now)).toBe('6 days');
    expect(waitingTime('2026-11-01T10:00:00Z', now)).toBe('3 weeks');
    expect(stepText({ currentStep: 2, stepCount: 3 })).toBe('2 of 3');
  });
  it('says when a closed request was decided', () => {
    expect(rowTiming(base('x', { status: 'approved', decidedAt: '2026-11-20T10:00:00Z' }), now)).toMatch(/^Approved /);
    expect(rowTiming(base('x', { createdAt: '2026-11-21T10:00:00Z' }), now)).toBe('Waiting 1 day');
  });
});
