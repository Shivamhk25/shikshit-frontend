import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebSession } from '../../shell/web-session';
import { ShellApp } from '../../shell/ShellApp';
import { NAV_ICONS } from '../../shell/navIcons';
import { registry } from '../../shell/registry';
import { buildListQuery, changedRosterRows, limitNote, readFailure, rosterSummary, toggleSubject, type StudentElective, type StudentElectiveChange } from './electives';

const MATHS = { id: 'm', code: 'MAT', name: 'Mathematics' };
const BIO = { id: 'b', code: 'BIO', name: 'Biology' };
const CS = { id: 'c', code: 'CS', name: 'Computer Science' };
const GROUP = { id: 'g1', name: 'Stream subjects', code: null, minSubjects: 1, maxSubjects: 2, enforceLimits: true };

const choice: StudentElective = {
  id: 'e1', student: { id: 's1', name: 'Asha Rao', registrationCode: 'R-0001' }, yearId: 'y1', yearName: '2026-27', classId: 'c11', className: 'Class 11', sectionId: 'sa', sectionName: 'A',
  group: GROUP, subjects: [MATHS], offered: [MATHS, BIO, CS], status: 'chosen', withinLimits: true, warnings: [], createdAt: '2026-11-01T04:00:00Z', updatedAt: '2026-11-01T04:00:00Z',
};
const change: StudentElectiveChange = {
  id: 'ch1', student: choice.student, yearId: 'y1', yearName: '2026-27', className: 'Class 11', sectionName: 'A', group: { id: 'g1', name: 'Stream subjects' }, choiceId: 'e1', fromSubject: MATHS, toSubject: BIO,
  wantedFrom: '2026-12-01', reason: 'Wants to study medicine', status: 'requested', approvalRequestId: 'ap-1', requestedBy: { id: 'u1', name: 'Teacher' }, decision: null, cancelledAt: null,
  createdAt: '2026-11-20T04:00:00Z', updatedAt: '2026-11-20T04:00:00Z',
};

type Call = { method: string; path: string; body?: Record<string, unknown> };
type Handler = (path: string, method: string) => { status: number; body?: unknown } | undefined;

function mount(path: string, permissions: string[], handler: Handler = () => undefined) {
  const calls: Call[] = [];
  const json = (status: number, body?: unknown) => (status === 204 ? new Response(null, { status }) : new Response(JSON.stringify(body ?? {}), { status, headers: { 'Content-Type': 'application/json' } }));
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://x');
    const p = url.pathname.replace('/api/v1', '');
    const method = init?.method ?? 'GET';
    calls.push({ method, path: p + url.search, body: init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined });
    if (p === '/auth/refresh') return json(200, { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 9e5).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 9e8).toISOString(), mustChangePassword: false });
    if (p === '/me/access')
      return json(200, {
        user: { id: 'u1', name: 'Asha', tier: 'tenant' }, tenant: { id: 't1', name: 'School', brand: { primary: '#2F5BFF' }, modules: ['stu'] }, permissions, scopes: {}, fieldMasks: {},
        workspace: { home: 'x', navigation: [{ screenId: 'student_electives', label: 'Student electives', order: 49 }] }, mobile: { tabs: [], features: [] }, approvals: { canApprove: [] }, version: 1,
      });
    const custom = handler(p, method);
    if (custom) return json(custom.status, custom.body);
    if (p === '/student-electives' && method === 'GET') return json(200, { items: [choice], page: { number: 1, size: 25, total: 1 } });
    if (p === '/student-electives/e1' && method === 'GET') return json(200, choice);
    if (p === '/student-electives/e1' && method === 'PUT') return json(200, choice);
    if (p === '/student-electives/e1' && method === 'DELETE') return json(204);
    if (p === '/student-elective-changes' && method === 'GET') return json(200, { items: [change], page: { number: 1, size: 25, total: 1 } });
    if (p === '/student-elective-changes' && method === 'POST') return json(201, change);
    if (p === '/student-elective-changes/ch1/cancel') return json(200, { ...change, status: 'cancelled' });
    if (p === '/elective-groups') return json(200, { items: [{ id: 'g1', name: 'Stream subjects' }], page: { number: 1, size: 200, total: 1 } });
    if (p === '/classes') return json(200, { items: [{ id: 'c11', name: 'Class 11' }], page: { number: 1, size: 200, total: 1 } });
    if (p === '/academic-years') return json(200, { items: [{ id: 'y1', name: '2026-27' }], page: { number: 1, size: 200, total: 1 } });
    if (p === '/class-section-mappings') return json(200, { items: [{ classId: 'c11', yearId: 'y1', sectionId: 'sa', sectionName: 'A' }], page: { number: 1, size: 200, total: 1 } });
    if (p === '/student-electives/roster')
      return json(200, { year: { id: 'y1', name: '2026-27' }, class: { id: 'c11', name: 'Class 11' }, section: { id: 'sa', name: 'A' }, group: GROUP, offered: [MATHS, BIO], students: [
        { student: choice.student, rollNumber: '1', choiceId: 'e1', status: 'chosen', subjects: [MATHS], withinLimits: true, warnings: [] },
        { student: { id: 's2', name: 'Kabir Mehta', registrationCode: 'R-0002' }, rollNumber: '2', choiceId: null, status: null, subjects: [], withinLimits: false, warnings: [] },
      ] });
    if (p === '/student-electives/roster' && method === 'PUT') return json(200, { created: 1, updated: 0, removed: 0, unchanged: 1, items: [] });
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

const VIEW = ['stu.student_electives.view'];
const ALL = [...VIEW, 'stu.student_electives.edit', 'stu.student_electives.delete', 'stu.student_elective_approvals.view', 'stu.student_elective_approvals.create', 'stu.student_elective_approvals.edit'];

describe('the electives screens are registered', () => {
  it.each([['student_electives', 'stu.student_electives.view', '/student-electives'], ['student_elective_changes', 'stu.student_elective_approvals.view', '/student-elective-changes']])('%s', (id, permission, path) => {
    expect(registry[id]).toMatchObject({ module: 'stu', permission, web: { path }, mobile: { route: path } });
    expect(NAV_ICONS[id]).toBeDefined();
  });
});

describe('the small rules', () => {
  it('toggles a subject without disturbing the others', () => {
    expect(toggleSubject(['a', 'b'], 'c')).toEqual(['a', 'b', 'c']);
    expect(toggleSubject(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });
  it('says what a limit means, and whether it still saves', () => {
    expect(limitNote(GROUP, 1)).toBe('');
    expect(limitNote(GROUP, 3)).toBe('This group needs 1 to 2 subjects.');
    expect(limitNote({ ...GROUP, enforceLimits: false, minSubjects: 2 }, 1)).toBe('This group expects 2 subjects. It can still be saved.');
  });
  it('sends only the roster rows that changed', () => {
    const students = [
      { student: choice.student, rollNumber: '1', choiceId: 'e1', status: 'chosen' as const, subjects: [MATHS], withinLimits: true, warnings: [] },
      { student: { id: 's2', name: 'K', registrationCode: 'R-2' }, rollNumber: '2', choiceId: null, status: null, subjects: [], withinLimits: false, warnings: [] },
    ];
    expect(changedRosterRows(students, {})).toEqual([]);
    expect(changedRosterRows(students, { s1: ['m'], s2: ['b'] })).toEqual([{ studentId: 's2', subjectIds: ['b'] }]);
    expect(changedRosterRows(students, { s1: [] })).toEqual([{ studentId: 's1', subjectIds: [] }]);
  });
  it('summarises a save', () => {
    expect(rosterSummary({ created: 2, updated: 1, removed: 0, unchanged: 5, items: [] })).toBe('Choices saved: 2 added, 1 changed.');
    expect(rosterSummary({ created: 0, updated: 0, removed: 0, unchanged: 5, items: [] })).toBe('Nothing needed saving.');
  });
  it('builds the list query', () => {
    expect(buildListQuery({ search: ' asha ', status: 'chosen', groupId: 'g1' })).toBe('page=1&pageSize=25&q=asha&status=chosen&groupId=g1');
  });
  it('turns a refusal into words', async () => {
    const e = await readFailure(new Response(JSON.stringify({ code: 'open_change_request' }), { status: 409 }));
    expect(e.message).toBe('A change request for this subject is already waiting for a decision.');
  });
});

describe('the choices list', () => {
  it('lists choices with their subjects and shows the actions the person may use', async () => {
    mount('/student-electives', ALL);
    expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getByText('Mathematics')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit subjects of Asha Rao' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Request a change for Asha Rao' })).toBeInTheDocument();
  });
  it('hides the actions from someone who can only look', async () => {
    mount('/student-electives', VIEW);
    await screen.findByText('Asha Rao');
    expect(screen.queryByRole('button', { name: /^Edit subjects/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Remove choice/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^Request a change/ })).toBeNull();
  });
  it('shows an empty state and an error with a way back', async () => {
    mount('/student-electives', VIEW, (p, m) => (p === '/student-electives' && m === 'GET' ? { status: 200, body: { items: [], page: { number: 1, size: 25, total: 0 } } } : undefined));
    expect(await screen.findByText(/No elective choices yet/)).toBeInTheDocument();
  });
  it('shows an error with Try again', async () => {
    mount('/student-electives', VIEW, (p) => (p === '/student-electives' ? { status: 500, body: { code: 'internal', detail: 'The choices could not be loaded.' } } : undefined));
    expect(await screen.findByText('The choices could not be loaded.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
  it('saves edited subjects with the checked ones only', async () => {
    const user = userEvent.setup();
    const calls = mount('/student-electives', ALL);
    await user.click(await screen.findByRole('button', { name: 'Edit subjects of Asha Rao' }));
    await user.click(await screen.findByRole('checkbox', { name: 'Biology' }));
    await user.click(screen.getByRole('button', { name: 'Save choice' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ subjectIds: ['m', 'b'], status: 'chosen' }));
  });
  it('warns when the number of subjects is outside the group limits', async () => {
    const user = userEvent.setup();
    mount('/student-electives', ALL);
    await user.click(await screen.findByRole('button', { name: 'Edit subjects of Asha Rao' }));
    await user.click(await screen.findByRole('checkbox', { name: 'Biology' }));
    await user.click(screen.getByRole('checkbox', { name: 'Computer Science' }));
    expect(screen.getByText('This group needs 1 to 2 subjects.')).toBeInTheDocument();
  });
  it('asks before removing a choice', async () => {
    const user = userEvent.setup();
    const calls = mount('/student-electives', ALL);
    await user.click(await screen.findByRole('button', { name: 'Remove choice of Asha Rao' }));
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Remove choice' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'DELETE' && c.path === '/student-electives/e1')).toBe(true));
  });
  it('requires a reason, then sends the change request', async () => {
    const user = userEvent.setup();
    const calls = mount('/student-electives', ALL);
    await user.click(await screen.findByRole('button', { name: 'Request a change for Asha Rao' }));
    const d = await screen.findByRole('dialog', { name: 'Request a subject change' });
    await user.click(within(d).getByRole('button', { name: 'Send request' }));
    expect(await within(d).findByText('Give a reason for the change.')).toBeInTheDocument();
    expect(calls.some((c) => c.path === '/student-elective-changes' && c.method === 'POST')).toBe(false);
    await user.selectOptions(within(d).getByLabelText('Drop'), 'm');
    await user.selectOptions(await within(d).findByLabelText('Take instead'), 'b');
    await user.type(within(d).getByLabelText('Reason *'), 'Wants medicine');
    await user.click(within(d).getByRole('button', { name: 'Send request' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'POST' && c.path === '/student-elective-changes')?.body).toMatchObject({ choiceId: 'e1', fromSubjectId: 'm', toSubjectId: 'b', reason: 'Wants medicine' }));
  });
});

describe('the class roster', () => {
  it('shows a class section and saves only the rows that changed', async () => {
    const user = userEvent.setup();
    const calls = mount('/student-electives', ALL);
    await user.click(await screen.findByRole('tab', { name: 'Class roster' }));
    await user.selectOptions(await screen.findByLabelText('Academic year'), 'y1');
    await user.selectOptions(screen.getByLabelText('Class'), 'c11');
    await user.selectOptions(await screen.findByRole('combobox', { name: 'Section' }), 'sa');
    await user.selectOptions(screen.getByLabelText('Elective group'), 'g1');
    await user.click(screen.getByRole('button', { name: 'Show students' }));
    await user.click(await screen.findByRole('checkbox', { name: 'Biology for Kabir Mehta' }));
    await user.click(screen.getByRole('button', { name: 'Save 1 change' }));
    await waitFor(() => expect(calls.find((c) => c.method === 'PUT' && c.path === '/student-electives/roster')?.body).toMatchObject({ groupId: 'g1', rows: [{ studentId: 's2', subjectIds: ['b'] }] }));
  });
});

describe('the change requests list', () => {
  it('lists requests and links to the approval', async () => {
    mount('/student-elective-changes', ALL);
    expect(await screen.findByText('Wants to study medicine')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the approval for Asha Rao' })).toHaveAttribute('href', '/approvals?id=ap-1');
  });
  it('cancels a waiting request after asking', async () => {
    const user = userEvent.setup();
    const calls = mount('/student-elective-changes', ALL);
    await user.click(await screen.findByRole('button', { name: 'Cancel the request for Asha Rao' }));
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel request' }));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST' && c.path === '/student-elective-changes/ch1/cancel')).toBe(true));
  });
  it('does not offer cancel to someone who cannot edit requests', async () => {
    mount('/student-elective-changes', ['stu.student_elective_approvals.view']);
    await screen.findByText('Wants to study medicine');
    expect(screen.queryByRole('button', { name: /^Cancel the request/ })).toBeNull();
  });
  it('shows an empty state', async () => {
    mount('/student-elective-changes', ALL, (p, m) => (p === '/student-elective-changes' && m === 'GET' ? { status: 200, body: { items: [], page: { number: 1, size: 25, total: 0 } } } : undefined));
    expect(await screen.findByText(/No change requests yet/)).toBeInTheDocument();
  });
});
