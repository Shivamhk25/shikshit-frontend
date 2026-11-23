import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebSession } from '../../shell/web-session';
import { ShellApp } from '../../shell/ShellApp';
import { NAV_ICONS } from '../../shell/navIcons';
import { registry } from '../../shell/registry';
import { allowedActions, blankPauseForm, buildCreateBody, buildListQuery, buildUpdateBody, daysLabel, formFromPause, readFailure, validatePauseForm, type Pause, type PauseStatus } from './pauses';

const VIEW = ['stu.student_pauses.view'];
const ALL = [...VIEW, 'stu.student_pauses.create', 'stu.student_pauses.edit', 'stu.students.view', 'aca.classes.view'];

function pause(id: string, status: PauseStatus, over: Partial<Pause> = {}): Pause {
  return {
    id, student: { id: `s-${id}`, name: `Child ${id}`, registrationCode: `R-000${id}` }, className: 'Class 5', sectionName: 'A', yearName: '2026-27', pausedFrom: '2026-11-10', days: status === 'cancelled' ? null : 12,
    expectedBack: '2026-12-15', overdue: false, reason: 'illness', reasonNote: null, status, endedOn: status === 'ended' ? '2026-11-22' : null, closeNote: null,
    figures: { owed: { status: 'not_tracked', note: 'Fee dues are not tracked yet' }, missed: { status: 'not_tracked', note: 'Attendance is not tracked yet' } },
    createdAt: '2026-11-10T04:00:00Z', updatedAt: '2026-11-10T04:00:00Z', ...over,
  };
}
const ACTIVE = pause('1', 'active');
const OVERDUE = pause('2', 'active', { overdue: true, expectedBack: '2026-11-15', reason: 'other', reasonNote: 'Family is abroad' });
const ENDED = pause('3', 'ended');
const CANCELLED = pause('4', 'cancelled');
const ROWS = [ACTIVE, OVERDUE, ENDED, CANCELLED];

type Call = { method: string; path: string; body?: Record<string, unknown> };
type Handler = (path: string, method: string, body: Record<string, unknown> | undefined, url: URL) => { status: number; body?: unknown } | undefined;

function mount(path: string, permissions: string[], handler: Handler = () => undefined, rows: Pause[] = ROWS) {
  const calls: Call[] = [];
  const json = (status: number, body?: unknown) => new Response(JSON.stringify(body ?? {}), { status, headers: { 'Content-Type': 'application/json' } });
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
        workspace: { home: 'x', navigation: [{ screenId: 'student_pauses', label: 'Pauses', order: 47 }] }, mobile: { tabs: [], features: [] }, approvals: { canApprove: [] }, version: 1,
      });
    const custom = handler(p, method, body, url);
    if (custom) return json(custom.status, custom.body);
    if (p === '/student-pauses' && method === 'GET') return json(200, { items: rows, page: { number: 1, size: 25, total: rows.length } });
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

const isCreate = (c: Call) => c.method === 'POST' && c.path === '/student-pauses';

describe('the pauses screen is registered', () => {
  it('has a web path, a phone route, an icon and the permission the server uses', () => {
    expect(registry.student_pauses).toMatchObject({ module: 'stu', permission: 'stu.student_pauses.view', parity: 'Companion', web: { path: '/student-pauses' }, mobile: { route: '/student-pauses' } });
    expect(NAV_ICONS.student_pauses).toBeDefined();
  });
});

describe('what each status allows', () => {
  it('lets an editor change, end and cancel only an active pause', () => {
    expect(allowedActions({ status: 'active' }, { view: true, edit: true })).toEqual(['view', 'edit', 'end', 'cancel']);
    expect(allowedActions({ status: 'ended' }, { view: true, edit: true })).toEqual(['view']);
    expect(allowedActions({ status: 'cancelled' }, { view: true, edit: true })).toEqual(['view']);
  });
  it('gives a view-only person no change controls, and nobody anything without view', () => {
    expect(allowedActions({ status: 'active' }, { view: true, edit: false })).toEqual(['view']);
    expect(allowedActions({ status: 'active' }, { view: false, edit: true })).toEqual([]);
  });
});

describe('forms, requests and wording', () => {
  const now = new Date('2026-11-23T05:00:00Z');
  const base = { ...blankPauseForm(now), studentId: 's1', reason: 'illness' as const };
  it('checks the rules the person can fix before sending', () => {
    expect(validatePauseForm(base, 'create', undefined, now)).toEqual({});
    expect(validatePauseForm({ ...base, studentId: '' }, 'create', undefined, now).studentId).toBeDefined();
    expect(validatePauseForm({ ...base, reason: '' }, 'create', undefined, now).reason).toBe('Choose a reason.');
    expect(validatePauseForm({ ...base, reason: 'other' }, 'create', undefined, now).reasonNote).toBe('Tell us the reason when you choose Other.');
    expect(validatePauseForm({ ...base, reason: 'other', reasonNote: 'Wedding' }, 'create', undefined, now)).toEqual({});
    expect(validatePauseForm({ ...base, reasonNote: 'x'.repeat(1001) }, 'create', undefined, now).reasonNote).toMatch(/1000/);
    expect(validatePauseForm({ ...base, pausedFrom: '2999-01-01' }, 'create', undefined, now).pausedFrom).toMatch(/future/);
    expect(validatePauseForm({ ...base, expectedBack: '2026-11-01' }, 'create', undefined, now).expectedBack).toMatch(/before the pause starts/);
  });
  it('editing does not ask for the student or the start again and checks the date against the original start', () => {
    expect(validatePauseForm({ ...formFromPause(ACTIVE), studentId: '', pausedFrom: '' }, 'edit', ACTIVE.pausedFrom, now)).toEqual({});
    expect(validatePauseForm({ ...formFromPause(ACTIVE), expectedBack: '2026-11-01' }, 'edit', ACTIVE.pausedFrom, now).expectedBack).toBeDefined();
  });
  it('sends blank optional values as null and leaves the student and start out of a change', () => {
    const f = { ...base, expectedBack: '2026-12-01', reasonNote: ' fever ' };
    expect(buildCreateBody(f)).toEqual({ studentId: 's1', pausedFrom: '2026-11-23', expectedBack: '2026-12-01', reason: 'illness', reasonNote: 'fever' });
    expect(buildCreateBody(base)).toMatchObject({ expectedBack: null, reasonNote: null });
    expect(buildUpdateBody(f)).toEqual({ expectedBack: '2026-12-01', reason: 'illness', reasonNote: 'fever' });
  });
  it('builds the list query without empty filters and words the days', () => {
    expect(buildListQuery({})).toBe('page=1&pageSize=25');
    expect(buildListQuery({ page: 2, sort: '-from', search: ' rao ', status: 'active', classId: 'c1' })).toBe('page=2&pageSize=25&sort=-from&q=rao&status=active&classId=c1');
    expect([daysLabel(null), daysLabel(0), daysLabel(1), daysLabel(12)]).toEqual(['—', 'Today', '1 day', '12 days']);
  });
  it('reads failures into plain words and fields', async () => {
    const res = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
    expect((await readFailure(res(400, { code: 'validation_failed', errors: [{ field: 'studentId', message: 'Only an active student can be paused. This student is alumni.' }, { field: 'studentId', message: 'second' }] }))).fields).toEqual({ studentId: 'Only an active student can be paused. This student is alumni.' });
    expect((await readFailure(res(409, { code: 'already_paused', detail: 'raw' }))).message).toMatch(/already has an active pause/);
    expect((await readFailure(res(409, { code: 'not_active', detail: 'raw' }))).message).toMatch(/already ended or been cancelled/);
    expect((await readFailure(res(403, { code: 'read_only_visit' }))).message).toMatch(/support visit/);
    expect((await readFailure(res(404, {}))).message).toMatch(/no longer exists/);
  });
});

describe('the list', () => {
  it('shows every pause with its status, days and the actions that fit it', async () => {
    mount('/student-pauses', ALL);
    expect(await screen.findByText('Child 1')).toBeInTheDocument();
    for (const label of ['Paused now', 'Back', 'Cancelled']) expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    expect(screen.getAllByText('12 days').length).toBeGreaterThan(0);
    expect(screen.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit pause of Child 1 (R-0001)' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark Child 1 (R-0001) back' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel pause of Child 2 (R-0002)' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Edit pause of Child 3|Mark Child 3|Cancel pause of Child 3|Mark Child 4/ })).toBeNull();
    expect(screen.getByText('Reason'));
  });

  it('a view-only person sees no way to pause, edit, end or cancel', async () => {
    mount('/student-pauses', VIEW);
    await screen.findByText('Child 1');
    expect(screen.queryByRole('button', { name: 'Pause a student' })).toBeNull();
    expect(screen.queryByRole('button', { name: /^(Edit|Mark|Cancel)/ })).toBeNull();
    expect(screen.getAllByRole('button', { name: /^View pause of / })).toHaveLength(4);
  });

  it('shows the screen as unavailable to someone without the view permission', async () => {
    mount('/student-pauses', ['stu.students.view']);
    expect(await screen.findByText('Not available')).toBeInTheDocument();
  });

  it('asks the server for the filters and the sort the person chose', async () => {
    const calls = mount('/student-pauses', ALL);
    await screen.findByText('Child 1');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'ended');
    await waitFor(() => expect(calls.some((c) => c.path.includes('status=ended'))).toBe(true));
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Class' }), 'c1');
    await waitFor(() => expect(calls.some((c) => c.path.includes('classId=c1'))).toBe(true));
    await userEvent.click(screen.getByRole('button', { name: 'Student' }));
    await waitFor(() => expect(calls.some((c) => c.path.includes('sort=student'))).toBe(true));
    expect(calls.find((c) => c.path.startsWith('/student-pauses'))!.path).toContain('sort=-from');
  });

  it('says so when there are no pauses and when the list cannot load', async () => {
    mount('/student-pauses', ALL, undefined, []);
    expect(await screen.findByText(/No pauses yet\./)).toBeInTheDocument();
  });

  it('shows an error with a way to try again', async () => {
    let fail = true;
    mount('/student-pauses', ALL, (p, m) => (p === '/student-pauses' && m === 'GET' && fail ? { status: 500, body: { detail: 'The list could not be loaded.' } } : undefined));
    expect(await screen.findByRole('alert')).toHaveTextContent('The list could not be loaded.');
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Child 1')).toBeInTheDocument();
  });
});

describe('pausing a student', () => {
  async function openSheet() {
    await screen.findByText('Child 1');
    await userEvent.click(screen.getByRole('button', { name: 'Pause a student' }));
    return screen.findByRole('dialog', { name: 'Pause a student' });
  }
  async function chooseStudent(sheet: ReturnType<typeof within>) {
    const results = sheet.getByRole('combobox', { name: 'Student results' });
    await waitFor(() => expect(within(results).getByRole('option', { name: /Asha Rao \(R-0100\)/ })).toBeInTheDocument());
    await userEvent.selectOptions(results, 'st1');
  }

  it('searches the student and sends the pause', async () => {
    const calls = mount('/student-pauses', ALL, (p, m) => (p === '/student-pauses' && m === 'POST' ? { status: 201, body: pause('9', 'active') } : undefined));
    const sheet = within(await openSheet());
    await chooseStudent(sheet);
    await userEvent.selectOptions(sheet.getByRole('combobox', { name: 'Reason *' }), 'illness');
    await userEvent.type(sheet.getByLabelText('Expected back'), '2099-01-05');
    await userEvent.click(sheet.getByRole('button', { name: 'Pause student' }));
    await waitFor(() => expect(calls.some(isCreate)).toBe(true));
    expect(calls.find(isCreate)!.body).toMatchObject({ studentId: 'st1', reason: 'illness', expectedBack: '2099-01-05', reasonNote: null });
    expect(calls.find(isCreate)!.body!.pausedFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Pause a student' })).toBeNull());
  });

  it('asks for a note when the reason is Other and does not send until it is there', async () => {
    const calls = mount('/student-pauses', ALL, (p, m) => (p === '/student-pauses' && m === 'POST' ? { status: 201, body: pause('9', 'active') } : undefined));
    const sheet = within(await openSheet());
    await chooseStudent(sheet);
    await userEvent.selectOptions(sheet.getByRole('combobox', { name: 'Reason *' }), 'other');
    await userEvent.click(sheet.getByRole('button', { name: 'Pause student' }));
    expect(await sheet.findByText('Tell us the reason when you choose Other.')).toBeInTheDocument();
    expect(calls.some(isCreate)).toBe(false);
    await userEvent.type(sheet.getByLabelText('Note *'), 'Wedding');
    expect(sheet.getByTestId('note-counter')).toHaveTextContent('7/1000');
    await userEvent.click(sheet.getByRole('button', { name: 'Pause student' }));
    await waitFor(() => expect(calls.some(isCreate)).toBe(true));
  });

  it('explains a conflict in plain words and keeps the form open', async () => {
    mount('/student-pauses', ALL, (p, m) => (p === '/student-pauses' && m === 'POST' ? { status: 409, body: { code: 'already_paused', detail: 'x' } } : undefined));
    const sheet = within(await openSheet());
    await chooseStudent(sheet);
    await userEvent.selectOptions(sheet.getByRole('combobox', { name: 'Reason *' }), 'illness');
    await userEvent.click(sheet.getByRole('button', { name: 'Pause student' }));
    expect(await sheet.findByRole('alert')).toHaveTextContent('already has an active pause');
    expect(screen.getByRole('dialog', { name: 'Pause a student' })).toBeInTheDocument();
  });

  it('puts the server’s field problems on their fields', async () => {
    mount('/student-pauses', ALL, (p, m) => (p === '/student-pauses' && m === 'POST' ? { status: 400, body: { code: 'validation_failed', errors: [{ field: 'pausedFrom', message: 'Not before the admission date.' }] } } : undefined));
    const sheet = within(await openSheet());
    await chooseStudent(sheet);
    await userEvent.selectOptions(sheet.getByRole('combobox', { name: 'Reason *' }), 'illness');
    await userEvent.click(sheet.getByRole('button', { name: 'Pause student' }));
    expect(await sheet.findByText('Not before the admission date.')).toBeInTheDocument();
  });

  it('tells someone who cannot view students why they cannot pick one', async () => {
    mount('/student-pauses', ['stu.student_pauses.view', 'stu.student_pauses.create']);
    const sheet = within(await openSheet());
    expect(sheet.getByText(/You need permission to view students/)).toBeInTheDocument();
    expect(sheet.getByRole('button', { name: 'Pause student' })).toBeDisabled();
  });
});

describe('editing, ending and cancelling', () => {
  it('edits only the expected date, reason and note: the student is fixed', async () => {
    const calls = mount('/student-pauses', ALL, (p, m) => (p === '/student-pauses/1' && m === 'PUT' ? { status: 200, body: { ...ACTIVE, reason: 'financial' } } : undefined));
    await screen.findByText('Child 1');
    await userEvent.click(screen.getByRole('button', { name: 'Edit pause of Child 1 (R-0001)' }));
    const sheet = within(await screen.findByRole('dialog', { name: 'Edit pause' }));
    expect(sheet.getByTestId('fixed-student')).toHaveTextContent('Child 1');
    expect(sheet.queryByText('Student')).toBeNull();
    expect(sheet.queryByLabelText('Paused from *')).toBeNull();
    await userEvent.selectOptions(sheet.getByRole('combobox', { name: 'Reason *' }), 'financial');
    await userEvent.click(sheet.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'PUT')).toBe(true));
    expect(calls.find((c) => c.method === 'PUT')!.body).toEqual({ expectedBack: '2026-12-15', reason: 'financial', reasonNote: null });
  });

  it('marks a student back on a chosen day with a note', async () => {
    const calls = mount('/student-pauses', ALL, (p, m) => (p === '/student-pauses/1/end' && m === 'POST' ? { status: 200, body: { ...ACTIVE, status: 'ended', endedOn: '2026-11-20' } } : undefined));
    await screen.findByText('Child 1');
    await userEvent.click(screen.getByRole('button', { name: 'Mark Child 1 (R-0001) back' }));
    const dialog = within(await screen.findByRole('alertdialog'));
    expect(dialog.getByText(/becomes/)).toHaveTextContent('active');
    await userEvent.clear(dialog.getByLabelText('Came back on'));
    await userEvent.type(dialog.getByLabelText('Came back on'), '2026-11-20');
    await userEvent.type(dialog.getByLabelText('Note (optional)'), 'Recovered');
    await userEvent.click(dialog.getByRole('button', { name: 'Mark back' }));
    await waitFor(() => expect(calls.some((c) => c.path === '/student-pauses/1/end')).toBe(true));
    expect(calls.find((c) => c.path === '/student-pauses/1/end')!.body).toEqual({ endedOn: '2026-11-20', note: 'Recovered' });
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
  });

  it('will not send a back date before the pause began', async () => {
    const calls = mount('/student-pauses', ALL);
    await screen.findByText('Child 1');
    await userEvent.click(screen.getByRole('button', { name: 'Mark Child 1 (R-0001) back' }));
    const dialog = within(await screen.findByRole('alertdialog'));
    await userEvent.clear(dialog.getByLabelText('Came back on'));
    await userEvent.type(dialog.getByLabelText('Came back on'), '2026-11-01');
    await userEvent.click(dialog.getByRole('button', { name: 'Mark back' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('before the pause began');
    expect(calls.some((c) => c.path.endsWith('/end'))).toBe(false);
  });

  it('cancels a pause, and shows what is true when someone else already closed it', async () => {
    const calls = mount('/student-pauses', ALL, (p, m) => (p === '/student-pauses/2/cancel' && m === 'POST' ? { status: 409, body: { code: 'not_active', detail: 'x' } } : undefined));
    await screen.findByText('Child 2');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel pause of Child 2 (R-0002)' }));
    const dialog = within(await screen.findByRole('alertdialog'));
    await userEvent.click(dialog.getByRole('button', { name: 'Cancel pause' }));
    expect(await dialog.findByRole('alert')).toHaveTextContent('already ended or been cancelled');
    expect(calls.filter((c) => c.method === 'GET' && c.path.startsWith('/student-pauses')).length).toBeGreaterThan(1);
  });

  it('opens the detail with the figures that are not tracked yet, and the overdue flag', async () => {
    mount('/student-pauses', ALL);
    await screen.findByText('Child 2');
    await userEvent.click(screen.getByRole('button', { name: 'View pause of Child 2 (R-0002)' }));
    const detail = within(await screen.findByTestId('pause-detail'));
    expect(detail.getByText('Past the expected date')).toBeInTheDocument();
    expect(detail.getByText('Family is abroad')).toBeInTheDocument();
    expect(detail.getAllByText('Not tracked yet')).toHaveLength(2);
    expect(detail.getByText('Owed when paused')).toBeInTheDocument();
    expect(detail.getByRole('button', { name: 'Mark back' })).toBeInTheDocument();
  });
});
