import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { createWebSession } from './web-session';
import { ShellApp } from './ShellApp';

/** Signed in already (cookie), on the Profile page, with the /me/mfa endpoints of the contract. */
function mount(status: { enabled: boolean; required: boolean }) {
  const st = { ...status, recoveryCodesLeft: status.enabled ? 10 : 0 };
  const calls: { method: string; path: string; body?: Record<string, string> }[] = [];
  const json = (code: number, body: unknown) => new Response(JSON.stringify(body), { status: code, headers: { 'Content-Type': 'application/json' } });
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const path = String(input).replace('/api/v1', '');
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, string>) : undefined;
    calls.push({ method, path, body });
    if (path === '/auth/refresh') return json(200, { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 9e5).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 9e8).toISOString(), mustChangePassword: false });
    if (path === '/me/access')
      return json(200, { user: { id: 'u1', name: 'Asha Verma', tier: 'tenant' }, tenant: { id: 't1', name: 'School', brand: { primary: '#1F3A5F' }, modules: [] }, permissions: [], scopes: {}, fieldMasks: {}, workspace: { home: 'x', navigation: [{ screenId: 'profile', label: 'Profile', order: 1 }] }, mobile: { tabs: [], features: [] }, approvals: { canApprove: [] }, version: 1 });
    if (path === '/me/mfa') return json(200, st);
    if (path === '/me/mfa/setup') return json(200, { secret: 'JBSW Y3DP', otpauthUri: 'otpauth://totp/x?secret=JBSWY3DP' });
    if (path === '/me/mfa/confirm') {
      if (body?.code !== '123456') return json(400, { code: 'invalid_code', detail: 'That code is not right.' });
      st.enabled = true;
      st.recoveryCodesLeft = 10;
      return json(200, { recoveryCodes: ['abcde-fghij'] });
    }
    if (path === '/me/mfa/disable') {
      st.enabled = false;
      return new Response(null, { status: 204 });
    }
    return json(404, {});
  }) as typeof fetch;
  render(
    <MemoryRouter initialEntries={['/profile']}>
      <ShellApp session={createWebSession(fetchFn)} />
    </MemoryRouter>,
  );
  return calls;
}

describe('two-step sign-in on the profile', () => {
  it('turns it on: key, first code, recovery codes', async () => {
    mount({ enabled: false, required: false });
    await userEvent.click(await screen.findByRole('button', { name: 'Turn on two-step sign-in' }));
    expect(await screen.findByTestId('mfa-secret')).toHaveTextContent('JBSW Y3DP');
    await userEvent.type(screen.getByLabelText('Code from the app'), '111111');
    await userEvent.click(screen.getByRole('button', { name: 'Turn on' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('That code is not right.');
    await userEvent.clear(screen.getByLabelText('Code from the app'));
    await userEvent.type(screen.getByLabelText('Code from the app'), '123456');
    await userEvent.click(screen.getByRole('button', { name: 'Turn on' }));
    expect(await screen.findByTestId('recovery-codes')).toHaveTextContent('abcde-fghij');
    await userEvent.click(screen.getByRole('button', { name: 'I have saved them' }));
    expect(await screen.findByText(/^On\. Signing in asks for a code/)).toBeInTheDocument();
  });

  it('turns it off with a current code, unless the school requires it', async () => {
    const calls = mount({ enabled: true, required: false });
    await userEvent.click(await screen.findByRole('button', { name: 'Turn off' }));
    const dialog = screen.getByRole('alertdialog');
    await userEvent.type(within(dialog).getByLabelText('Code'), '123456');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Turn off' }));
    expect(await screen.findByText(/^Off\./)).toBeInTheDocument();
    expect(calls.find((c) => c.path === '/me/mfa/disable')?.body).toEqual({ code: '123456' });
  });

  it('offers no way to turn it off when it is required', async () => {
    mount({ enabled: true, required: true });
    expect(await screen.findByText('Your school requires it for your account.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Turn off' })).not.toBeInTheDocument();
  });
});
