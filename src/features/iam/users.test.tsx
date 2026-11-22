import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { createWebSession } from '../../shell/web-session';
import { ShellApp } from '../../shell/ShellApp';
import { AcceptInvitePage } from '../../shell/AcceptInvitePage';
import type { User } from './usersApi';

const ALL = ['iam.users.view', 'iam.users.create', 'iam.users.edit'];

function user(id: string, over: Partial<User> = {}): User {
  return { id, username: id, displayName: `Person ${id}`, email: null, phone: null, status: 'active', personType: null, personId: null, mustChangePassword: false, mfaEnabled: false, failedLoginCount: 0, lockedUntil: null, lastLoginAt: null, createdAt: '2026-11-01T00:00:00Z', ...over };
}

/** A fake of the contract: cookie session, /me/access as user "me", and the users endpoints. */
function fakeServer(permissions: string[], initial: User[]) {
  const users = [...initial];
  const calls: { method: string; path: string; body?: Record<string, unknown> }[] = [];
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://x');
    const path = url.pathname.replace('/api/v1', '');
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    calls.push({ method, path: path + url.search, body });
    if (path === '/auth/refresh') return json(200, { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 9e5).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 9e8).toISOString(), mustChangePassword: false });
    if (path === '/me/access') {
      return json(200, {
        user: { id: 'me', name: 'Asha', tier: 'tenant' },
        tenant: { id: 't1', name: 'School', brand: { primary: '#1F3A5F' }, modules: ['iam'] },
        permissions,
        scopes: {},
        fieldMasks: {},
        workspace: { home: 'x', navigation: [{ screenId: 'home', label: 'Home', order: 1 }, { screenId: 'users', label: 'Users', order: 2 }] },
        mobile: { tabs: [], features: [] },
        approvals: { canApprove: [] },
        version: 1,
      });
    }
    if (path === '/users' && method === 'GET') {
      const status = url.searchParams.get('status');
      const items = users.filter((u) => !status || u.status === status);
      return json(200, { items, page: { number: 1, size: 25, total: items.length } });
    }
    if (path === '/users' && method === 'POST') {
      const u = user('new1', { username: String(body?.username), displayName: String(body?.displayName), status: 'invited' });
      users.push(u);
      return json(201, { ...u, inviteLink: '/accept-invite?token=abc123' });
    }
    const m = /^\/users\/([^/]+)\/(.+)$/.exec(path);
    if (m && method === 'POST') {
      const u = users.find((x) => x.id === m[1])!;
      if (m[2] === 'deactivate') u.status = 'disabled';
      if (m[2] === 'reset-password') return json(200, { ...u, resetLink: '/accept-invite?token=reset9' });
      return json(200, u);
    }
    return json(404, {});
  }) as typeof fetch;
  return { fetchFn, calls };
}

function mount(permissions: string[], initial: User[]) {
  const server = fakeServer(permissions, initial);
  render(
    <MemoryRouter initialEntries={['/users']}>
      <ShellApp session={createWebSession(server.fetchFn)} />
    </MemoryRouter>,
  );
  return server;
}

const row = async (name: string) => (await screen.findByText(name)).closest('tr')!;

describe('users page', () => {
  it('shows users read-only without the edit and create permissions', async () => {
    mount(['iam.users.view'], [user('u1')]);
    expect(await screen.findByText('Person u1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Add user/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).not.toBeInTheDocument();
  });

  it('offers only the actions the server accepts for each status, and never disabling yourself', async () => {
    mount(ALL, [user('me', { displayName: 'Myself' }), user('inv', { status: 'invited' }), user('off', { status: 'disabled' }), user('lck', { status: 'locked' })]);
    const mine = within(await row('Myself'));
    expect(mine.queryByRole('button', { name: /^Disable/ })).not.toBeInTheDocument();
    expect(mine.queryByRole('button', { name: /^Lock/ })).not.toBeInTheDocument();
    expect(mine.getByRole('button', { name: /^Reset password/ })).toBeInTheDocument();
    const invited = within(await row('Person inv'));
    expect(invited.queryByRole('button', { name: /^Lock/ })).not.toBeInTheDocument();
    expect(invited.getByRole('button', { name: /^Disable/ })).toBeInTheDocument();
    const off = within(await row('Person off'));
    expect(off.getAllByRole('button').map((b) => b.textContent)).toEqual(['', 'Reactivate']);
    expect(within(await row('Person lck')).getByRole('button', { name: /^Unlock/ })).toBeInTheDocument();
  });

  it('adds a user and shows the one-time invite link as a full address', async () => {
    const server = mount(ALL, []);
    await userEvent.click(await screen.findByRole('button', { name: /Add user/ }));
    await userEvent.type(screen.getByLabelText(/Username/), 'teacher1');
    await userEvent.type(screen.getByLabelText(/Display name/), 'Asha Rao');
    await userEvent.click(screen.getByRole('button', { name: /Add and get invite link/ }));
    expect(await screen.findByTestId('one-time-link')).toHaveTextContent(`${window.location.origin}/accept-invite?token=abc123`);
    expect(server.calls.find((c) => c.method === 'POST' && c.path === '/users')?.body).toEqual({ username: 'teacher1', displayName: 'Asha Rao', email: null, phone: null });
  });

  it('asks before disabling, then disables', async () => {
    const server = mount(ALL, [user('u1')]);
    await userEvent.click(within(await row('Person u1')).getByRole('button', { name: /^Disable/ }));
    expect(server.calls.some((c) => c.path.endsWith('/deactivate'))).toBe(false);
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Disable' }));
    expect(await screen.findByText('Disabled', { selector: 'span' })).toBeInTheDocument();
    expect(server.calls.some((c) => c.method === 'POST' && c.path === '/users/u1/deactivate')).toBe(true);
  });

  it('shows the reset link once it is issued', async () => {
    mount(ALL, [user('u1')]);
    await userEvent.click(within(await row('Person u1')).getByRole('button', { name: /^Reset password/ }));
    expect(await screen.findByTestId('one-time-link')).toHaveTextContent('/accept-invite?token=reset9');
  });
});

describe('accept invite page', () => {
  it('checks the password locally, then sends it with the token', async () => {
    const submit = vi.fn().mockResolvedValue(undefined);
    render(<AcceptInvitePage token="tok" submit={submit} />);
    await userEvent.type(screen.getByLabelText('New password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Set password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('at least 10');
    await userEvent.clear(screen.getByLabelText('New password'));
    await userEvent.type(screen.getByLabelText('New password'), 'a quiet morning walk');
    await userEvent.type(screen.getByLabelText('Type it again'), 'a quiet morning');
    await userEvent.click(screen.getByRole('button', { name: 'Set password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('not the same');
    expect(submit).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText('Type it again'), ' walk');
    await userEvent.click(screen.getByRole('button', { name: 'Set password' }));
    expect(await screen.findByText('Your password is set')).toBeInTheDocument();
    expect(submit).toHaveBeenCalledWith(expect.any(String), 'tok', 'a quiet morning walk');
  });

  it('shows the server message when the link is used up', async () => {
    render(<AcceptInvitePage token="tok" submit={vi.fn().mockRejectedValue(new Error('This link is not valid any more.'))} />);
    await userEvent.type(screen.getByLabelText('New password'), 'a quiet morning walk');
    await userEvent.type(screen.getByLabelText('Type it again'), 'a quiet morning walk');
    await userEvent.click(screen.getByRole('button', { name: 'Set password' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('not valid any more');
  });

  it('explains an incomplete link', () => {
    render(<AcceptInvitePage token="" />);
    expect(screen.getByRole('alert')).toHaveTextContent('incomplete');
  });
});
