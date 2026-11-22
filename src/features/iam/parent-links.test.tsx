import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { createWebSession } from '../../shell/web-session';
import { ShellApp } from '../../shell/ShellApp';

const account = {
  userId: 'u1',
  username: 'sunil.k',
  displayName: 'Sunil Kumar',
  status: 'active',
  guardianId: 'g1',
  guardianName: 'Sunil Kumar',
  guardianPhone: '9800000001',
  children: [
    { linkId: 'l1', studentId: 's1', studentName: 'Asha Kumar', registrationCode: 'A-1', relation: 'father', noAccess: false },
    { linkId: 'l2', studentId: 's2', studentName: 'Ravi Kumar', registrationCode: 'A-2', relation: 'father', noAccess: true },
  ],
};

function mount(permissions: string[], linkError?: { status: number; body: unknown }) {
  const calls: { method: string; path: string; body?: unknown }[] = [];
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://x');
    const path = url.pathname.replace('/api/v1', '');
    const method = init?.method ?? 'GET';
    calls.push({ method, path: path + url.search, body: init?.body ? JSON.parse(String(init.body)) : undefined });
    if (path === '/auth/refresh') return json(200, { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 9e5).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 9e8).toISOString(), mustChangePassword: false });
    if (path === '/me/access')
      return json(200, { user: { id: 'me', name: 'Asha', tier: 'tenant' }, tenant: { id: 't1', name: 'School', brand: { primary: '#1F3A5F' }, modules: ['iam', 'stu'] }, permissions, scopes: {}, fieldMasks: {}, workspace: { home: 'x', navigation: [{ screenId: 'parent_links', label: 'Parent accounts', order: 1 }] }, mobile: { tabs: [], features: [] }, approvals: { canApprove: [] }, version: 1 });
    if (path === '/parent-links' && method === 'GET') return json(200, { items: url.searchParams.get('q') === 'zzz' ? [] : [account], page: { number: 1, size: 25, total: 1 } });
    if (path === '/parent-links' && method === 'POST') return linkError ? json(linkError.status, linkError.body) : json(200, { ...account, userId: 'u2', displayName: 'Kavya Rao' });
    if (path.startsWith('/parent-links/children/') && method === 'PUT') return json(200, { ...account.children[0], noAccess: true });
    if (path === '/parent-links/u1' && method === 'DELETE') return new Response(null, { status: 204 });
    if (path === '/users') return json(200, { items: [{ id: 'u2', displayName: 'Kavya Rao', username: 'kavya' }], page: { number: 1, size: 20, total: 1 } });
    if (path === '/guardians') return json(200, { items: [{ id: 'g2', name: 'Kavya Rao', phone: '9800000002' }], page: { number: 1, size: 20, total: 1 } });
    return json(404, {});
  }) as typeof fetch;
  render(
    <MemoryRouter initialEntries={['/parent-accounts']}>
      <ShellApp session={createWebSession(fetchFn)} />
    </MemoryRouter>,
  );
  return calls;
}

const ALL = ['iam.parent_links.view', 'iam.parent_links.create', 'iam.parent_links.edit', 'iam.parent_links.delete', 'iam.users.view', 'iam.users.create', 'stu.students.view'];

describe('parent accounts', () => {
  it('lists accounts and their children read-only without edit permissions', async () => {
    mount(['iam.parent_links.view']);
    expect(await screen.findByText('Asha Kumar')).toBeInTheDocument();
    expect(screen.getByText('No access')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Link an account/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Stop / })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Unlink/ })).not.toBeInTheDocument();
  });

  it('stops a child being seen only after confirming, and allows again without asking', async () => {
    const calls = mount(ALL);
    await userEvent.click(await screen.findByRole('button', { name: 'Stop Sunil Kumar seeing Asha Kumar' }));
    const dialog = screen.getByRole('alertdialog');
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Stop access' }));
    expect(await screen.findByText('Access stopped: Asha Kumar')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'PUT')).toEqual({ method: 'PUT', path: '/parent-links/children/l1/access', body: { noAccess: true } });

    await userEvent.click(screen.getByRole('button', { name: 'Allow Sunil Kumar to see Ravi Kumar' }));
    expect(calls.filter((c) => c.method === 'PUT').at(-1)).toEqual({ method: 'PUT', path: '/parent-links/children/l2/access', body: { noAccess: false } });
  });

  it('links an account to a guardian chosen by search', async () => {
    const calls = mount(ALL);
    await userEvent.click(await screen.findByRole('button', { name: /Link an account/ }));
    const sheet = screen.getByRole('dialog');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Link' }));
    expect(await within(sheet).findByText('Choose an account.')).toBeInTheDocument();
    expect(within(sheet).getByRole('link', { name: 'Add the parent on Users' })).toHaveAttribute('href', '/users');
    await userEvent.type(within(sheet).getByRole('searchbox', { name: /^Account/ }), 'kav');
    await within(sheet).findByRole('option', { name: /Kavya Rao \(kavya\)/ });
    await userEvent.selectOptions(within(sheet).getByRole('combobox', { name: 'Account results' }), 'u2');
    await userEvent.type(within(sheet).getByRole('searchbox', { name: /^Guardian/ }), 'kav');
    await within(sheet).findByRole('option', { name: /9800000002/ });
    await userEvent.selectOptions(within(sheet).getByRole('combobox', { name: 'Guardian results' }), 'g2');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Link' }));
    expect(await screen.findByText('Linked: Kavya Rao')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST' && c.path === '/parent-links')?.body).toEqual({ userId: 'u2', guardianId: 'g2' });
  });

  it('shows the server reason when the guardian already has an account', async () => {
    mount(ALL, { status: 400, body: { code: 'validation_failed', errors: [{ field: 'guardianId', code: 'duplicate', message: 'Another account is already linked to this guardian.' }] } });
    await userEvent.click(await screen.findByRole('button', { name: /Link an account/ }));
    const sheet = screen.getByRole('dialog');
    await userEvent.type(within(sheet).getByRole('searchbox', { name: /^Account/ }), 'kav');
    await within(sheet).findByRole('option', { name: /Kavya Rao \(kavya\)/ });
    await userEvent.selectOptions(within(sheet).getByRole('combobox', { name: 'Account results' }), 'u2');
    await userEvent.type(within(sheet).getByRole('searchbox', { name: /^Guardian/ }), 'kav');
    await within(sheet).findByRole('option', { name: /9800000002/ });
    await userEvent.selectOptions(within(sheet).getByRole('combobox', { name: 'Guardian results' }), 'g2');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Link' }));
    expect(await within(sheet).findByText('Another account is already linked to this guardian.')).toBeInTheDocument();
  });

  it('unlinks after confirming', async () => {
    const calls = mount(ALL);
    await userEvent.click(await screen.findByRole('button', { name: 'Unlink Sunil Kumar' }));
    await userEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Unlink' }));
    expect(await screen.findByText('Unlinked')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/parent-links/u1')).toBe(true);
  });
});
