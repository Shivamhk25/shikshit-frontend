import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { createWebSession } from '../../shell/web-session';
import { ShellApp } from '../../shell/ShellApp';
import { buildMatrix, diff, grantsFrom, selectionFrom, type CatalogPermission, type RoleDetail } from './rolesApi';

const CATALOG: CatalogPermission[] = [
  { code: 'iam.roles.view', module: 'iam', resource: 'roles', action: 'view', sensitive: false },
  { code: 'iam.users.view', module: 'iam', resource: 'users', action: 'view', sensitive: false },
  { code: 'iam.users.edit', module: 'iam', resource: 'users', action: 'edit', sensitive: false },
  { code: 'stu.students.view', module: 'stu', resource: 'students', action: 'view', sensitive: true },
  { code: 'stu.students.edit', module: 'stu', resource: 'students', action: 'edit', sensitive: true },
  { code: 'stu.student_addresses.view', module: 'stu', resource: 'student_addresses', action: 'view', sensitive: true },
];

describe('permission matrix model', () => {
  it('groups permissions by module and area, with the action columns in a fixed order', () => {
    const m = buildMatrix(CATALOG);
    expect(m.map((x) => x.label)).toEqual(['Users and access', 'Students']);
    expect(m[0]!.actions).toEqual(['view', 'edit']);
    expect(m[1]!.rows.map((r) => [r.label, r.scopable, r.sensitive])).toEqual([
      ['Student addresses', false, true],
      ['Students', true, true],
    ]);
  });

  it('sends the row scope only where the server can narrow it', () => {
    const m = buildMatrix(CATALOG);
    const sel = selectionFrom([{ permission: 'stu.students.view', scope: 'class_section' }, { permission: 'stu.student_addresses.view', scope: 'tenant' }]);
    sel.rowScope['stu.student_addresses'] = 'class_section'; // not narrowable: ignored
    expect(grantsFrom(sel, m)).toEqual([
      { permission: 'stu.student_addresses.view', scope: 'tenant' },
      { permission: 'stu.students.view', scope: 'class_section' },
    ]);
  });

  it('a row with one whole-school action reads as whole school', () => {
    expect(selectionFrom([{ permission: 'stu.students.view', scope: 'class_section' }, { permission: 'stu.students.edit', scope: 'tenant' }]).rowScope['stu.students']).toBe('tenant');
  });

  it('counts what an edit adds, removes and widens', () => {
    expect(diff([{ permission: 'a.b.view', scope: 'tenant' }, { permission: 'a.b.edit', scope: 'class_section' }], [{ permission: 'a.b.edit', scope: 'tenant' }, { permission: 'a.b.create', scope: 'tenant' }])).toEqual({ added: 1, removed: 1, changed: 1 });
  });
});

function role(over: Partial<RoleDetail>): RoleDetail {
  return { id: 'r1', code: 'clerk', name: 'Clerk', description: null, isSystem: false, holderCount: 2, permissionCount: 1, updatedAt: '2026-11-01T00:00:00Z', grants: [{ permission: 'stu.students.view', scope: 'tenant' }], ...over };
}

function fakeServer(permissions: string[]) {
  const roles: RoleDetail[] = [role({ id: 'adm', code: 'admin', name: 'Admin', isSystem: true, holderCount: 1, permissionCount: 6, grants: CATALOG.map((p) => ({ permission: p.code, scope: 'tenant' })) }), role({})];
  const calls: { method: string; path: string; body?: Record<string, unknown> }[] = [];
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://x');
    const path = url.pathname.replace('/api/v1', '');
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    calls.push({ method, path, body });
    if (path === '/auth/refresh') return json(200, { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 9e5).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 9e8).toISOString(), mustChangePassword: false });
    if (path === '/me/access')
      return json(200, { user: { id: 'me', name: 'Asha', tier: 'tenant' }, tenant: { id: 't1', name: 'School', brand: { primary: '#1F3A5F' }, modules: ['iam', 'stu'] }, permissions, scopes: {}, fieldMasks: {}, workspace: { home: 'x', navigation: [{ screenId: 'home', label: 'Home', order: 1 }, { screenId: 'roles', label: 'Roles', order: 2 }] }, mobile: { tabs: [], features: [] }, approvals: { canApprove: [] }, version: 1 });
    if (path === '/permissions/catalog') return json(200, { items: CATALOG });
    if (path === '/roles' && method === 'GET') return json(200, { items: roles });
    if (path === '/roles' && method === 'POST') {
      const grants = (body?.grants as { permission: string }[]) ?? [];
      if (grants.some((g) => g.permission === 'stu.students.edit')) return json(403, { code: 'cannot_grant', detail: 'You can only give permissions you have yourself. Not allowed: stu.students.edit.' });
      return json(201, role({ id: 'new', name: String(body?.name) }));
    }
    const m = /^\/roles\/([^/]+)$/.exec(path);
    if (m && method === 'GET') return json(200, roles.find((r) => r.id === m[1]));
    if (m && method === 'PATCH') return json(200, { ...roles.find((r) => r.id === m[1]), ...body });
    return json(404, {});
  }) as typeof fetch;
  return { fetchFn, calls };
}

function mount(permissions: string[]) {
  const server = fakeServer(permissions);
  render(
    <MemoryRouter initialEntries={['/roles']}>
      <ShellApp session={createWebSession(server.fetchFn)} />
    </MemoryRouter>,
  );
  return server;
}

const ALL = ['iam.roles.view', 'iam.roles.create', 'iam.roles.edit', 'iam.roles.delete'];

describe('roles page', () => {
  it('shows a built-in role read-only, offering a clone instead', async () => {
    mount(ALL);
    await userEvent.click(await screen.findByRole('button', { name: 'View Admin' }));
    expect(await screen.findByText(/A built-in role/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Edit Students' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: /Save changes/ })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clone' })).toBeInTheDocument();
  });

  it('edits a role, narrows students to class sections and says who is affected', async () => {
    const server = mount(ALL);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Clerk' }));
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Edit Students' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: /Who students reaches/ }), 'class_section');
    expect(screen.getByText(/1 added, 0 removed, 1 changed\. 2 people will get this change\./)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    const patch = server.calls.find((c) => c.method === 'PATCH');
    expect(patch?.body?.grants).toEqual([
      { permission: 'stu.students.edit', scope: 'class_section' },
      { permission: 'stu.students.view', scope: 'class_section' },
    ]);
  });

  it('shows the server refusal when a grant is beyond your own access', async () => {
    mount(ALL);
    await userEvent.click(await screen.findByRole('button', { name: /New role/ }));
    await userEvent.type(screen.getByLabelText('Name'), 'Editors');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Edit Students' }));
    await userEvent.click(screen.getByRole('button', { name: 'Create role' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Not allowed: stu.students.edit');
  });

  it('view-only users see roles without any controls', async () => {
    mount(['iam.roles.view']);
    const card = (await screen.findByRole('heading', { name: 'Clerk' })).closest('li')!;
    expect(within(card).getByRole('button', { name: 'View Clerk' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /New role/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Clone/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Delete/ })).not.toBeInTheDocument();
  });
});
