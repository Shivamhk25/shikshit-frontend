import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebSession } from '../../shell/web-session';
import { ShellApp } from '../../shell/ShellApp';
import { NAV_ICONS } from '../../shell/navIcons';
import { registry } from '../../shell/registry';
import { domainVerdict, type GoLiveDomain, type GoLiveGate } from './goLive';

const VIEW = ['onb.golive.view'];
const SIGN = [...VIEW, 'onb.golive.signoff'];
const d = (id: string, title: string, o: Partial<GoLiveDomain> = {}): GoLiveDomain => ({ id, title, status: 'ready', percent: 100, assessable: true, ready: true, ...o });
const READY: GoLiveGate = { tenantStatus: 'onboarding', open: true, domains: [d('academic', 'Academic structure')], reasons: [], history: [] };
const BLOCKED: GoLiveGate = {
  tenantStatus: 'onboarding', open: false, reasons: ['Fees has no data source yet.'], history: [],
  domains: [d('academic', 'Academic structure'), d('students', 'Students', { status: 'in_progress', percent: 62, ready: false }), d('fees', 'Fees', { assessable: false, ready: false, percent: 0, status: 'not_started' })],
};
const LIVE: GoLiveGate = { ...READY, tenantStatus: 'live', open: false, active: { id: 's1', signedBy: 'u1', signedByName: 'Asha', signedAt: '2026-11-20T10:00:00Z', notes: 'All good', snapshot: [] }, history: [] };

type Call = { method: string; path: string; body?: unknown };
function mount(permissions: string[], gate: GoLiveGate, reply?: (p: string) => { status: number; body: unknown } | undefined) {
  const calls: Call[] = [];
  const json = (status: number, body?: unknown) => new Response(JSON.stringify(body ?? {}), { status, headers: { 'Content-Type': 'application/json' } });
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const p = new URL(String(input), 'http://x').pathname.replace('/api/v1', '');
    calls.push({ method: init?.method ?? 'GET', path: p, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (p === '/auth/refresh') return json(200, { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 9e5).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 9e8).toISOString(), mustChangePassword: false });
    if (p === '/me/access')
      return json(200, { user: { id: 'u1', name: 'Asha', tier: 'tenant' }, tenant: { id: 't1', name: 'School', brand: { primary: '#2F5BFF' }, modules: ['onb'] }, permissions, scopes: {}, fieldMasks: {}, workspace: { home: 'x', navigation: [{ screenId: 'go_live', label: 'Go-live', order: 4 }] }, mobile: { tabs: [], features: [] }, approvals: { canApprove: [] }, version: 1 });
    const r = reply?.(p);
    if (r) return json(r.status, r.body);
    if (p === '/onboarding/go-live') return json(200, gate);
    if (p.startsWith('/onboarding/go-live/')) return json(201, {});
    return json(404, {});
  }) as typeof fetch;
  render(
    <MemoryRouter initialEntries={['/go-live']}>
      <ShellApp session={createWebSession(fetchFn)} />
    </MemoryRouter>,
  );
  return calls;
}
afterEach(() => vi.restoreAllMocks());

describe('go-live', () => {
  it('is registered with the server permission', () => {
    expect(registry.go_live).toMatchObject({ module: 'onb', permission: 'onb.golive.view', parity: 'Both', web: { path: '/go-live' }, mobile: { route: '/go-live' } });
    expect(NAV_ICONS.go_live).toBeDefined();
  });
  it('words each domain', () => {
    expect(domainVerdict(d('a', 'A'))).toBe('Ready');
    expect(domainVerdict(d('a', 'A', { ready: false, percent: 40 }))).toBe('Not ready (40 %)');
    expect(domainVerdict(d('a', 'A', { assessable: false, ready: false }))).toMatch(/No data source/);
  });
  it('blocks sign-off and shows why while a domain is not ready', async () => {
    mount(SIGN, BLOCKED);
    expect(await screen.findByText('Go-live is blocked')).toBeInTheDocument();
    expect(screen.getByText('Fees has no data source yet.', { selector: 'li' })).toBeInTheDocument();
    expect(within(screen.getByTestId('golive-students')).getByText('Not ready (62 %)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign off and go live/ })).toBeDisabled();
  });
  it('hides the buttons from someone who may only view', async () => {
    mount(VIEW, READY);
    expect(await screen.findByText(/You can go live/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Sign off/ })).toBeNull();
  });
  it('signs off with notes', async () => {
    const calls = mount(SIGN, READY);
    await userEvent.click(await screen.findByRole('button', { name: /Sign off and go live/ }));
    await userEvent.type(await screen.findByLabelText('Notes (optional)'), 'Checked');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm go-live' }));
    await waitFor(() => expect(calls.find((c) => c.path === '/onboarding/go-live/sign-off')?.body).toEqual({ notes: 'Checked' }));
  });
  it('shows the server refusal when sign-off is rejected', async () => {
    mount(SIGN, READY, (p) => (p.endsWith('/sign-off') ? { status: 409, body: { detail: 'Fees is not ready.' } } : undefined));
    await userEvent.click(await screen.findByRole('button', { name: /Sign off and go live/ }));
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm go-live' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Fees is not ready.');
  });
  it('revokes only with a reason', async () => {
    const calls = mount(SIGN, LIVE);
    await userEvent.click(await screen.findByRole('button', { name: 'Revoke sign-off' }));
    const go = await screen.findByRole('button', { name: /Revoke and return/ });
    expect(go).toBeDisabled();
    await userEvent.type(screen.getByLabelText('Reason'), 'Data wrong');
    await userEvent.click(go);
    await waitFor(() => expect(calls.find((c) => c.path === '/onboarding/go-live/revoke')?.body).toEqual({ reason: 'Data wrong' }));
  });
  it('tells a user without the permission', async () => {
    const calls = mount([], READY);
    await waitFor(() => expect(calls.some((c) => c.path === '/me/access')).toBe(true));
    await new Promise((r) => setTimeout(r, 50));
    expect(screen.queryByText('Checklist')).toBeNull();
    expect(calls.some((c) => c.path === '/onboarding/go-live')).toBe(false);
  });
});
