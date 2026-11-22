import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ConsoleApp } from './ConsoleApp';
import { consoleBase, createPlatformSession } from './platform-session';
import { suggestCode } from './institutes';

const plans = [
  { code: 'standard', name: 'Standard', modules: ['iam', 'aca', 'stu'] },
  { code: 'premium', name: 'Premium', modules: ['iam', 'aca', 'stu', 'lib'] },
];
const gamma = { id: 'i1', code: 'gamma', name: 'Gamma School', status: 'onboarding', planCode: 'standard', planName: 'Standard', modules: ['aca', 'iam', 'stu'], createdAt: '2026-11-01T00:00:00Z', wentLiveAt: null };

function mount({ signedIn = true, path = '/' } = {}) {
  const calls: { method: string; path: string; body?: unknown; auth?: string | null }[] = [];
  let session = signedIn;
  let inst = { ...gamma };
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const tokens = { accessToken: 'p1', accessTokenExpiresAt: new Date(Date.now() + 9e5).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 9e8).toISOString(), mustChangePassword: false };
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://x');
    const p = url.pathname.replace('/api/v1', '');
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ method, path: p + url.search, body, auth: headers.Authorization ?? null });
    if (p === '/platform/auth/refresh') return session ? json(200, tokens) : json(400, { code: 'validation_failed' });
    if (p === '/platform/auth/login') return body.password === 'right password' ? json(202, { mfaRequired: 'setup', challengeToken: 'c'.repeat(30), expiresAt: '' }) : json(401, { code: 'invalid_credentials', detail: 'Incorrect email or password.' });
    if (p === '/platform/auth/mfa/setup') return json(200, { secret: 'abcd efgh', otpauthUri: 'otpauth://totp/x?secret=ABCD' });
    if (p === '/platform/auth/mfa/setup/confirm') {
      if (body.code !== '123456') return json(401, { code: 'invalid_code', detail: 'That code is not right.' });
      session = true;
      return json(200, tokens);
    }
    if (p === '/platform/auth/logout') return new Response(null, { status: 204 });
    if (p === '/platform/me') return headers.Authorization ? json(200, { id: 'p', email: 'ops@shikshit.app', name: 'Platform Ops' }) : json(401, {});
    if (p === '/platform/plans') return json(200, { items: plans });
    if (p === '/platform/institutes' && method === 'POST')
      return body.code === 'taken' ? json(400, { code: 'validation_failed', errors: [{ field: 'code', message: 'Another institute already uses this code.' }] }) : json(201, { ...gamma, code: body.code, name: body.name, adminUsername: body.admin.username, adminInviteLink: '/accept-invite?token=abc' });
    if (p === '/platform/institutes') return json(200, { items: [inst], page: { number: 1, size: 25, total: 1 } });
    if (p === '/platform/institutes/i1/status') {
      inst = { ...inst, status: body.status, wentLiveAt: body.status === 'live' ? '2026-11-22T00:00:00Z' : inst.wentLiveAt };
      return json(200, inst);
    }
    if (p === '/platform/institutes/i1/modules') {
      inst = { ...inst, modules: [...body.modules].sort() };
      return json(200, inst);
    }
    if (p === '/platform/institutes/i1') return json(200, inst);
    return json(404, {});
  }) as typeof fetch;
  render(
    <MemoryRouter initialEntries={[path]}>
      <ConsoleApp session={createPlatformSession(fetchFn)} />
    </MemoryRouter>,
  );
  return calls;
}

describe('console', () => {
  it('is served only on the console host, or under /console on this computer', () => {
    expect(consoleBase({ hostname: 'console.shikshit.app', pathname: '/' })).toBe('');
    expect(consoleBase({ hostname: 'localhost', pathname: '/console/new' })).toBe('/console');
    expect(consoleBase({ hostname: 'springfield.shikshit.app', pathname: '/console' })).toBeNull();
    expect(consoleBase({ hostname: 'localhost', pathname: '/consoles' })).toBeNull();
  });

  it('signs in with a password and then always a second step', async () => {
    const calls = mount({ signedIn: false });
    await userEvent.type(await screen.findByLabelText('Email'), 'ops@shikshit.app');
    await userEvent.type(screen.getByLabelText('Password', { exact: true }), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByText('Incorrect email or password.')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText('Password', { exact: true }));
    await userEvent.type(screen.getByLabelText('Password', { exact: true }), 'right password');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    expect(await screen.findByRole('heading', { name: 'Set up two-step sign-in' })).toBeInTheDocument();
    expect(screen.getByTestId('mfa-secret')).toHaveTextContent('abcd efgh');
    await userEvent.type(screen.getByLabelText('Code from the app'), '000000');
    await userEvent.click(screen.getByRole('button', { name: 'Turn on and sign in' }));
    expect(await screen.findByText('That code is not right.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Code from the app'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Turn on and sign in' }));
    expect(await screen.findByRole('heading', { name: 'Institutes' })).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/platform/me' && c.auth)?.auth).toBe('Bearer p1');
  });

  it('lists institutes', async () => {
    mount();
    expect(await screen.findByRole('link', { name: 'Gamma School' })).toHaveAttribute('href', '/institutes/i1');
    expect(within(screen.getByRole('table')).getByText('Onboarding')).toBeInTheDocument();
  });

  it('creates an institute in three steps and shows the Admin invite once', async () => {
    const calls = mount({ path: '/new' });
    await userEvent.type(await screen.findByLabelText(/^School name/), "St. Mary's Convent");
    expect(screen.getByLabelText(/^Address code/)).toHaveValue('st-marys-convent');
    await userEvent.clear(screen.getByLabelText(/^Address code/));
    await userEvent.type(screen.getByLabelText(/^Address code/), 'taken');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(within(screen.getByRole('radiogroup', { name: 'Plan' })).getByRole('radio', { name: /Premium/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create institute' }));
    expect(await screen.findByText('Enter their name.')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText(/^Name/), 'Meena Rao');
    await userEvent.type(screen.getByLabelText(/^Username/), 'meena');
    await userEvent.click(screen.getByRole('button', { name: 'Create institute' }));
    // the server's field error sends the user back to the step that has the field
    expect(await screen.findByText('Another institute already uses this code.')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText(/^Address code/));
    await userEvent.type(screen.getByLabelText(/^Address code/), 'stmarys');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create institute' }));
    expect(await screen.findByTestId('admin-invite-link')).toHaveTextContent('/accept-invite?token=abc');
    expect(calls.filter((c) => c.method === 'POST' && c.path === '/platform/institutes').at(-1)?.body).toEqual({
      code: 'stmarys', name: "St. Mary's Convent", planCode: 'premium', admin: { username: 'meena', displayName: 'Meena Rao', email: null },
    });
  });

  it('takes an institute live after confirming and saves its modules', async () => {
    const calls = mount({ path: '/institutes/i1' });
    await userEvent.click(await screen.findByRole('button', { name: 'Go live' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Go live' }));
    expect(await screen.findByText('Status: Live')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Suspend' })).toBeInTheDocument();

    expect(screen.getByRole('checkbox', { name: /Users and roles/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('checkbox', { name: /Library/ }));
    await userEvent.click(screen.getByRole('checkbox', { name: /Students/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Save modules' }));
    expect(await screen.findByText(/Modules saved/)).toBeInTheDocument();
    expect((calls.find((c) => c.path === '/platform/institutes/i1/modules')?.body as { modules: string[] }).modules.sort()).toEqual(['aca', 'iam', 'lib']);
  });

  it('suggests an address code from a school name', () => {
    expect(suggestCode('  Delhi Public School, R.K. Puram ')).toBe('delhi-public-school-r-k-puram');
    expect(suggestCode('St. Xavier’s')).toBe('st-xaviers');
  });
});
