import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebSession } from '../../shell/web-session';
import { ShellApp } from '../../shell/ShellApp';
import { NAV_ICONS } from '../../shell/navIcons';
import { registry } from '../../shell/registry';
import { blockedText, nextAction, readyBlock, reviewBlock, type ControlTower, type TowerDomain } from './controlTower';

const VIEW = ['onb.control_tower.view'];
const EDIT = [...VIEW, 'onb.control_tower.edit'];

function dom(id: string, title: string, over: Partial<TowerDomain> = {}): TowerDomain {
  return { id, title, module: 'x', status: 'not_started', percent: 0, hasSource: false, note: 'No data source yet', checks: [], blockers: [], ownerId: null, ownerName: null, dueDate: null, overdue: false, state: 'open', openImports: 0, reviewRequestedAt: null, readyAt: null, ...over };
}
const ACADEMIC = dom('academic', 'Academic structure', { status: 'needs_review', percent: 100, hasSource: true, note: undefined, state: 'review', ownerId: 'u1', ownerName: 'Asha Verma', checks: [{ key: 'years', label: 'Academic years', done: 1, total: 1 }] });
const STUDENTS = dom('students', 'Students and guardians', {
  status: 'in_progress', percent: 62, hasSource: true, note: undefined, overdue: true, dueDate: '2026-11-01', openImports: 2, blockers: [{ id: 'academic', title: 'Academic structure' }],
  checks: [{ key: 'students', label: 'Students with a class', done: 310, total: 500 }],
});
const FEES = dom('fees', 'Fees', { blockers: [{ id: 'students', title: 'Students and guardians' }] });
const TOWER: ControlTower = { domains: [ACADEMIC, STUDENTS, FEES], total: 3, ready: 0, percent: 20 };

type Call = { method: string; path: string; body?: unknown };

function mount(permissions: string[], handler: (p: string, method: string) => { status: number; body?: unknown } | undefined = () => undefined, tower: ControlTower = TOWER) {
  const calls: Call[] = [];
  const json = (status: number, body?: unknown) => new Response(JSON.stringify(body ?? {}), { status, headers: { 'Content-Type': 'application/json' } });
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://x');
    const p = url.pathname.replace('/api/v1', '');
    const method = init?.method ?? 'GET';
    calls.push({ method, path: p, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (p === '/auth/refresh') return json(200, { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 9e5).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 9e8).toISOString(), mustChangePassword: false });
    if (p === '/me/access')
      return json(200, {
        user: { id: 'u1', name: 'Asha', tier: 'tenant' }, tenant: { id: 't1', name: 'School', brand: { primary: '#2F5BFF' }, modules: ['onb'] }, permissions, scopes: {}, fieldMasks: {},
        workspace: { home: 'x', navigation: [{ screenId: 'control_tower', label: 'Control tower', order: 3 }] }, mobile: { tabs: [], features: [] }, approvals: { canApprove: [] }, version: 1,
      });
    const custom = handler(p, method);
    if (custom) return json(custom.status, custom.body);
    if (p === '/onboarding/control-tower') return json(200, tower);
    if (p === '/colleagues') return json(200, { items: [{ id: 'u2', displayName: 'Ravi Nair', label: 'Teacher' }] });
    if (p.startsWith('/onboarding/control-tower/domains/')) return json(200, ACADEMIC);
    return json(404, {});
  }) as typeof fetch;
  render(
    <MemoryRouter initialEntries={['/control-tower']}>
      <ShellApp session={createWebSession(fetchFn)} />
    </MemoryRouter>,
  );
  return calls;
}

afterEach(() => vi.restoreAllMocks());

describe('registration', () => {
  it('has a web path, a phone route, an icon and the permission the server uses', () => {
    expect(registry.control_tower).toMatchObject({ module: 'onb', permission: 'onb.control_tower.view', parity: 'Both', web: { path: '/control-tower' }, mobile: { route: '/control-tower' } });
    expect(NAV_ICONS.control_tower).toBeDefined();
  });
});

describe('wording', () => {
  it('names what blocks a domain', () => {
    expect(blockedText({ blockers: [] })).toBe('');
    expect(blockedText(STUDENTS)).toBe('Blocked because Academic structure is not ready yet.');
    expect(blockedText({ blockers: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }, { id: 'c', title: 'C' }] })).toBe('Blocked because A, B and C are not ready yet.');
  });
  it('explains why a mark is refused', () => {
    expect(reviewBlock(FEES)).toBe('No data source yet');
    expect(reviewBlock(STUDENTS)).toMatch(/62 %/);
    expect(reviewBlock(ACADEMIC)).toBeNull();
    expect(readyBlock(STUDENTS)).toMatch(/^Blocked because/);
    expect(readyBlock(ACADEMIC)).toBeNull();
  });
  it('picks the next best action', () => {
    expect(nextAction(FEES, true)).toMatch(/not built/);
    expect(nextAction(STUDENTS, true)).toBe('Finish 2 open imports.');
    expect(nextAction({ ...STUDENTS, openImports: 0 }, true)).toBe('Students with a class: 190 left.');
    expect(nextAction(ACADEMIC, true)).toBe('Confirm it as ready.');
    expect(nextAction(ACADEMIC, false)).toBe('Waiting for someone to confirm it.');
    expect(nextAction({ ...ACADEMIC, state: 'open', status: 'in_progress' }, true)).toBe('Mark it for review.');
    expect(nextAction({ ...ACADEMIC, status: 'ready', state: 'ready' }, true)).toMatch(/Done/);
  });
});

describe('the board', () => {
  it('groups domains by status with progress, owner, overdue and blocked text', async () => {
    mount(VIEW);
    expect(await screen.findByText('Students and guardians')).toBeInTheDocument();
    expect(screen.getByText('0 of 3 domains ready')).toBeInTheDocument();
    const students = within(screen.getByTestId('domain-students'));
    expect(students.getByRole('progressbar', { name: 'Students and guardians readiness' })).toHaveAttribute('aria-valuenow', '62');
    expect(students.getByText('Overdue')).toBeInTheDocument();
    expect(students.getByText('Blocked because Academic structure is not ready yet.')).toBeInTheDocument();
    const fees = within(screen.getByTestId('domain-fees'));
    expect(fees.getByText('No data source yet')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: /^Needs review/ })).getByText('Academic structure')).toBeInTheDocument();
  });

  it('shows an error with a way to try again', async () => {
    let fail = true;
    mount(VIEW, (p) => (p === '/onboarding/control-tower' && fail ? { status: 500, body: { detail: 'The tower could not be loaded.' } } : undefined));
    expect(await screen.findByRole('alert')).toHaveTextContent('The tower could not be loaded.');
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Academic structure')).toBeInTheDocument();
  });

  it('says so when no domain applies', async () => {
    mount(VIEW, undefined, { domains: [], total: 0, ready: 0, percent: 0 });
    expect(await screen.findByText(/No data areas to track yet/)).toBeInTheDocument();
  });

  it('shows a not-permitted message when the server refuses, and not available without the permission', async () => {
    mount(VIEW, (p) => (p === '/onboarding/control-tower' ? { status: 403, body: { detail: 'no' } } : undefined));
    expect(await screen.findByText('You do not have access to the control tower.')).toBeInTheDocument();
  });

  it('is not available without the view permission', async () => {
    const calls = mount(['onb.workspace.view']);
    expect(await screen.findByText('Not available')).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/onboarding/control-tower')).toBe(false);
  });
});

describe('editing', () => {
  it('hides every edit control without the edit permission', async () => {
    mount(VIEW);
    await userEvent.click(await screen.findByRole('button', { name: 'Details of Academic structure' }));
    const sheet = within(await screen.findByTestId('domain-detail'));
    expect(sheet.getByText('Academic years')).toBeInTheDocument();
    expect(sheet.queryByRole('button', { name: /Confirm ready|Mark for review|Save owner/ })).toBeNull();
    expect(sheet.queryByLabelText('Due date')).toBeNull();
  });

  it('disables the marks of a placeholder domain and says why', async () => {
    mount(EDIT);
    await userEvent.click(await screen.findByRole('button', { name: 'Details of Fees' }));
    const sheet = within(await screen.findByTestId('domain-detail'));
    const btn = sheet.getByRole('button', { name: 'Mark for review' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAccessibleDescription('No data source yet');
    expect(sheet.getByText('Blocked because Students and guardians is not ready yet.')).toBeInTheDocument();
  });

  it('keeps Confirm ready disabled while a prerequisite is not ready', async () => {
    const stuck = dom('students', 'Students and guardians', { ...STUDENTS, percent: 100, state: 'review', status: 'needs_review' });
    mount(EDIT, undefined, { ...TOWER, domains: [stuck] });
    await userEvent.click(await screen.findByRole('button', { name: 'Details of Students and guardians' }));
    const sheet = within(await screen.findByTestId('domain-detail'));
    expect(sheet.getByRole('button', { name: 'Confirm ready' })).toBeDisabled();
    expect(sheet.getByRole('button', { name: 'Withdraw review' })).toBeEnabled();
  });

  it('confirms a reviewed domain ready', async () => {
    const calls = mount(EDIT);
    await userEvent.click(await screen.findByRole('button', { name: 'Details of Academic structure' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm ready' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/onboarding/control-tower/domains/academic/state')).toBe(true));
    expect(calls.find((c) => c.path.endsWith('/state'))!.body).toEqual({ to: 'ready' });
  });

  it('shows the reason when the server refuses a mark', async () => {
    mount(EDIT, (p, m) => (m === 'POST' ? { status: 409, body: { detail: 'Students and guardians must be ready first.' } } : undefined));
    await userEvent.click(await screen.findByRole('button', { name: 'Details of Academic structure' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm ready' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Students and guardians must be ready first.');
  });

  it('saves the owner and due date', async () => {
    const calls = mount(EDIT);
    await userEvent.click(await screen.findByRole('button', { name: 'Details of Academic structure' }));
    const sheet = within(await screen.findByTestId('domain-detail'));
    await userEvent.type(sheet.getByLabelText('Due date'), '2026-12-15');
    await userEvent.click(sheet.getByRole('button', { name: 'Save owner and due date' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true));
    expect(calls.find((c) => c.method === 'PUT')).toMatchObject({ path: '/onboarding/control-tower/domains/academic', body: { ownerId: 'u1', dueDate: '2026-12-15' } });
  });
});
