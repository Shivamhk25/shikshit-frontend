import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { createWebSession } from '../../shell/web-session';
import { ShellApp } from '../../shell/ShellApp';

function mount(permissions: string[], path = '/appearance') {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  let look = { accent: '#1F3A5F', preset: 'classic' };
  let mode = 'system';
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://x');
    const p = url.pathname.replace('/api/v1', '');
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, path: p, body });
    if (p === '/auth/refresh') return json(200, { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 9e5).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 9e8).toISOString(), mustChangePassword: false });
    if (p === '/me/access')
      return json(200, { user: { id: 'me', name: 'Asha', tier: 'tenant' }, tenant: { id: 't1', name: 'School', brand: { primary: look.accent, preset: look.preset }, modules: ['iam'] }, permissions, scopes: {}, fieldMasks: {}, workspace: { home: 'x', navigation: [{ screenId: 'appearance', label: 'Appearance', order: 1 }] }, mobile: { tabs: [], features: [] }, approvals: { canApprove: [] }, version: 1 });
    if (p === '/institute/appearance' && method === 'PUT') {
      look = body as typeof look;
      return json(200, look);
    }
    if (p === '/institute/appearance') return json(200, look);
    if (p === '/me/preferences' && method === 'PUT') {
      mode = (body as { themeMode: string }).themeMode;
      return json(200, { themeMode: mode });
    }
    if (p === '/me/preferences') return json(200, { themeMode: mode });
    if (p === '/me/mfa') return json(200, { enabled: false, required: false, recoveryCodesLeft: 0 });
    return json(404, {});
  }) as typeof fetch;
  render(
    <MemoryRouter initialEntries={[path]}>
      <ShellApp session={createWebSession(fetchFn)} />
    </MemoryRouter>,
  );
  return calls;
}

const root = () => document.documentElement;

describe('appearance', () => {
  it('shows the look read-only without the manage permission', async () => {
    mount(['iam.appearance.view']);
    const style = await screen.findByRole('radiogroup', { name: 'Design style' });
    expect(within(style).getByRole('radio', { name: /Classic/ })).toHaveAttribute('aria-checked', 'true');
    expect(within(style).getByRole('radio', { name: /Modern/ })).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('previews a style and colour across the app, then saves them', async () => {
    const calls = mount(['iam.appearance.view', 'iam.appearance.manage']);
    const style = await screen.findByRole('radiogroup', { name: 'Design style' });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();

    await userEvent.click(within(style).getByRole('radio', { name: /Modern/ }));
    // the whole page repaints straight away: modern swaps the display font
    expect(root().style.getPropertyValue('--font-display')).toContain('Inter');
    await userEvent.click(within(screen.getByRole('radiogroup', { name: 'Accent colour' })).getByRole('radio', { name: 'Teal' }));

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText(/Appearance saved/)).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'PUT' && c.path === '/institute/appearance')?.body).toEqual({ accent: '#1A7A6D', preset: 'modern' });
  });

  it('accepts a colour code of the school\'s own and undoes unsaved changes', async () => {
    mount(['iam.appearance.view', 'iam.appearance.manage']);
    const code = await screen.findByRole('textbox', { name: 'Colour code' });
    await userEvent.clear(code);
    await userEvent.type(code, '#AA3355');
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
    expect(screen.getByText(/A colour of your own/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Undo changes/ }));
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    expect(code).toHaveValue('#1F3A5F');
  });

  it('lets each person choose light or dark on their profile, and saves it', async () => {
    const calls = mount([], '/profile');
    const modes = await screen.findByRole('radiogroup', { name: 'Light or dark' });
    await userEvent.click(within(modes).getByRole('radio', { name: 'Dark' }));
    expect(root().getAttribute('data-theme')).toBe('dark');
    expect(calls.find((c) => c.method === 'PUT' && c.path === '/me/preferences')?.body).toEqual({ themeMode: 'dark' });
    expect(window.localStorage.setItem).toHaveBeenCalledWith('shikshit.themeMode', 'dark');
  });
});
