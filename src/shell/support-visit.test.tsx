import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { SupportVisitApp } from './SupportVisit';

function mount(redeemOk = true) {
  window.history.pushState(null, '', '/support-visit?code=' + 'c'.repeat(64));
  const calls: { method: string; path: string; auth: string | null }[] = [];
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  let ended = false;
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://x');
    const p = url.pathname.replace('/api/v1', '');
    calls.push({ method: init?.method ?? 'GET', path: p, auth: new Headers(init?.headers).get('Authorization') });
    if (p === '/auth/support-visit') return redeemOk ? json(200, { accessToken: 'v1', accessTokenExpiresAt: '', refreshTokenExpiresAt: '', mustChangePassword: false }) : json(401, { code: 'invalid_visit_code', detail: 'This visit link is not valid any more. Start a new visit from the console.' });
    if (p === '/support-visit/end') {
      ended = true;
      return new Response(null, { status: 204 });
    }
    if (ended) return json(401, {});
    if (p === '/me/access')
      return json(200, {
        user: { id: 'p1', name: 'Rohan Mehta', tier: 'tenant' }, tenant: { id: 't1', name: 'School', brand: { primary: '#1F3A5F' }, modules: ['iam'] },
        visit: { by: 'Rohan Mehta', reason: 'Fees report shows the wrong total', expiresAt: new Date(Date.now() + 18e5).toISOString() },
        permissions: ['iam.users.view'], scopes: {}, fieldMasks: {}, workspace: { home: 'admin', navigation: [] }, mobile: { tabs: [], features: [] }, approvals: { canApprove: [] }, version: 0,
      });
    return json(200, { items: [], page: { number: 1, size: 25, total: 0 } });
  }) as typeof fetch;
  render(
    <MemoryRouter>
      <SupportVisitApp fetchFn={fetchFn} />
    </MemoryRouter>,
  );
  return calls;
}

describe('support visit', () => {
  it('opens a read-only visit, takes the code out of the address bar and shows who is visiting', async () => {
    const calls = mount();
    expect(window.location.pathname + window.location.search).toBe('/');
    expect(await screen.findByText('Read-only support visit')).toBeInTheDocument();
    expect(screen.getByText(/Fees report shows the wrong total/)).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/me/access')?.auth).toBe('Bearer v1');

    await userEvent.click(screen.getByRole('button', { name: 'End visit' }));
    expect(await screen.findByText('The support visit has ended')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST' && c.path === '/support-visit/end')).toBe(true);
  });

  it('says why a used or expired link does not open', async () => {
    mount(false);
    expect(await screen.findByText('This visit cannot be opened')).toBeInTheDocument();
    expect(screen.getByText(/not valid any more/)).toBeInTheDocument();
  });
});
