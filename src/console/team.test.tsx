import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ConsoleApp } from './ConsoleApp';
import { createPlatformSession } from './platform-session';

const me = { id: 'p1', email: 'ops@shikshit.app', name: 'Rohan Mehta' };
const team = [
  { id: 'p1', email: 'ops@shikshit.app', name: 'Rohan Mehta', status: 'active', mfaEnabled: true, lastLoginAt: '2026-11-22T00:00:00Z', createdAt: '' },
  { id: 'p2', email: 'meera@shikshit.app', name: 'Meera Iyer', status: 'active', mfaEnabled: true, lastLoginAt: null, createdAt: '' },
];

function mount(path = '/team') {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const tokens = { accessToken: 'p1', accessTokenExpiresAt: '', refreshTokenExpiresAt: '', mustChangePassword: false };
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://x');
    const p = url.pathname.replace('/api/v1', '');
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path: p, body });
    if (p === '/platform/auth/refresh') return json(200, tokens);
    if (p === '/platform/me') return json(200, me);
    if (p === '/platform/users' && method === 'POST') return json(201, { id: 'p3', email: body.email, name: body.name, status: 'invited', mfaEnabled: false, lastLoginAt: null, createdAt: '', link: '/accept-invite?token=abc' });
    if (p === '/platform/users') return json(200, { items: team });
    if (p === '/platform/users/p2/disable') return json(200, { ...team[1], status: 'disabled' });
    if (p === '/platform/users/p2/reset-password') return json(200, { ...team[1], link: '/accept-invite?token=new', emailQueued: true });
    if (p === '/platform/auth/invite/accept') return body.token === 'good' ? new Response(null, { status: 204 }) : json(400, { code: 'invalid_token', detail: 'This link is not valid any more. Ask a colleague for a new one.' });
    return json(404, {});
  }) as typeof fetch;
  render(
    <MemoryRouter initialEntries={[path]}>
      <ConsoleApp session={createPlatformSession(fetchFn)} fetchFn={fetchFn} />
    </MemoryRouter>,
  );
  return calls;
}

describe('console team', () => {
  it('lists the team and offers no actions on your own account', async () => {
    mount();
    const row = (await screen.findByText('Meera Iyer')).closest('tr') as HTMLElement;
    expect(within(row).getByRole('button', { name: 'Disable Meera Iyer' })).toBeInTheDocument();
    const mine = screen.getByText('(you)').closest('tr') as HTMLElement;
    expect(within(mine).queryAllByRole('button')).toHaveLength(0);
  });

  it('invites a colleague and shows their one-time link', async () => {
    const calls = mount();
    await userEvent.click(await screen.findByRole('button', { name: /^Invite$/ }));
    const sheet = screen.getByRole('dialog');
    await userEvent.type(within(sheet).getByLabelText(/^Name/), 'Kabir Rao');
    await userEvent.type(within(sheet).getByLabelText(/^Work email/), 'kabir@shikshit.app');
    await userEvent.click(within(sheet).getByRole('button', { name: /Invite/ }));
    expect(await screen.findByTestId('platform-link')).toHaveTextContent('/accept-invite?token=abc');
    expect(calls.find((c) => c.method === 'POST' && c.path === '/platform/users')?.body).toEqual({ email: 'kabir@shikshit.app', name: 'Kabir Rao' });
  });

  it('disables only after confirming, and a password reset shows a new link', async () => {
    const calls = mount();
    await userEvent.click(await screen.findByRole('button', { name: 'Disable Meera Iyer' }));
    expect(calls.some((c) => c.path === '/platform/users/p2/disable')).toBe(false);
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Disable' }));
    expect(await screen.findByText('Disabled: Meera Iyer')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'New password link Meera Iyer' }));
    expect(await screen.findByTestId('platform-link')).toHaveTextContent('/accept-invite?token=new');
    expect(screen.getByText(/We emailed this link to/)).toHaveTextContent(team[1].email);
  });

  it('sets a password from a link without being signed in', async () => {
    window.history.pushState(null, '', '/accept-invite?token=good');
    mount('/accept-invite');
    await userEvent.type(await screen.findByLabelText('New password'), 'a long password');
    await userEvent.type(screen.getByLabelText('Type it again'), 'a long password');
    await userEvent.click(screen.getByRole('button', { name: 'Set password' }));
    expect(await screen.findByRole('heading', { name: 'Password set' })).toBeInTheDocument();
  });

  it('explains a used link', async () => {
    window.history.pushState(null, '', '/accept-invite?token=used');
    mount('/accept-invite');
    await userEvent.type(await screen.findByLabelText('New password'), 'a long password');
    await userEvent.type(screen.getByLabelText('Type it again'), 'a long password');
    await userEvent.click(screen.getByRole('button', { name: 'Set password' }));
    expect(await screen.findByText(/not valid any more/)).toBeInTheDocument();
  });
});
