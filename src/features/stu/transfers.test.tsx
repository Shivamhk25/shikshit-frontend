import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebSession } from '../../shell/web-session';
import { ShellApp } from '../../shell/ShellApp';
import { NAV_ICONS } from '../../shell/navIcons';
import { registry } from '../../shell/registry';
import {
  allowedActions, approvalHref, blankTransferForm, buildCreateBody, buildListQuery, buildUpdateBody, certificateHref, certificateRows, formFromTransfer, readFailure, studentOption, timelineSteps, todayIndia, validateTransferForm,
  type Transfer, type TransferCertificate, type TransferStatus,
} from './transfers';

const VIEW = ['stu.student_transfers.view'];
const ALL = [...VIEW, 'stu.student_transfers.create', 'stu.student_transfers.edit', 'stu.student_transfers.delete', 'stu.students.view', 'aca.classes.view'];

function transfer(id: string, status: TransferStatus, over: Partial<Transfer> = {}): Transfer {
  return {
    id, student: { id: `s-${id}`, name: `Child ${id}`, registrationCode: `R-000${id}` }, className: 'Class 5', sectionName: 'A', yearName: '2026-27', requestedOn: '2026-11-10', reason: 'relocation', reasonNote: null,
    destinationSchool: 'Pune Public School', lastAttendanceDate: '2026-11-08', status, approvalRequestId: status === 'requested' ? 'ap-1' : null, tcNumber: null, tcIssuedOn: null,
    dues: { status: 'not_tracked', note: 'Fee dues are not tracked yet.' }, createdAt: '2026-11-10T04:00:00Z', updatedAt: '2026-11-10T04:00:00Z', ...over,
  };
}
const REQUESTED = transfer('1', 'requested');
const APPROVED = transfer('2', 'approved');
const COMPLETED = transfer('3', 'completed', { tcNumber: 'TC-000012', tcIssuedOn: '2026-11-20' });
const REJECTED = transfer('4', 'rejected');
const CANCELLED = transfer('5', 'cancelled');
const ROWS = [REQUESTED, APPROVED, COMPLETED, REJECTED, CANCELLED];

const CERT: TransferCertificate = {
  tcNumber: 'TC-000012', issuedOn: '2026-11-20', schoolName: 'Springfield Public School',
  student: { fullName: 'Child 3', registrationCode: 'R-0003', dateOfBirth: '2015-06-01', gender: 'female', admissionDate: '2021-04-05' },
  className: 'Class 5', sectionName: 'A', yearName: '2026-27', lastAttendanceDate: '2026-11-08', reason: 'other', reasonLabel: 'Other', reasonNote: 'Moving abroad for a year', destinationSchool: 'Pune Public School',
  guardians: [{ name: 'Meera Rao', relation: 'mother' }, { name: 'Anil Rao', relation: 'father' }],
};

type Call = { method: string; path: string; body?: Record<string, unknown> };
type Handler = (path: string, method: string, body: Record<string, unknown> | undefined, url: URL) => { status: number; body?: unknown } | undefined;

function mount(path: string, permissions: string[], handler: Handler = () => undefined, rows: Transfer[] = ROWS) {
  const calls: Call[] = [];
  const json = (status: number, body?: unknown) => (status === 204 ? new Response(null, { status }) : new Response(JSON.stringify(body ?? {}), { status, headers: { 'Content-Type': 'application/json' } }));
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://x');
    const p = url.pathname.replace('/api/v1', '');
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    calls.push({ method, path: p + url.search, body });
    if (p === '/auth/refresh') return json(200, { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 9e5).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 9e8).toISOString(), mustChangePassword: false });
    if (p === '/me/access')
      return json(200, {
        user: { id: 'u1', name: 'Asha', tier: 'tenant' }, tenant: { id: 't1', name: 'School', brand: { primary: '#2F5BFF' }, modules: ['stu'] }, permissions, scopes: {}, fieldMasks: {},
        workspace: { home: 'x', navigation: [{ screenId: 'transfers', label: 'Transfers', order: 45 }] }, mobile: { tabs: [], features: [] }, approvals: { canApprove: [] }, version: 1,
      });
    const custom = handler(p, method, body, url);
    if (custom) return json(custom.status, custom.body);
    if (p === '/student-transfers' && method === 'GET') return json(200, { items: rows, page: { number: 1, size: 25, total: rows.length } });
    if (p === '/classes') return json(200, { items: [{ id: 'c1', name: 'Class 5' }], page: { number: 1, size: 200, total: 1 } });
    if (p === '/students') {
      const status = url.searchParams.get('status');
      const items = status === 'active' ? [{ id: 'st1', registrationCode: 'R-0100', fullName: 'Asha Rao', status: 'active', currentClassName: 'Class 5', currentSectionName: 'A' }] : [{ id: 'st2', registrationCode: 'R-0101', fullName: 'Kabir Mehta', status: 'paused', currentClassName: 'Class 6', currentSectionName: null }];
      return json(200, { items, page: { number: 1, size: 20, total: 1 } });
    }
    return json(404, {});
  }) as typeof fetch;
  render(
    <MemoryRouter initialEntries={[path]}>
      <ShellApp session={createWebSession(fetchFn)} />
    </MemoryRouter>,
  );
  return calls;
}

afterEach(() => vi.restoreAllMocks());

const isCreate = (c: Call) => c.method === 'POST' && c.path === '/student-transfers';

describe('the transfers screen is registered', () => {
  it('has a web path, a phone route, an icon and the permission the server uses', () => {
    expect(registry.transfers).toMatchObject({ module: 'stu', permission: 'stu.student_transfers.view', parity: 'Companion', web: { path: '/transfers' }, mobile: { route: '/transfers' } });
    expect(NAV_ICONS.transfers).toBeDefined();
  });
});

describe('what each status allows', () => {
  const ALL_PERMS = { view: true, edit: true, delete: true };
  const NONE = { view: true, edit: false, delete: false };
  const table: [TransferStatus, string[]][] = [
    ['requested', ['view', 'edit', 'openApproval', 'cancel']],
    ['approved', ['view', 'edit', 'complete', 'cancel']],
    ['completed', ['view', 'printCertificate']],
    ['rejected', ['view', 'delete']],
    ['cancelled', ['view', 'delete']],
  ];
  it.each(table)('a person with every right on a %s transfer', (status, expected) => {
    expect(allowedActions({ status, approvalRequestId: 'ap-1' }, ALL_PERMS)).toEqual(expected);
  });
  it.each([
    ['requested', ['view', 'openApproval']],
    ['approved', ['view']],
    ['completed', ['view', 'printCertificate']],
    ['rejected', ['view']],
    ['cancelled', ['view']],
  ] as [TransferStatus, string[]][])('a view-only person on a %s transfer sees no change controls', (status, expected) => {
    expect(allowedActions({ status, approvalRequestId: 'ap-1' }, NONE)).toEqual(expected);
  });
  it('edit rights do not give delete, and delete rights do not give edit', () => {
    expect(allowedActions({ status: 'cancelled', approvalRequestId: null }, { view: true, edit: true, delete: false })).toEqual(['view']);
    expect(allowedActions({ status: 'approved', approvalRequestId: null }, { view: true, edit: false, delete: true })).toEqual(['view']);
  });
  it('a request without an approval link offers none, and no one sees anything without view', () => {
    expect(allowedActions({ status: 'requested', approvalRequestId: null }, ALL_PERMS)).not.toContain('openApproval');
    expect(allowedActions({ status: 'requested', approvalRequestId: 'x' }, { view: false, edit: true, delete: true })).toEqual([]);
  });
  it('a completed transfer can never be edited, cancelled or deleted', () => {
    expect(allowedActions({ status: 'completed', approvalRequestId: null }, ALL_PERMS)).toEqual(['view', 'printCertificate']);
  });
});

describe('requests, validation and the timeline', () => {
  it('builds the list query without empty filters', () => {
    expect(buildListQuery({})).toBe('page=1&pageSize=25');
    expect(buildListQuery({ page: 2, sort: '-requested', search: ' rao ', status: 'approved', classId: 'c1' })).toBe('page=2&pageSize=25&sort=-requested&q=rao&status=approved&classId=c1');
  });

  it('Other needs a note, and the other rules hold', () => {
    const base = { ...blankTransferForm(new Date('2026-11-23T05:00:00Z')), studentId: 's1' };
    expect(validateTransferForm({ ...base, reason: 'relocation' }, 'create')).toEqual({});
    expect(validateTransferForm({ ...base, reason: 'other' }, 'create')).toEqual({ reasonNote: 'Tell us the reason when you choose Other.' });
    expect(validateTransferForm({ ...base, reason: 'other', reasonNote: '   ' }, 'create').reasonNote).toBeDefined();
    expect(validateTransferForm({ ...base, reason: 'other', reasonNote: 'Moving' }, 'create')).toEqual({});
    expect(validateTransferForm({ ...base, reason: '' }, 'create').reason).toBe('Choose a reason.');
    expect(validateTransferForm({ ...base, studentId: '', reason: 'health' }, 'create').studentId).toBeDefined();
    expect(validateTransferForm({ ...base, reason: 'health', reasonNote: 'x'.repeat(1001) }, 'create').reasonNote).toMatch(/1000/);
    expect(validateTransferForm({ ...base, reason: 'health', lastAttendanceDate: '2999-01-01' }, 'create').lastAttendanceDate).toBeDefined();
    expect(validateTransferForm({ ...base, reason: 'health', requestedOn: '2999-01-01' }, 'create').requestedOn).toBeDefined();
  });

  it('editing does not ask for the student or the request date again', () => {
    expect(validateTransferForm({ ...formFromTransfer(REQUESTED), studentId: '', requestedOn: '' }, 'edit')).toEqual({});
  });

  it('sends blank optional values as null and leaves the student and date out of a change', () => {
    const f = { ...blankTransferForm(new Date('2026-11-23T05:00:00Z')), studentId: 's1', reason: 'financial' as const, destinationSchool: ' New School ' };
    expect(buildCreateBody(f)).toEqual({ studentId: 's1', requestedOn: '2026-11-23', reason: 'financial', reasonNote: null, destinationSchool: 'New School', lastAttendanceDate: null });
    expect(buildUpdateBody(f)).toEqual({ reason: 'financial', reasonNote: null, destinationSchool: 'New School', lastAttendanceDate: null });
  });

  it('works out today in India, not the browser zone', () => {
    expect(todayIndia(new Date('2026-11-22T19:00:00Z'))).toBe('2026-11-23');
  });

  it('links to the approval and the certificate', () => {
    expect(approvalHref('a b')).toBe('/approvals?id=a%20b');
    expect(certificateHref('t1')).toBe('/transfers/t1/certificate');
  });

  it('shows how far each status has got', () => {
    const states = (s: TransferStatus) => timelineSteps(transfer('x', s, { tcNumber: 'TC-000012', tcIssuedOn: '2026-11-20' })).map((x) => `${x.key}:${x.state}`);
    expect(states('requested')).toEqual(['requested:done', 'approved:current', 'completed:upcoming']);
    expect(states('approved')).toEqual(['requested:done', 'approved:done', 'completed:current']);
    expect(states('completed')).toEqual(['requested:done', 'approved:done', 'completed:done']);
    expect(states('rejected')).toEqual(['requested:done', 'rejected:stopped']);
    expect(states('cancelled')).toEqual(['requested:done', 'cancelled:stopped']);
  });
});

describe('reading a failed answer', () => {
  const res = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
  it('maps field problems to their fields, first message wins', async () => {
    const e = await readFailure(res(400, { code: 'validation_failed', errors: [{ field: 'reasonNote', message: 'Required for other.' }, { field: 'reasonNote', message: 'second' }, { field: 'lastAttendanceDate', message: 'Too early.' }] }));
    expect(e.fields).toEqual({ reasonNote: 'Required for other.', lastAttendanceDate: 'Too early.' });
  });
  it.each([
    ['open_transfer', /already has a transfer in progress/],
    ['not_approved', /not been approved/],
    ['not_editable', /can no longer be changed/],
    ['not_cancellable', /can no longer be cancelled/],
    ['not_deletable', /cancelled or rejected/],
    ['not_completed', /once the transfer is completed/],
    ['student_not_transferable', /no longer active/],
  ])('says %s in plain words', async (code, pattern) => {
    expect((await readFailure(res(409, { code, detail: 'raw server text' }))).message).toMatch(pattern);
  });
  it('keeps the server’s words when fees hold a transfer back', async () => {
    expect((await readFailure(res(409, { code: 'not_eligible', detail: 'Fees are unpaid.' }))).message).toBe('Fees are unpaid.');
  });
  it('explains 403 and 404', async () => {
    expect((await readFailure(res(403, { code: 'permission_denied', detail: 'Only the person who requested it can cancel it.' }))).message).toBe('Only the person who requested it can cancel it.');
    expect((await readFailure(res(403, { code: 'read_only_visit' }))).message).toMatch(/support visit/);
    expect((await readFailure(res(404, {}))).message).toMatch(/no longer exists/);
  });
});

describe('the list', () => {
  it('shows every transfer with its status, dues and the actions that fit it', async () => {
    mount('/transfers', ALL);
    expect(await screen.findByText('Child 1')).toBeInTheDocument();
    expect(screen.getByText('TC-000012')).toBeInTheDocument();
    for (const label of ['Requested', 'Approved', 'Completed', 'Rejected', 'Cancelled']) expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Not tracked yet')).toHaveLength(5);
    // requested
    expect(screen.getByRole('button', { name: 'Edit Child 1 (R-0001)' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open approval for Child 1 (R-0001)' })).toHaveAttribute('href', '/approvals?id=ap-1');
    expect(screen.getByRole('button', { name: 'Cancel transfer of Child 1 (R-0001)' })).toBeInTheDocument();
    // approved
    expect(screen.getByRole('button', { name: 'Complete transfer of Child 2 (R-0002)' })).toBeInTheDocument();
    // completed
    expect(screen.getByRole('link', { name: 'Print TC of Child 3 (R-0003)' })).toHaveAttribute('href', '/transfers/3/certificate');
    expect(screen.queryByRole('button', { name: /Edit Child 3|Cancel transfer of Child 3|Delete transfer of Child 3/ })).toBeNull();
    // rejected and cancelled
    expect(screen.getByRole('button', { name: 'Delete transfer of Child 4 (R-0004)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Delete transfer of Child 5 (R-0005)' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Complete transfer of Child 4/ })).toBeNull();
  });

  it('a view-only person sees no way to request, edit, complete, cancel or delete', async () => {
    mount('/transfers', VIEW);
    await screen.findByText('Child 1');
    expect(screen.queryByRole('button', { name: 'Request transfer' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^(Edit|Complete|Cancel|Delete)/ })).toBeNull();
    expect(screen.getByRole('link', { name: /Open approval for Child 1/ })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Print TC of Child 3/ })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /^View / })).toHaveLength(5);
  });

  it('shows the screen as unavailable to someone without the view permission', async () => {
    mount('/transfers', ['stu.students.view']);
    expect(await screen.findByText('Not available')).toBeInTheDocument();
  });

  it('asks the server for the filters and the sort the person chose', async () => {
    const calls = mount('/transfers', ALL);
    await screen.findByText('Child 1');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'approved');
    await waitFor(() => expect(calls.some((c) => c.path.includes('status=approved'))).toBe(true));
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Class' }), 'c1');
    await waitFor(() => expect(calls.some((c) => c.path.includes('classId=c1'))).toBe(true));
    await userEvent.click(screen.getByRole('button', { name: 'Student' }));
    await waitFor(() => expect(calls.some((c) => c.path.includes('sort=student'))).toBe(true));
    expect(calls[calls.findIndex((c) => c.path.startsWith('/student-transfers'))].path).toContain('sort=-requested');
  });

  it('says so when there are no transfers, and when the list cannot load', async () => {
    mount('/transfers', ALL, undefined, []);
    expect(await screen.findByText(/No transfers yet\./)).toBeInTheDocument();
  });

  it('shows an error with a way to try again', async () => {
    let fail = true;
    mount('/transfers', ALL, (p, m) => (p === '/student-transfers' && m === 'GET' && fail ? { status: 500, body: { detail: 'The list could not be loaded.' } } : undefined));
    expect(await screen.findByRole('alert')).toHaveTextContent('The list could not be loaded.');
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Child 1')).toBeInTheDocument();
  });
});

describe('requesting a transfer', () => {
  async function openRequest() {
    await screen.findByText('Child 1');
    await userEvent.click(screen.getByRole('button', { name: 'Request transfer' }));
    return screen.findByRole('dialog', { name: 'Request a transfer' });
  }
  async function chooseStudent(sheet: ReturnType<typeof within>) {
    const results = sheet.getByRole('combobox', { name: 'Student results' });
    await waitFor(() => expect(within(results).getByRole('option', { name: /Asha Rao \(R-0100\)/ })).toBeInTheDocument());
    await userEvent.selectOptions(results, 'st1');
  }

  it('searches active and paused students and sends the request', async () => {
    const calls = mount('/transfers', ALL, (p, m) => (p === '/student-transfers' && m === 'POST' ? { status: 201, body: transfer('9', 'requested') } : undefined));
    const sheet = within(await openRequest());
    await waitFor(() => expect(calls.filter((c) => c.path.startsWith('/students?')).map((c) => new URL(c.path, 'http://x').searchParams.get('status')).sort()).toEqual(['active', 'paused']));
    expect(calls.find((c) => c.path.startsWith('/students?'))!.path).toContain('pageSize=20');
    await chooseStudent(sheet);
    expect(sheet.getByRole('option', { name: /Kabir Mehta \(R-0101\) · Class 6 · paused/ })).toBeInTheDocument();
    await userEvent.selectOptions(sheet.getByRole('combobox', { name: 'Reason *' }), 'health');
    await userEvent.type(sheet.getByLabelText('Destination school'), 'Delhi Public School');
    await userEvent.click(sheet.getByRole('button', { name: 'Request transfer' }));
    await waitFor(() => expect(calls.some(isCreate)).toBe(true));
    const post = calls.find(isCreate)!;
    expect(post.path).toBe('/student-transfers');
    expect(post.body).toMatchObject({ studentId: 'st1', reason: 'health', reasonNote: null, destinationSchool: 'Delhi Public School', lastAttendanceDate: null });
    expect(post.body!.requestedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Request a transfer' })).toBeNull());
  });

  it('asks for a note when the reason is Other, shows the counter, and does not send until it is there', async () => {
    const calls = mount('/transfers', ALL, (p, m) => (p === '/student-transfers' && m === 'POST' ? { status: 201, body: transfer('9', 'requested') } : undefined));
    const sheet = within(await openRequest());
    await chooseStudent(sheet);
    await userEvent.selectOptions(sheet.getByRole('combobox', { name: 'Reason *' }), 'other');
    expect(sheet.getByLabelText('Note *')).toBeInTheDocument();
    await userEvent.click(sheet.getByRole('button', { name: 'Request transfer' }));
    expect(await sheet.findByText('Tell us the reason when you choose Other.')).toBeInTheDocument();
    expect(calls.some(isCreate)).toBe(false);
    await userEvent.type(sheet.getByLabelText('Note *'), 'Moving abroad');
    expect(sheet.getByTestId('note-counter')).toHaveTextContent('13/1000');
    expect(sheet.queryByText('Tell us the reason when you choose Other.')).toBeNull();
    await userEvent.click(sheet.getByRole('button', { name: 'Request transfer' }));
    await waitFor(() => expect(calls.some(isCreate)).toBe(true));
    expect(calls.find(isCreate)!.body).toMatchObject({ reason: 'other', reasonNote: 'Moving abroad' });
  });

  it('puts the server’s field problems on their fields', async () => {
    mount('/transfers', ALL, (p, m) => (p === '/student-transfers' && m === 'POST' ? { status: 400, body: { code: 'validation_failed', errors: [{ field: 'lastAttendanceDate', message: 'Not before the admission date.' }] } } : undefined));
    const sheet = within(await openRequest());
    await chooseStudent(sheet);
    await userEvent.selectOptions(sheet.getByRole('combobox', { name: 'Reason *' }), 'relocation');
    await userEvent.click(sheet.getByRole('button', { name: 'Request transfer' }));
    expect(await sheet.findByText('Not before the admission date.')).toBeInTheDocument();
    expect(sheet.getByLabelText('Last day of attendance')).toHaveAccessibleDescription('Not before the admission date.');
  });

  it('explains a conflict in plain words and keeps the form open', async () => {
    mount('/transfers', ALL, (p, m) => (p === '/student-transfers' && m === 'POST' ? { status: 409, body: { code: 'open_transfer', detail: 'x' } } : undefined));
    const sheet = within(await openRequest());
    await chooseStudent(sheet);
    await userEvent.selectOptions(sheet.getByRole('combobox', { name: 'Reason *' }), 'relocation');
    await userEvent.click(sheet.getByRole('button', { name: 'Request transfer' }));
    expect(await sheet.findByRole('alert')).toHaveTextContent('already has a transfer in progress');
    expect(screen.getByRole('dialog', { name: 'Request a transfer' })).toBeInTheDocument();
  });

  it('tells someone who cannot view students why they cannot pick one', async () => {
    const calls = mount('/transfers', ['stu.student_transfers.view', 'stu.student_transfers.create']);
    const sheet = within(await openRequest());
    expect(sheet.getByText(/You need permission to view students/)).toBeInTheDocument();
    expect(sheet.getByRole('button', { name: 'Request transfer' })).toBeDisabled();
    expect(calls.some((c) => c.path.startsWith('/students'))).toBe(false);
  });

  it('says the approver is someone else', async () => {
    mount('/transfers', ALL);
    const sheet = within(await openRequest());
    expect(sheet.getByText(/Waiting for approval by someone else with transfer rights/)).toBeInTheDocument();
  });
});

describe('editing, completing, cancelling and deleting', () => {
  it('edits an open transfer with the student fixed and sends only the editable fields', async () => {
    const calls = mount('/transfers', ALL, (p, m) => (p === '/student-transfers/2' && m === 'PUT' ? { status: 200, body: APPROVED } : undefined));
    await screen.findByText('Child 2');
    await userEvent.click(screen.getByRole('button', { name: 'Edit Child 2 (R-0002)' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Edit transfer' }));
    expect(sheet.getByTestId('fixed-student')).toHaveTextContent('Child 2');
    expect(sheet.queryByLabelText(/Student/)).toBeNull();
    expect(sheet.queryByLabelText(/Requested on/)).toBeNull();
    await userEvent.selectOptions(sheet.getByRole('combobox', { name: 'Reason *' }), 'financial');
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true));
    expect(calls.find((c) => c.method === 'PUT')!.body).toEqual({ reason: 'financial', reasonNote: null, destinationSchool: 'Pune Public School', lastAttendanceDate: '2026-11-08' });
  });

  it('completes an approved transfer after explaining what it does, with the issue date', async () => {
    const done = transfer('2', 'completed', { tcNumber: 'TC-000013', tcIssuedOn: '2026-11-21' });
    const calls = mount('/transfers', ALL, (p, m) => (p === '/student-transfers/2/complete' && m === 'POST' ? { status: 200, body: { transfer: done, alreadyCompleted: false } } : undefined));
    await screen.findByText('Child 2');
    await userEvent.click(screen.getByRole('button', { name: 'Complete transfer of Child 2 (R-0002)' }));
    const dialog = within(await screen.findByRole('alertdialog', { name: 'Complete the transfer of Child 2?' }));
    expect(dialog.getByText(/marks the student as/)).toHaveTextContent(/cannot be undone/);
    const date = dialog.getByLabelText('Certificate issue date');
    expect(date).toHaveValue(todayIndia());
    await userEvent.clear(date);
    await userEvent.type(date, '2026-11-21');
    await userEvent.click(dialog.getByRole('button', { name: 'Complete transfer' }));
    await waitFor(() => expect(calls.some((c) => c.path === '/student-transfers/2/complete')).toBe(true));
    expect(calls.find((c) => c.path === '/student-transfers/2/complete')!.body).toEqual({ issuedOn: '2026-11-21' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('does not send an issue date before the request date', async () => {
    const calls = mount('/transfers', ALL);
    await screen.findByText('Child 2');
    await userEvent.click(screen.getByRole('button', { name: 'Complete transfer of Child 2 (R-0002)' }));
    const dialog = within(await screen.findByRole('alertdialog'));
    const date = dialog.getByLabelText('Certificate issue date');
    await userEvent.clear(date);
    await userEvent.type(date, '2026-11-01');
    await userEvent.click(dialog.getByRole('button', { name: 'Complete transfer' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('before the request date');
    expect(calls.some((c) => c.path.endsWith('/complete'))).toBe(false);
  });

  it('shows a refusal to complete in plain words', async () => {
    mount('/transfers', ALL, (p, m) => (p.endsWith('/complete') && m === 'POST' ? { status: 409, body: { code: 'student_not_transferable', detail: 'x' } } : undefined));
    await screen.findByText('Child 2');
    await userEvent.click(screen.getByRole('button', { name: 'Complete transfer of Child 2 (R-0002)' }));
    const dialog = within(await screen.findByRole('alertdialog'));
    await userEvent.click(dialog.getByRole('button', { name: 'Complete transfer' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('no longer active');
  });

  it('cancels with an optional reason after asking', async () => {
    const calls = mount('/transfers', ALL, (p, m) => (p === '/student-transfers/1/cancel' && m === 'POST' ? { status: 200, body: transfer('1', 'cancelled') } : undefined));
    await screen.findByText('Child 1');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel transfer of Child 1 (R-0001)' }));
    const dialog = within(await screen.findByRole('alertdialog', { name: 'Cancel the transfer of Child 1?' }));
    await userEvent.type(dialog.getByLabelText('Reason (optional)'), 'Family stayed');
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel transfer' }));
    await waitFor(() => expect(calls.some((c) => c.path === '/student-transfers/1/cancel')).toBe(true));
    expect(calls.find((c) => c.path === '/student-transfers/1/cancel')!.body).toEqual({ comment: 'Family stayed' });
  });

  it('shows the engine’s message when only the requester may cancel', async () => {
    mount('/transfers', ALL, (p, m) => (p.endsWith('/cancel') && m === 'POST' ? { status: 403, body: { code: 'permission_denied', detail: 'Only the person who requested it can cancel it.' } } : undefined));
    await screen.findByText('Child 1');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel transfer of Child 1 (R-0001)' }));
    const dialog = within(await screen.findByRole('alertdialog'));
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel transfer' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('Only the person who requested it can cancel it.');
  });

  it('deletes a cancelled transfer after asking', async () => {
    const calls = mount('/transfers', ALL, (p, m) => (p === '/student-transfers/5' && m === 'DELETE' ? { status: 204 } : undefined));
    await screen.findByText('Child 5');
    await userEvent.click(screen.getByRole('button', { name: 'Delete transfer of Child 5 (R-0005)' }));
    const dialog = within(await screen.findByRole('alertdialog'));
    await userEvent.click(dialog.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE')).toBe(true));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });
});

describe('the detail view', () => {
  it('shows every field, the timeline, the dues note and the approval link', async () => {
    mount('/transfers', ALL, undefined, [transfer('1', 'requested', { reason: 'other', reasonNote: 'Moving abroad' })]);
    await userEvent.click(await screen.findByRole('button', { name: 'View Child 1 (R-0001)' }));
    const sheet = within(await screen.findByRole('dialog', { name: /Child 1/ }));
    expect(sheet.getByText('Moving abroad')).toBeInTheDocument();
    expect(sheet.getByText('Pune Public School')).toBeInTheDocument();
    expect(sheet.getByText('Not tracked yet')).toBeInTheDocument();
    expect(sheet.getByText(/Waiting for approval by someone else with transfer rights/)).toBeInTheDocument();
    const steps = sheet.getByRole('list', { name: 'Progress of this transfer' });
    expect(within(steps).getAllByRole('listitem')).toHaveLength(3);
    expect(sheet.getByRole('link', { name: 'Open approval' })).toHaveAttribute('href', '/approvals?id=ap-1');
  });

  it('shows the TC number and a print link once completed', async () => {
    mount('/transfers', ALL, undefined, [COMPLETED]);
    await userEvent.click(await screen.findByRole('button', { name: 'View Child 3 (R-0003)' }));
    const sheet = within(await screen.findByRole('dialog', { name: /Child 3/ }));
    expect(sheet.getAllByText('TC-000012').length).toBeGreaterThan(0);
    expect(sheet.getByRole('link', { name: 'Print TC' })).toHaveAttribute('href', '/transfers/3/certificate');
  });
});

describe('the transfer certificate', () => {
  it('lays out the facts for printing, with signature lines and the PDF note', async () => {
    const print = vi.fn();
    vi.stubGlobal('print', print);
    mount('/transfers/3/certificate', VIEW, (p) => (p === '/student-transfers/3/certificate' ? { status: 200, body: CERT } : undefined));
    const paper = within(await screen.findByRole('article', { name: 'Transfer certificate TC-000012' }));
    expect(paper.getByRole('heading', { name: 'Transfer Certificate' })).toBeInTheDocument();
    expect(paper.getByText('Springfield Public School', { selector: 'p.font-display' })).toBeInTheDocument();
    expect(paper.getByText('20 Nov 2026')).toBeInTheDocument();
    expect(paper.getByRole('rowheader', { name: 'Date of birth' }).nextElementSibling).toHaveTextContent('1 Jun 2015');
    expect(paper.getByRole('rowheader', { name: 'Class last studied' }).nextElementSibling).toHaveTextContent('Class 5 A, 2026-27');
    expect(paper.getByRole('rowheader', { name: 'Parent or guardian' }).nextElementSibling).toHaveTextContent('Meera Rao (mother), Anil Rao (father)');
    expect(paper.getByText('Moving abroad for a year')).toBeInTheDocument();
    expect(paper.getByText('Class teacher')).toBeInTheDocument();
    expect(paper.getByText('Principal')).toBeInTheDocument();
    expect(paper.getByText('School seal')).toBeInTheDocument();
    expect(screen.getByText(/PDF download will come later/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Print' }));
    expect(print).toHaveBeenCalledTimes(1);
    expect(document.title).toBe('TC-000012 · Child 3');
    vi.unstubAllGlobals();
  });

  it('refuses a transfer that is not completed, in friendly words', async () => {
    mount('/transfers/1/certificate', VIEW, (p) => (p === '/student-transfers/1/certificate' ? { status: 409, body: { code: 'not_completed', detail: 'x' } } : undefined));
    expect(await screen.findByRole('heading', { name: 'No certificate yet' })).toBeInTheDocument();
    expect(screen.getByText(/available once the transfer is completed/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Print' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to transfers' })).toHaveAttribute('href', '/transfers');
  });

  it('says so when the transfer is not found, and keeps the screen closed without permission', async () => {
    mount('/transfers/zz/certificate', VIEW, (p) => (p.endsWith('/certificate') ? { status: 404, body: { code: 'not_found' } } : undefined));
    expect(await screen.findByRole('heading', { name: 'Transfer not found' })).toBeInTheDocument();
  });

  it('is not available without the view permission', async () => {
    mount('/transfers/3/certificate', ['stu.students.view']);
    expect(await screen.findByText('Not available')).toBeInTheDocument();
  });

  it('lists the particulars in order and falls back to a dash for what the school does not hold', () => {
    const rows = certificateRows({ ...CERT, guardians: [], lastAttendanceDate: null, destinationSchool: null, className: null, sectionName: null, reasonNote: null, reason: 'health', reasonLabel: 'Health' });
    expect(rows.map((r) => r.label)).toEqual(['Name of the student', 'Registration number', 'Date of birth', 'Gender', 'Date of admission', 'Parent or guardian', 'Class last studied', 'Last day of attendance', 'Reason for leaving', 'School joined next']);
    expect(rows.find((r) => r.label === 'Parent or guardian')!.value).toBe('—');
    expect(rows.find((r) => r.label === 'Class last studied')!.value).toBe('—');
    expect(rows.find((r) => r.label === 'Gender')!.value).toBe('Female');
  });
});

describe('student choices', () => {
  it('names the class and marks a paused student', () => {
    expect(studentOption({ id: '1', registrationCode: 'R-1', fullName: 'Asha Rao', status: 'active', currentClassName: 'Class 5', currentSectionName: 'A' }).label).toBe('Asha Rao (R-1) · Class 5 A');
    expect(studentOption({ id: '2', registrationCode: 'R-2', fullName: 'Kabir', status: 'paused', currentClassName: null, currentSectionName: null }).label).toBe('Kabir (R-2) · paused');
  });
});
