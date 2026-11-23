import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebSession } from '../../shell/web-session';
import { ShellApp } from '../../shell/ShellApp';
import { NAV_ICONS } from '../../shell/navIcons';
import { registry } from '../../shell/registry';
import { buildListQuery, exitNote, lastClassLine, type Alumnus } from './alumni';

const VIEW = ['stu.alumni.view'];
const ALL = [...VIEW, 'aca.classes.view', 'aca.academic_years.view'];

function alumnus(id: string, over: Partial<Alumnus> = {}): Alumnus {
  return {
    id, name: `Former ${id}`, registrationCode: `R-000${id}`, admissionDate: '2018-04-02', lastClassName: 'Class 8', lastSectionName: 'A', yearName: '2025-26', reason: 'graduated', reasonLabel: 'Graduated',
    exitDate: '2026-03-31', tcNumber: null, destinationSchool: null, lastAttendanceDate: null, ...over,
  };
}
const GRAD = alumnus('1');
const MOVED = alumnus('2', { reason: 'transferred', reasonLabel: 'Transferred', lastClassName: 'Class 5', exitDate: '2026-03-12', tcNumber: 'TC-000012', destinationSchool: 'Pune Public School', lastAttendanceDate: '2026-03-10' });
const HAND = alumnus('3', { reason: 'other', reasonLabel: 'Other', exitDate: null, lastClassName: null, lastSectionName: null, yearName: null });
const ROWS = [GRAD, MOVED, HAND];

type Call = { method: string; path: string };

function mount(path: string, permissions: string[], handler: (p: string) => { status: number; body?: unknown } | undefined = () => undefined, rows: Alumnus[] = ROWS) {
  const calls: Call[] = [];
  const json = (status: number, body?: unknown) => new Response(JSON.stringify(body ?? {}), { status, headers: { 'Content-Type': 'application/json' } });
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://x');
    const p = url.pathname.replace('/api/v1', '');
    calls.push({ method: init?.method ?? 'GET', path: p + url.search });
    if (p === '/auth/refresh') return json(200, { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 9e5).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 9e8).toISOString(), mustChangePassword: false });
    if (p === '/me/access')
      return json(200, {
        user: { id: 'u1', name: 'Asha', tier: 'tenant' }, tenant: { id: 't1', name: 'School', brand: { primary: '#2F5BFF' }, modules: ['stu'] }, permissions, scopes: {}, fieldMasks: {},
        workspace: { home: 'x', navigation: [{ screenId: 'alumni', label: 'Alumni', order: 48 }] }, mobile: { tabs: [], features: [] }, approvals: { canApprove: [] }, version: 1,
      });
    const custom = handler(p);
    if (custom) return json(custom.status, custom.body);
    if (p === '/alumni') return json(200, { items: rows, page: { number: 1, size: 25, total: rows.length } });
    if (p === '/classes') return json(200, { items: [{ id: 'c8', name: 'Class 8' }], page: { number: 1, size: 200, total: 1 } });
    if (p === '/academic-years') return json(200, { items: [{ id: 'y1', name: '2025-26' }], page: { number: 1, size: 200, total: 1 } });
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

describe('the alumni screen is registered', () => {
  it('has a web path, a phone route, an icon and the permission the server uses', () => {
    expect(registry.alumni).toMatchObject({ module: 'stu', permission: 'stu.alumni.view', parity: 'Companion', web: { path: '/alumni' }, mobile: { route: '/alumni' } });
    expect(NAV_ICONS.alumni).toBeDefined();
  });
});

describe('wording and requests', () => {
  it('builds the list query without empty filters', () => {
    expect(buildListQuery({})).toBe('page=1&pageSize=25');
    expect(buildListQuery({ page: 2, sort: 'exit', search: ' rao ', reason: 'graduated', classId: 'c8', yearId: 'y1' })).toBe('page=2&pageSize=25&sort=exit&q=rao&reason=graduated&classId=c8&yearId=y1');
  });
  it('words the last class and explains where the exit date comes from', () => {
    expect(lastClassLine(GRAD)).toBe('Class 8\u00a0·\u00a0A');
    expect(lastClassLine(HAND)).toBe('—');
    expect(exitNote(GRAD)).toMatch(/promotion was committed/);
    expect(exitNote(MOVED)).toMatch(/transfer certificate/);
    expect(exitNote(HAND)).toMatch(/not known/);
  });
});

describe('the list', () => {
  it('shows each former student with why and when they left, and says so when the date is unknown', async () => {
    mount('/alumni', ALL);
    expect(await screen.findByText('Former 1')).toBeInTheDocument();
    for (const label of ['Graduated', 'Transferred', 'Other']) expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    expect(screen.getByText('Not recorded')).toBeInTheDocument();
    expect(screen.getAllByText('2025-26').length).toBeGreaterThan(0);
    // nothing on this screen changes anything
    expect(screen.queryByRole('button', { name: /^(Add|Edit|Delete|Remove|Create)/ })).toBeNull();
    expect(screen.getAllByRole('button', { name: /^View details of / })).toHaveLength(3);
  });

  it('shows the screen as unavailable to someone without the view permission', async () => {
    mount('/alumni', ['stu.students.view']);
    expect(await screen.findByText('Not available')).toBeInTheDocument();
  });

  it('asks the server for the filters and the sort the person chose', async () => {
    const calls = mount('/alumni', ALL);
    await screen.findByText('Former 1');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Reason' }), 'transferred');
    await waitFor(() => expect(calls.some((c) => c.path.includes('reason=transferred'))).toBe(true));
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Last class' }), 'c8');
    await waitFor(() => expect(calls.some((c) => c.path.includes('classId=c8'))).toBe(true));
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Year' }), 'y1');
    await waitFor(() => expect(calls.some((c) => c.path.includes('yearId=y1'))).toBe(true));
    await userEvent.click(screen.getByRole('button', { name: 'Student' }));
    await waitFor(() => expect(calls.some((c) => c.path.includes('sort=student'))).toBe(true));
    expect(calls.find((c) => c.path.startsWith('/alumni'))!.path).toContain('sort=-exit');
  });

  it('hides the class and year filters when the person may not read them', async () => {
    mount('/alumni', VIEW, (p) => (p === '/classes' || p === '/academic-years' ? { status: 403, body: { code: 'permission_denied' } } : undefined));
    await screen.findByText('Former 1');
    expect(screen.queryByRole('combobox', { name: 'Last class' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Year' })).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Reason' })).toBeInTheDocument();
  });

  it('says so when there is nobody, and shows an error with a way to try again', async () => {
    mount('/alumni', ALL, undefined, []);
    expect(await screen.findByText(/No alumni yet/)).toBeInTheDocument();
  });

  it('retries after an error', async () => {
    let fail = true;
    mount('/alumni', ALL, (p) => (p === '/alumni' && fail ? { status: 500, body: { detail: 'The list could not be loaded.' } } : undefined));
    expect(await screen.findByRole('alert')).toHaveTextContent('The list could not be loaded.');
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Former 1')).toBeInTheDocument();
  });
});

describe('the detail', () => {
  it('shows the transfer certificate details of a transferred student', async () => {
    mount('/alumni', ALL);
    await screen.findByText('Former 2');
    await userEvent.click(screen.getByRole('button', { name: 'View details of Former 2 (R-0002)' }));
    const detail = within(await screen.findByTestId('alumni-detail'));
    expect(detail.getByText('TC-000012')).toBeInTheDocument();
    expect(detail.getByText('Pune Public School')).toBeInTheDocument();
    expect(detail.getByText('The date on the transfer certificate.')).toBeInTheDocument();
    expect(detail.getByText(/read-only/)).toBeInTheDocument();
  });

  it('does not show certificate rows for a graduate, and explains an unknown exit date', async () => {
    mount('/alumni', ALL);
    await screen.findByText('Former 1');
    await userEvent.click(screen.getByRole('button', { name: 'View details of Former 1 (R-0001)' }));
    let detail = within(await screen.findByTestId('alumni-detail'));
    expect(detail.queryByText('TC number')).toBeNull();
    expect(detail.getByText('The day the promotion was committed.')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('alumni-detail')).toBeNull());
    await userEvent.click(screen.getByRole('button', { name: 'View details of Former 3 (R-0003)' }));
    detail = within(await screen.findByTestId('alumni-detail'));
    expect(detail.getByText('Not recorded')).toBeInTheDocument();
    expect(detail.getByText(/date is not known/)).toBeInTheDocument();
  });
});
