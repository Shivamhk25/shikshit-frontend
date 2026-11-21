import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { createWebSession } from './web-session';
import { ShellApp } from './ShellApp';

interface Opts {
  permissions: string[];
  navigation: { screenId: string; label: string; order: number }[];
  hasCookie?: boolean;
  loginFails?: boolean;
}

/** A fake server speaking the real contract: cookie-held refresh token, /auth/*, /me/access. */
function fakeServer(o: Opts) {
  let cookie = o.hasCookie ?? false;
  const calls: string[] = [];
  const json = (status: number, body: unknown, h: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...h } });
  const tokens = () => {
    cookie = true;
    return { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 9e8).toISOString(), mustChangePassword: false };
  };
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input).replace('/api/v1', '');
    calls.push(path);
    if (path === '/auth/login') return o.loginFails ? json(401, { code: 'invalid_credentials', detail: 'Incorrect username or password.' }) : json(200, tokens());
    if (path === '/auth/refresh') return cookie ? json(200, tokens()) : json(400, { code: 'validation_failed' });
    if (path === '/auth/logout') {
      cookie = false;
      return new Response(null, { status: 204 });
    }
    if (path === '/me/access') {
      if (new Headers(init?.headers).get('Authorization') !== 'Bearer a1') return json(401, { code: 'unauthenticated' });
      return json(
        200,
        {
          user: { id: 'u1', name: 'Asha Verma', tier: 'tenant' },
          tenant: { id: 't1', name: 'Springfield School', brand: { primary: '#2F5BFF' }, modules: ['onb'] },
          permissions: o.permissions,
          scopes: {},
          fieldMasks: {},
          workspace: { home: 'x', navigation: o.navigation },
          mobile: { tabs: [], features: [] },
          approvals: { canApprove: [] },
          version: 1,
        },
        { 'X-Access-Version': '1' },
      );
    }
    return json(404, {});
  }) as typeof fetch;
  return { fetchFn, calls };
}

const NAV = [
  { screenId: 'home', label: 'Home', order: 1 },
  { screenId: 'onboarding', label: 'Onboarding', order: 2 },
  { screenId: 'profile', label: 'Profile', order: 90 },
];

function mount(o: Opts, path = '/') {
  const server = fakeServer(o);
  render(
    <MemoryRouter initialEntries={[path]}>
      <ShellApp session={createWebSession(server.fetchFn)} />
    </MemoryRouter>,
  );
  return server;
}

afterEach(() => {
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('style');
});

describe('web shell', () => {
  it('shows the sign-in page when there is no session', async () => {
    mount({ permissions: [], navigation: NAV });
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('signs in and shows the workspace named by the server', async () => {
    mount({ permissions: [], navigation: NAV });
    await userEvent.type(await screen.findByLabelText('Username'), 'asha');
    await userEvent.type(screen.getByLabelText('Password'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('heading', { name: 'Welcome, Asha Verma' })).toBeInTheDocument();
    expect(screen.getByText('Springfield School')).toBeInTheDocument();
  });

  it('shows the server message on a failed sign-in and stays on the form', async () => {
    mount({ permissions: [], navigation: NAV, loginFails: true });
    await userEvent.type(await screen.findByLabelText('Username'), 'asha');
    await userEvent.type(screen.getByLabelText('Password'), 'nope');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('Incorrect username or password.')).toBeInTheDocument();
    expect(screen.queryByText(/Welcome/)).not.toBeInTheDocument();
  });

  it('restores the session from the cookie on page load without asking for a password', async () => {
    mount({ permissions: [], navigation: NAV, hasCookie: true });
    expect(await screen.findByRole('heading', { name: 'Welcome, Asha Verma' })).toBeInTheDocument();
  });

  it('hides navigation the user lacks permission for and shows what they hold', async () => {
    mount({ permissions: [], navigation: NAV, hasCookie: true });
    await screen.findByRole('heading', { name: 'Welcome, Asha Verma' });
    expect(screen.getByRole('link', { name: 'Home' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Onboarding' })).not.toBeInTheDocument();
  });

  it('offers a permitted screen and opens it', async () => {
    mount({ permissions: ['onb.workspace.view'], navigation: NAV, hasCookie: true });
    const menu = await screen.findByRole('navigation', { name: 'Main navigation' });
    await userEvent.click(within(menu).getByRole('link', { name: 'Onboarding' }));
    expect(await screen.findByRole('heading', { name: 'Onboarding' })).toBeInTheDocument();
  });

  it('offers each permitted screen as a shortcut on the home page', async () => {
    mount({ permissions: ['onb.workspace.view'], navigation: NAV, hasCookie: true });
    await screen.findByRole('heading', { name: 'Welcome, Asha Verma' });
    const main = screen.getByRole('main');
    expect(within(main).getByRole('link', { name: /^Onboarding/ })).toHaveAttribute('href', '/onboarding');
    expect(within(main).queryByRole('link', { name: 'Home' })).not.toBeInTheDocument();
  });

  it('blocks a direct visit to a screen the user is not permitted to open', async () => {
    mount({ permissions: [], navigation: NAV, hasCookie: true }, '/onboarding');
    expect(await screen.findByRole('alert')).toHaveTextContent('Not available');
  });

  it('skips a screen the server offers that this build does not know', async () => {
    mount({ permissions: [], navigation: [...NAV, { screenId: 'future-thing', label: 'Future', order: 50 }], hasCookie: true });
    await screen.findByRole('heading', { name: 'Welcome, Asha Verma' });
    expect(screen.queryByRole('link', { name: 'Future' })).not.toBeInTheDocument();
  });

  it('applies the institute brand colour', async () => {
    mount({ permissions: [], navigation: NAV, hasCookie: true });
    await screen.findByRole('heading', { name: 'Welcome, Asha Verma' });
    await waitFor(() => expect(document.documentElement.getAttribute('data-theme')).toBe('light'));
  });

  it('signs out and returns to the sign-in page', async () => {
    const server = mount({ permissions: [], navigation: NAV, hasCookie: true });
    await userEvent.click(await screen.findByRole('button', { name: 'Sign out' }));
    expect(await screen.findByRole('heading', { name: 'Sign in' })).toBeInTheDocument();
    expect(server.calls).toContain('/auth/logout');
  });
});
