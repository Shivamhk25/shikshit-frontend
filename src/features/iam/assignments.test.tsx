import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { createWebSession } from '../../shell/web-session';
import { ShellApp } from '../../shell/ShellApp';

function mount(permissions: string[]) {
  const items = [{ id: 'a1', userId: 'u1', userName: 'Ravi Nair', scopeType: 'class_section', scopeRef: 'cs1', label: 'Class 5 A (2026-27)', startsAt: '2026-06-01T00:00:00Z', endsAt: null, createdAt: '' }];
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://x');
    const path = url.pathname.replace('/api/v1', '');
    const method = init?.method ?? 'GET';
    calls.push({ method, path: path + url.search, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (path === '/auth/refresh') return json(200, { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 9e5).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 9e8).toISOString(), mustChangePassword: false });
    if (path === '/me/access')
      return json(200, { user: { id: 'me', name: 'Asha', tier: 'tenant' }, tenant: { id: 't1', name: 'School', brand: { primary: '#1F3A5F' }, modules: ['iam'] }, permissions, scopes: {}, fieldMasks: {}, workspace: { home: 'x', navigation: [{ screenId: 'scope_assignments', label: 'Class assignments', order: 1 }] }, mobile: { tabs: [], features: [] }, approvals: { canApprove: [] }, version: 1 });
    if (path === '/scope-assignments' && method === 'GET') return json(200, { items: url.searchParams.get('userId') === 'nobody' ? [] : items });
    if (path === '/scope-assignments' && method === 'POST') return json(201, { ...items[0], id: 'a2' });
    if (path === '/scope-assignments/a1' && method === 'DELETE') return new Response(null, { status: 204 });
    if (path === '/users') return json(200, { items: [{ id: 'u2', displayName: 'Meera Iyer', username: 'meera' }], page: { number: 1, size: 20, total: 1 } });
    if (path === '/class-section-mappings') return json(200, { items: [{ id: 'cs2', className: 'Class 6', sectionName: 'B', yearName: '2026-27' }], page: { number: 1, size: 20, total: 1 } });
    return json(404, {});
  }) as typeof fetch;
  render(
    <MemoryRouter initialEntries={['/class-assignments']}>
      <ShellApp session={createWebSession(fetchFn)} />
    </MemoryRouter>,
  );
  return calls;
}

const ALL = ['iam.scope_assignments.view', 'iam.scope_assignments.edit', 'iam.users.view'];

describe('class assignments', () => {
  it('lists assignments read-only without the edit permission', async () => {
    mount(['iam.scope_assignments.view']);
    expect(await screen.findByText('Class 5 A (2026-27)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Assign/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Remove/ })).not.toBeInTheDocument();
  });

  it('assigns a person to a class section chosen by search', async () => {
    const calls = mount(ALL);
    await userEvent.click(await screen.findByRole('button', { name: /^Assign/ }));
    const sheet = screen.getByRole('dialog');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Assign' }));
    expect(await within(sheet).findByText('Choose a person.')).toBeInTheDocument();
    await userEvent.type(within(sheet).getByRole('searchbox', { name: /^Person/ }), 'mee');
    await within(sheet).findByRole('option', { name: /Meera Iyer/ });
    await userEvent.selectOptions(within(sheet).getByRole('combobox', { name: 'Person results' }), 'u2');
    await userEvent.type(within(sheet).getByRole('searchbox', { name: /^Class section/ }), 'cla');
    await within(sheet).findByRole('option', { name: /Class 6 B/ });
    await userEvent.selectOptions(within(sheet).getByRole('combobox', { name: 'Class section results' }), 'cs2');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Assign' }));
    expect(await screen.findByText('Assigned')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST' && c.path === '/scope-assignments')?.body).toEqual({ userId: 'u2', scopeType: 'class_section', scopeRef: 'cs2' });
  });

  it('asks before removing, then removes', async () => {
    const calls = mount(ALL);
    await userEvent.click(await screen.findByRole('button', { name: 'Remove Class 5 A (2026-27) from Ravi Nair' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove' }));
    expect(await screen.findByText('Removed')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/scope-assignments/a1')).toBe(true);
  });
});
