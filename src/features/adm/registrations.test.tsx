import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { createWebSession } from '../../shell/web-session';
import { ShellApp } from '../../shell/ShellApp';
import type { Enquiry } from './enquiries';
import { registrationsDescriptor, today, type Registration } from './registrations';

const REG = ['adm.student_registrations.view', 'adm.student_registrations.create', 'adm.student_registrations.edit', 'adm.student_registrations.delete'];
const ENQ_VIEW = ['adm.enquiry.view'];

function reg(n: number, over: Partial<Registration> = {}): Registration {
  return {
    id: `r-${n}`, applicationNumber: `REG-00000${n}`, appliedOn: '2026-11-10', firstName: `Child${n}`, middleName: null, lastName: 'Rao', fullName: `Child${n} Rao`, dateOfBirth: '2018-06-01',
    gender: 'female', fatherName: null, motherName: null, guardianName: 'Meera Rao', guardianPhone: '9810012345', siblingStudentCode: null, classId: 'c1', classCode: 'V', className: 'Class 5',
    sectionId: null, sectionName: null, yearId: 'y1', yearName: '2027-28', status: 'submitted', enquiryId: null, enquiryCode: null, createdAt: '2026-11-10T00:00:00Z', updatedAt: '2026-11-10T00:00:00Z', ...over,
  };
}

function enquiry(n: number, over: Partial<Enquiry> = {}): Enquiry {
  return {
    id: `e-${n}`, code: `ENQ-${n}`, enquirerName: `Parent ${n}`, phone: '9810012345', email: null, childName: `Kid ${n}`, dateOfBirth: '2020-01-01', classId: 'c1', classCode: 'V', className: 'Class 5',
    yearId: 'y1', yearName: '2027-28', source: 'walk_in', status: 'new', followUpDate: null, followUpDue: false, notes: null, assignedToId: null, assignedToName: null,
    createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', ...over,
  };
}

function fakeServer(permissions: string[], regs: Registration[], enqs: Enquiry[] = [], opts: { registerFails?: 'conflict' | 'missing' } = {}) {
  const rows = [...regs];
  const calls: { method: string; path: string; body?: Record<string, unknown> }[] = [];
  const json = (status: number, body: unknown, h: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...h } });
  const problem = (status: number, code: string, errors?: { field: string; code: string; message: string }[], detail?: string) => json(status, { code, status, errors, detail });
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://x');
    const path = url.pathname.replace('/api/v1', '');
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    calls.push({ method, path: path + url.search, body });
    if (path === '/auth/refresh') return json(200, { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 9e5).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 9e8).toISOString(), mustChangePassword: false });
    if (path === '/me/access')
      return json(200, {
        user: { id: 'u1', name: 'Asha', tier: 'tenant' },
        tenant: { id: 't1', name: 'School', brand: { primary: '#2F5BFF' }, modules: ['adm'] },
        permissions, scopes: {}, fieldMasks: {},
        workspace: { home: 'x', navigation: [{ screenId: 'home', label: 'Home', order: 1 }, { screenId: 'enquiries', label: 'Enquiries', order: 35 }, { screenId: 'registrations', label: 'Registrations', order: 36 }] },
        mobile: { tabs: [], features: [] }, approvals: { canApprove: [] }, version: 1,
      }, { 'X-Access-Version': '1' });
    if (path === '/classes') return json(200, { items: [{ id: 'c1', name: 'Class 5' }, { id: 'c2', name: 'Class 6' }], page: { number: 1, size: 200, total: 2 } });
    if (path === '/academic-years') return json(200, { items: [{ id: 'y1', name: '2027-28' }], page: { number: 1, size: 200, total: 1 } });
    if (path === '/sections') return json(200, { items: [{ id: 's1', name: 'Section A' }], page: { number: 1, size: 200, total: 1 } });
    if (path === '/enquiries' && method === 'GET') return json(200, { items: enqs, page: { number: 1, size: 25, total: enqs.length } });
    const reg1 = /^\/enquiries\/(.+)\/register$/.exec(path);
    if (reg1) {
      if (opts.registerFails === 'conflict') return problem(409, 'already_converted', undefined, 'This enquiry already has a registration.');
      if (opts.registerFails === 'missing') return problem(400, 'validation_failed', [{ field: 'dateOfBirth', code: 'required', message: 'This enquiry has no date of birth. Add it to the enquiry or enter it here.' }]);
      const e = enqs.find((x) => x.id === reg1[1])!;
      e.status = 'converted';
      return json(201, reg(9, { applicationNumber: 'REG-000045', enquiryId: e.id }));
    }
    if (path === '/student-registrations' && method === 'GET') {
      const status = url.searchParams.get('status');
      const classId = url.searchParams.get('classId');
      const yearId = url.searchParams.get('yearId');
      const items = rows.filter((r) => (!status || r.status === status) && (!classId || r.classId === classId) && (!yearId || r.yearId === yearId));
      return json(200, { items, page: { number: 1, size: 25, total: items.length } });
    }
    if (path === '/student-registrations' && method === 'POST') {
      const errs = [];
      if (!String(body?.firstName ?? '').trim()) errs.push({ field: 'firstName', code: 'required', message: 'Enter a first name.' });
      if (!String(body?.guardianPhone ?? '').trim()) errs.push({ field: 'guardianPhone', code: 'required', message: 'Enter a phone number we can reach the family on.' });
      if (errs.length) return problem(400, 'validation_failed', errs);
      const r = { ...reg(0), ...(body as Partial<Registration>), id: 'r-new', applicationNumber: 'REG-000099', fullName: String(body?.firstName) } as Registration;
      rows.push(r);
      return json(201, r);
    }
    const m = /^\/student-registrations\/(.+)$/.exec(path);
    if (m) {
      const i = rows.findIndex((r) => r.id === m[1]);
      if (i < 0) return problem(404, 'not_found');
      if (method === 'PUT') {
        rows[i] = { ...rows[i]!, ...(body as Partial<Registration>) };
        return json(200, rows[i]);
      }
      if (method === 'DELETE') {
        rows.splice(i, 1);
        return new Response(null, { status: 204 });
      }
    }
    return json(404, {});
  }) as typeof fetch;
  return { fetchFn, calls, rows, enqs };
}

function mount(path: string, permissions: string[], regs: Registration[], enqs: Enquiry[] = [], opts?: { registerFails?: 'conflict' | 'missing' }) {
  const server = fakeServer(permissions, regs, enqs, opts);
  render(
    <MemoryRouter initialEntries={[path]}>
      <ShellApp session={createWebSession(server.fetchFn)} />
    </MemoryRouter>,
  );
  return server;
}

describe('registrations page', () => {
  it('lists registrations with number, class, year and status; a view-only user sees no write controls', async () => {
    mount('/registrations', ['adm.student_registrations.view'], [reg(1, { status: 'under_review', sectionName: 'Section A' }), reg(2, { gender: null })]);
    expect(await screen.findByText('Child1 Rao')).toBeInTheDocument();
    const table = screen.getByRole('table');
    expect(within(table).getByText('REG-000001')).toBeInTheDocument();
    expect(within(table).getByText('Under review')).toBeInTheDocument();
    expect(within(table).getByText('Class 5 · Section A')).toBeInTheDocument();
    expect(within(table).getAllByText('10 Nov 2026')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: /^Add registration/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Edit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument();
  });

  it('is not available without the view permission', async () => {
    mount('/registrations', [], [reg(1)]);
    expect(await screen.findByRole('alert')).toHaveTextContent('Not available');
  });

  it('sends the status, class and year filters to the server', async () => {
    const server = mount('/registrations', REG, [reg(1), reg(2, { status: 'accepted', classId: 'c2' })]);
    await screen.findByText('Child1 Rao');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'accepted');
    await waitFor(() => expect(server.calls.some((c) => c.path.includes('status=accepted'))).toBe(true));
    expect(await screen.findByText('Child2 Rao')).toBeInTheDocument();
    const classes = screen.getByRole('combobox', { name: 'Class' });
    await waitFor(() => expect(within(classes).getByRole('option', { name: 'Class 6' })).toBeInTheDocument());
    await userEvent.selectOptions(classes, 'c2');
    await waitFor(() => expect(server.calls.some((c) => c.path.includes('classId=c2'))).toBe(true));
    const years = screen.getByRole('combobox', { name: 'Academic year' });
    await waitFor(() => expect(within(years).getByRole('option', { name: '2027-28' })).toBeInTheDocument());
    await userEvent.selectOptions(years, 'y1');
    await waitFor(() => expect(server.calls.some((c) => c.path.includes('yearId=y1'))).toBe(true));
  });

  it('adds a registration with today as the date, no section, and clean optional values', async () => {
    const server = mount('/registrations', REG, [reg(1)]);
    await userEvent.click(await screen.findByRole('button', { name: 'Add registration' }));
    const sheet = await screen.findByRole('dialog', { name: 'Add registration' });
    expect(within(sheet).getByLabelText('Applied on *')).toHaveValue(today());
    await userEvent.type(within(sheet).getByLabelText('First name *'), 'Anaya');
    await userEvent.type(within(sheet).getByLabelText('Date of birth *'), '2018-03-14');
    await userEvent.type(within(sheet).getByLabelText('Guardian’s phone *'), '+91 98100 12345');
    await waitFor(() => expect(within(sheet).getByRole('option', { name: 'Class 5' })).toBeInTheDocument());
    await userEvent.selectOptions(within(sheet).getByLabelText('Class *'), 'c1');
    await userEvent.selectOptions(within(sheet).getByLabelText('Academic year *'), 'y1');
    expect(within(sheet).queryByLabelText(/APAAR|Aadhaar|Religion|Caste/i)).not.toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Registration added.');
    const post = server.calls.find((c) => c.method === 'POST' && c.path === '/student-registrations')!;
    expect(post.body).toMatchObject({ firstName: 'Anaya', dateOfBirth: '2018-03-14', classId: 'c1', yearId: 'y1', status: 'submitted', sectionId: null, gender: null, middleName: null, siblingStudentCode: null });
    expect(post.body).not.toHaveProperty('applicationNumber');
  });

  it('shows field errors from the server', async () => {
    mount('/registrations', REG, [reg(1)]);
    await userEvent.click(await screen.findByRole('button', { name: 'Add registration' }));
    const sheet = await screen.findByRole('dialog');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(await within(sheet).findByText('Enter a first name.')).toBeInTheDocument();
    expect(within(sheet).getByText('Enter a phone number we can reach the family on.')).toBeInTheDocument();
    expect(within(sheet).getByLabelText('First name *')).toHaveAttribute('aria-invalid', 'true');
  });

  it('edits with prefilled values, shows the number it cannot change, and can move the status on', async () => {
    const server = mount('/registrations', REG, [reg(1, { enquiryCode: 'ENQ-7' })]);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit REG-000001 · Child1 Rao' }));
    const sheet = await screen.findByRole('dialog', { name: 'Edit registration' });
    expect(within(sheet).getByTestId('registration-number')).toHaveTextContent('Application number REG-000001 · from enquiry ENQ-7');
    expect(within(sheet).getByLabelText('First name *')).toHaveValue('Child1');
    await waitFor(() => expect(within(sheet).getByLabelText('Class *')).toHaveValue('c1'));
    await userEvent.selectOptions(within(sheet).getByLabelText('Status *'), 'accepted');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(within(screen.getByRole('table')).getByText('Accepted')).toBeInTheDocument());
    expect(server.calls.find((c) => c.method === 'PUT')?.body).toMatchObject({ status: 'accepted', classId: 'c1' });
  });

  it('asks before deleting', async () => {
    const server = mount('/registrations', REG, [reg(1), reg(2)]);
    await userEvent.click(await screen.findByRole('button', { name: 'Delete REG-000001 · Child1 Rao' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(server.calls.some((c) => c.method === 'DELETE')).toBe(false);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('Child1 Rao')).not.toBeInTheDocument());
  });
});

describe('registering an enquiry', () => {
  it('offers Register on open enquiries only, to people who can create registrations', async () => {
    mount('/enquiries', [...ENQ_VIEW, 'adm.student_registrations.create'], [], [enquiry(1), enquiry(2, { status: 'converted' }), enquiry(3, { status: 'closed' })]);
    await screen.findByText('Kid 1');
    expect(screen.getByRole('button', { name: 'Register ENQ-1 · Kid 1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Register ENQ-2/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Register ENQ-3/ })).not.toBeInTheDocument();
  });

  it('hides Register from someone who can only see enquiries', async () => {
    mount('/enquiries', ENQ_VIEW, [], [enquiry(1)]);
    await screen.findByText('Kid 1');
    expect(screen.queryByRole('button', { name: /^Register/ })).not.toBeInTheDocument();
  });

  it('asks first, then registers and tells the number', async () => {
    const server = mount('/enquiries', [...ENQ_VIEW, 'adm.student_registrations.create'], [], [enquiry(1)]);
    await userEvent.click(await screen.findByRole('button', { name: 'Register ENQ-1 · Kid 1' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByText(/marks the enquiry as converted/)).toBeInTheDocument();
    expect(server.calls.some((c) => c.path.endsWith('/register'))).toBe(false);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Register' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Registered as REG-000045.');
    expect(server.calls.filter((c) => c.method === 'POST' && c.path === '/enquiries/e-1/register')).toHaveLength(1);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Register ENQ-1 · Kid 1' })).not.toBeInTheDocument());
  });

  it('shows why it was refused and keeps the dialog open', async () => {
    mount('/enquiries', [...ENQ_VIEW, 'adm.student_registrations.create'], [], [enquiry(1)], { registerFails: 'missing' });
    await userEvent.click(await screen.findByRole('button', { name: 'Register ENQ-1 · Kid 1' }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Register' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('This enquiry has no date of birth.');
  });

  it('says so when the enquiry already has a registration', async () => {
    mount('/enquiries', [...ENQ_VIEW, 'adm.student_registrations.create'], [], [enquiry(1)], { registerFails: 'conflict' });
    await userEvent.click(await screen.findByRole('button', { name: 'Register ENQ-1 · Kid 1' }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Register' }));
    expect(await within(dialog).findByRole('alert')).toHaveTextContent('This enquiry already has a registration.');
  });
});

describe('registration descriptor', () => {
  it('trims required fields and turns blank optional ones into null', () => {
    const input = registrationsDescriptor.toInput({ appliedOn: '2026-11-10', firstName: ' A ', guardianPhone: ' 123 ', classId: 'c1', yearId: 'y1', dateOfBirth: '2018-01-01', status: '', middleName: ' ', gender: '', sectionId: '' });
    expect(input).toMatchObject({ firstName: 'A', guardianPhone: '123', status: 'submitted', middleName: null, gender: null, sectionId: null });
  });
  it('collects no Aadhaar, religion, caste or APAAR field', () => {
    expect(registrationsDescriptor.fields.map((f) => f.key).join(' ')).not.toMatch(/aadhaar|religion|caste|category|apaar|income/i);
  });
});
