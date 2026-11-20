import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { blankValues } from '../../crud/descriptor';
import { ShellApp } from '../../shell/ShellApp';
import { createWebSession } from '../../shell/web-session';
import { classesDescriptor, formatDate, sectionsDescriptor, subjectsDescriptor, termsDescriptor, yearsDescriptor } from './structure';

describe('descriptors', () => {
  it('formats dates without a timezone shift', () => {
    expect(formatDate('2026-04-01')).toBe('1 Apr 2026');
    expect(formatDate('2027-03-31')).toBe('31 Mar 2027');
    expect(formatDate('garbage')).toBe('garbage');
  });

  it('every form field has a value to start from, and blank input becomes null for optional fields', () => {
    for (const d of [yearsDescriptor, termsDescriptor, classesDescriptor, sectionsDescriptor, subjectsDescriptor]) {
      const blank = blankValues(d.fields);
      expect(Object.keys(blank).sort()).toEqual(d.fields.map((f) => f.key).sort());
    }
    expect(classesDescriptor.toInput({ ...blankValues(classesDescriptor.fields), code: 'V', name: 'Five' })).toMatchObject({ youngestAgeMonths: null, oldestAgeMonths: null, description: null });
    expect(sectionsDescriptor.toInput({ ...blankValues(sectionsDescriptor.fields), code: 'A', name: 'A', shortName: '  ' })).toMatchObject({ shortName: null });
  });

  it('subjects keep half credits and checkboxes as booleans', () => {
    const v = { ...blankValues(subjectsDescriptor.fields), code: 'M', name: 'Maths', category: 'Core', area: 'Academic', credits: '3.5', scholastic: true };
    expect(subjectsDescriptor.toInput(v)).toMatchObject({ credits: 3.5, scholastic: true, coScholastic: false, nonScholastic: false });
  });

  it('editing a row and saving it unchanged sends the same values back', () => {
    const row = { id: '1', yearId: 'y1', yearName: 'Y', code: 'T1', title: 'Term 1', startDate: '2026-04-01', endDate: '2026-09-30', days: 183, color: '#2F5BFF' };
    expect(termsDescriptor.toInput(termsDescriptor.toForm(row))).toEqual({ yearId: 'y1', code: 'T1', title: 'Term 1', startDate: '2026-04-01', endDate: '2026-09-30', color: '#2F5BFF' });
  });
});

const YEARS = [
  { id: 'y1', code: '2026-27', name: '2026-27', startDate: '2026-04-01', endDate: '2027-03-31', isCurrent: true, remarks: null, status: 'active' },
  { id: 'y2', code: '2027-28', name: '2027-28', startDate: '2027-04-01', endDate: '2028-03-31', isCurrent: false, remarks: null, status: 'active' },
];

function fakeServer(permissions: string[]) {
  const terms: Record<string, unknown>[] = [];
  const calls: { method: string; path: string; body?: Record<string, unknown> }[] = [];
  const json = (status: number, body: unknown, h: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...h } });
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://x');
    const path = url.pathname.replace('/api/v1', '');
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    calls.push({ method, path: path + url.search, body });
    if (path === '/auth/refresh') return json(200, { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 9e5).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 9e8).toISOString(), mustChangePassword: false });
    if (path === '/me/access') {
      return json(200, {
        user: { id: 'u1', name: 'Asha', tier: 'tenant' }, tenant: { id: 't', name: 'School', brand: { primary: '#2F5BFF' }, modules: ['aca'] }, permissions, scopes: {}, fieldMasks: {},
        workspace: { home: 'x', navigation: [{ screenId: 'home', label: 'Home', order: 1 }, { screenId: 'academic_years', label: 'Academic years', order: 2 }, { screenId: 'academic_terms', label: 'Terms', order: 3 }] },
        mobile: { tabs: [], features: [] }, approvals: { canApprove: [] }, version: 1,
      }, { 'X-Access-Version': '1' });
    }
    if (path === '/academic-years' && method === 'GET') return json(200, { items: YEARS, page: { number: 1, size: 200, total: YEARS.length } });
    if (path === '/academic-years/y1' && method === 'DELETE') return json(409, { code: 'in_use', status: 409, detail: 'This is the current academic year. Make another year current first.' });
    if (path === '/academic-terms' && method === 'GET') return json(200, { items: terms, page: { number: 1, size: 25, total: terms.length } });
    if (path === '/academic-terms' && method === 'POST') {
      if (String(body?.endDate) > '2027-03-31') return json(400, { code: 'validation_failed', status: 400, errors: [{ field: 'startDate', code: 'outside_year', message: 'Term dates must lie inside the academic year (2026-04-01 to 2027-03-31).' }] });
      terms.push({ id: 't1', yearName: '2026-27', days: 30, color: null, ...body });
      return json(201, terms[0]);
    }
    return json(404, {});
  }) as typeof fetch;
  return { fetchFn, calls };
}

function mount(path: string, permissions: string[]) {
  const server = fakeServer(permissions);
  render(
    <MemoryRouter initialEntries={[path]}>
      <ShellApp session={createWebSession(server.fetchFn)} />
    </MemoryRouter>,
  );
  return server;
}

describe('academic structure pages', () => {
  it('lists academic years with readable dates and marks the current one', async () => {
    mount('/academic-years', ['aca.academic_years.view']);
    expect(await screen.findByText('1 Apr 2026')).toBeInTheDocument();
    expect(screen.getByText('31 Mar 2027')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Current' })).toBeInTheDocument();
  });

  it('shows the server reason when a year cannot be deleted', async () => {
    mount('/academic-years', ['aca.academic_years.view', 'aca.academic_years.delete']);
    await userEvent.click(await screen.findByRole('button', { name: 'Delete 2026-27' }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(await within(dialog).findByText('This is the current academic year. Make another year current first.')).toBeInTheDocument();
  });

  it('a term form offers the academic years from the server and reports date errors beside the field', async () => {
    const server = mount('/academic-terms', ['aca.academic_terms.view', 'aca.academic_terms.create']);
    await userEvent.click(await screen.findByRole('button', { name: 'Add term' }));
    const sheet = await screen.findByRole('dialog', { name: 'Add term' });

    const year = await within(sheet).findByLabelText('Academic year *');
    expect(await within(sheet).findByRole('option', { name: '2027-28' })).toBeInTheDocument();
    await userEvent.selectOptions(year, 'y1');
    await userEvent.type(within(sheet).getByLabelText('Code *'), 'T1');
    await userEvent.type(within(sheet).getByLabelText('Title *'), 'Term 1');
    await userEvent.type(within(sheet).getByLabelText('Start date *'), '2026-04-01');
    await userEvent.type(within(sheet).getByLabelText('End date *'), '2027-06-01');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(await within(sheet).findByText(/must lie inside the academic year/)).toBeInTheDocument();

    await userEvent.clear(within(sheet).getByLabelText('End date *'));
    await userEvent.type(within(sheet).getByLabelText('End date *'), '2026-09-30');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Term 1')).toBeInTheDocument();
    const post = server.calls.filter((c) => c.method === 'POST' && c.path === '/academic-terms').pop()!;
    expect(post.body).toMatchObject({ yearId: 'y1', code: 'T1', startDate: '2026-04-01', endDate: '2026-09-30', color: null });
  });

  it('is hidden without the permission', async () => {
    mount('/academic-terms', []);
    expect(await screen.findByRole('alert')).toHaveTextContent('Not available');
  });
});
