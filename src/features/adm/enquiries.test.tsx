import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { createWebSession } from '../../shell/web-session';
import { ShellApp } from '../../shell/ShellApp';
import { enquiriesDescriptor, formatDate, type Enquiry } from './enquiries';

const ALL = ['adm.enquiry.view', 'adm.enquiry.create', 'adm.enquiry.edit', 'adm.enquiry.delete'];

function enquiry(n: number, over: Partial<Enquiry> = {}): Enquiry {
  return {
    id: `id-${n}`, code: `ENQ-${n}`, enquirerName: `Parent ${n}`, phone: '9810012345', email: null, childName: `Child ${n}`, dateOfBirth: null,
    classId: 'c1', classCode: 'C5', className: 'Class 5', yearId: null, yearName: null, source: 'walk_in', status: 'new', followUpDate: null, followUpDue: false,
    notes: null, assignedToId: null, assignedToName: null, createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', ...over,
  };
}

function fakeServer(permissions: string[], initial: Enquiry[], opts: { failList?: boolean } = {}) {
  const rows = [...initial];
  const calls: { method: string; path: string; body?: Record<string, unknown> }[] = [];
  const json = (status: number, body: unknown, h: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...h } });
  const problem = (status: number, code: string, errors?: { field: string; code: string; message: string }[]) => json(status, { code, status, errors });

  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://x');
    const path = url.pathname.replace('/api/v1', '');
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    calls.push({ method, path: path + url.search, body });
    if (path === '/auth/refresh') return json(200, { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 9e5).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 9e8).toISOString(), mustChangePassword: false });
    if (path === '/me/access') {
      return json(200, {
        user: { id: 'u1', name: 'Asha', tier: 'tenant' },
        tenant: { id: 't1', name: 'School', brand: { primary: '#2F5BFF' }, modules: ['adm'] },
        permissions, scopes: {}, fieldMasks: {},
        workspace: { home: 'x', navigation: [{ screenId: 'home', label: 'Home', order: 1 }, { screenId: 'enquiries', label: 'Enquiries', order: 35 }] },
        mobile: { tabs: [], features: [] }, approvals: { canApprove: [] }, version: 1,
      }, { 'X-Access-Version': '1' });
    }
    if (path === '/classes') return json(200, { items: [{ id: 'c1', name: 'Class 5' }, { id: 'c2', name: 'Class 6' }], page: { number: 1, size: 200, total: 2 } });
    if (path === '/academic-years') return json(200, { items: [{ id: 'y1', name: '2027-28' }], page: { number: 1, size: 200, total: 1 } });
    if (path === '/colleagues') return json(200, { items: [{ id: 'u7', displayName: 'Ravi Nair', label: 'Teacher' }], page: { number: 1, size: 20, total: 1 } });
    if (path === '/enquiries' && method === 'GET') {
      if (opts.failList) return problem(500, 'internal_error');
      const status = url.searchParams.get('status');
      const classId = url.searchParams.get('classId');
      const due = url.searchParams.get('followUpDue') === 'true';
      const items = rows.filter((r) => (!status || r.status === status) && (!classId || r.classId === classId) && (!due || r.followUpDue));
      return json(200, { items, page: { number: 1, size: 25, total: items.length } });
    }
    if (path === '/enquiries' && method === 'POST') {
      const errs = [];
      if (!String(body?.childName ?? '').trim()) errs.push({ field: 'childName', code: 'required', message: 'Enter the child’s name.' });
      if (rows.some((r) => r.code === body?.code)) errs.push({ field: 'code', code: 'duplicate', message: 'Another enquiry already uses this code.' });
      if (errs.length) return problem(400, 'validation_failed', errs);
      const r = { ...enquiry(0), ...(body as Partial<Enquiry>), id: 'id-new' } as Enquiry;
      rows.push(r);
      return json(201, r);
    }
    const m = /^\/enquiries\/(.+)$/.exec(path);
    if (m) {
      const i = rows.findIndex((r) => r.id === m[1]);
      if (i < 0) return problem(404, 'not_found');
      if (method === 'PUT') {
        rows[i] = { ...rows[i]!, ...(body as Partial<Enquiry>) };
        return json(200, rows[i]);
      }
      if (method === 'DELETE') {
        rows.splice(i, 1);
        return new Response(null, { status: 204 });
      }
    }
    return json(404, {});
  }) as typeof fetch;
  return { fetchFn, calls, rows };
}

function mount(permissions: string[], initial: Enquiry[], opts?: { failList?: boolean }) {
  const server = fakeServer(permissions, initial, opts);
  render(
    <MemoryRouter initialEntries={['/enquiries']}>
      <ShellApp session={createWebSession(server.fetchFn)} />
    </MemoryRouter>,
  );
  return server;
}

describe('enquiries page', () => {
  it('lists enquiries with status and follow-up, and a view-only user sees no write controls', async () => {
    mount(['adm.enquiry.view'], [enquiry(1, { status: 'contacted', followUpDate: '2026-11-20', followUpDue: true }), enquiry(2)]);
    expect(await screen.findByText('Child 1')).toBeInTheDocument();
    expect(within(screen.getByRole('table')).getByText('Contacted')).toBeInTheDocument();
    expect(screen.getByText('20 Nov 2026 · due')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Add enquiry/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Edit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument();
  });

  it('is not available without the view permission', async () => {
    mount([], [enquiry(1)]);
    expect(await screen.findByRole('alert')).toHaveTextContent('Not available');
  });

  it('shows empty and error states', async () => {
    mount(ALL, []);
    expect(await screen.findByText(/No enquiries yet/)).toHaveTextContent('Add enquiry');
  });

  it('shows a retry when loading fails', async () => {
    mount(ALL, [], { failList: true });
    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('sends the status filter and the follow-up due toggle to the server', async () => {
    const server = mount(ALL, [enquiry(1), enquiry(2, { status: 'closed', followUpDue: true })]);
    await screen.findByText('Child 1');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'closed');
    await waitFor(() => expect(server.calls.some((c) => c.path.includes('status=closed'))).toBe(true));
    expect(await screen.findByText('Child 2')).toBeInTheDocument();
    expect(screen.queryByText('Child 1')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Follow-up due' }));
    await waitFor(() => expect(server.calls.some((c) => c.path.includes('followUpDue=true'))).toBe(true));
  });

  it('loads class options into the class filter and filters by class', async () => {
    const server = mount(ALL, [enquiry(1)]);
    await screen.findByText('Child 1');
    const select = screen.getByRole('combobox', { name: 'Class' });
    await waitFor(() => expect(within(select).getByRole('option', { name: 'Class 6' })).toBeInTheDocument());
    await userEvent.selectOptions(select, 'c2');
    await waitFor(() => expect(server.calls.some((c) => c.path.includes('classId=c2'))).toBe(true));
    expect(await screen.findByText(/No enquiries match these filters/)).toBeInTheDocument();
  });

  it('adds an enquiry with the required fields and sends clean optional values', async () => {
    const server = mount(ALL, [enquiry(1)]);
    await userEvent.click(await screen.findByRole('button', { name: 'Add enquiry' }));
    const sheet = await screen.findByRole('dialog', { name: 'Add enquiry' });
    await userEvent.type(within(sheet).getByLabelText('Code *'), 'ENQ-9');
    await userEvent.type(within(sheet).getByLabelText('Child’s name *'), 'Anaya');
    await userEvent.type(within(sheet).getByLabelText('Enquirer’s name *'), 'Sunil Kumar');
    await userEvent.type(within(sheet).getByLabelText('Phone *'), '+91 98100 12345');
    await userEvent.selectOptions(within(sheet).getByLabelText('Source *'), 'referral');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Anaya')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Enquiry added.');
    const post = server.calls.find((c) => c.method === 'POST' && c.path === '/enquiries')!;
    expect(post.body).toMatchObject({ code: 'ENQ-9', childName: 'Anaya', source: 'referral', status: 'new', email: null, classId: null, assignedToId: null, followUpDate: null, notes: null });
  });

  it('picks the assigned staff member through the colleague lookup, not the user list', async () => {
    const server = mount(ALL, [enquiry(1)]);
    await userEvent.click(await screen.findByRole('button', { name: 'Add enquiry' }));
    const sheet = await screen.findByRole('dialog', { name: 'Add enquiry' });
    await userEvent.type(within(sheet).getByLabelText('Assigned to'), 'Rav');
    const results = within(sheet).getByLabelText('Assigned to results');
    await waitFor(() => expect(within(results).getByRole('option', { name: 'Ravi Nair (Teacher)' })).toBeInTheDocument());
    await userEvent.selectOptions(results, 'u7');
    expect(server.calls.some((c) => c.path.startsWith('/colleagues') && c.path.includes('q=Rav'))).toBe(true);
    expect(server.calls.some((c) => c.path.startsWith('/users'))).toBe(false);
  });

  it('shows field errors from the server, including a duplicate code', async () => {
    mount(ALL, [enquiry(1)]);
    await userEvent.click(await screen.findByRole('button', { name: 'Add enquiry' }));
    const sheet = await screen.findByRole('dialog');
    await userEvent.type(within(sheet).getByLabelText('Code *'), 'ENQ-1');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(await within(sheet).findByText('Another enquiry already uses this code.')).toBeInTheDocument();
    expect(within(sheet).getByText('Enter the child’s name.')).toBeInTheDocument();
    expect(within(sheet).getByLabelText('Code *')).toHaveAttribute('aria-invalid', 'true');
  });

  it('edits an enquiry with prefilled values and can change its status', async () => {
    const server = mount(ALL, [enquiry(1, { classId: 'c1' })]);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit ENQ-1 · Child 1' }));
    const sheet = await screen.findByRole('dialog', { name: 'Edit enquiry' });
    expect(within(sheet).getByLabelText('Child’s name *')).toHaveValue('Child 1');
    await waitFor(() => expect(within(sheet).getByLabelText('Class')).toHaveValue('c1'));
    await userEvent.selectOptions(within(sheet).getByLabelText('Status *'), 'visit_scheduled');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(within(screen.getByRole('table')).getByText('Visit scheduled')).toBeInTheDocument());
    expect(server.calls.find((c) => c.method === 'PUT')?.body).toMatchObject({ status: 'visit_scheduled', classId: 'c1' });
  });

  it('asks before deleting', async () => {
    const server = mount(ALL, [enquiry(1), enquiry(2)]);
    await userEvent.click(await screen.findByRole('button', { name: 'Delete ENQ-1 · Child 1' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(server.calls.some((c) => c.method === 'DELETE')).toBe(false);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('Child 1')).not.toBeInTheDocument());
  });
});

describe('enquiry descriptor', () => {
  it('formats dates from the text, not the time zone', () => {
    expect(formatDate('2026-01-05')).toBe('5 Jan 2026');
    expect(formatDate(null)).toBe('—');
  });
  it('turns blank optional fields into null and trims required ones', () => {
    const input = enquiriesDescriptor.toInput({ code: ' E1 ', enquirerName: ' A ', phone: ' 123 ', childName: 'B', source: 'phone', status: '', email: ' ', notes: '' });
    expect(input).toMatchObject({ code: 'E1', enquirerName: 'A', phone: '123', status: 'new', email: null, notes: null });
  });
});
