import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { blankValues } from '../../crud/descriptor';
import { ShellApp } from '../../shell/ShellApp';
import { createWebSession } from '../../shell/web-session';
import { campusesDescriptor, divisionsDescriptor, electivesDescriptor, eventsDescriptor, holidaysDescriptor } from './masters';
import { SUBJECT_AREAS, SUBJECT_CATEGORIES, classesDescriptor, subjectsDescriptor } from './structure';

describe('masters descriptors', () => {
  it('every field has a starting value', () => {
    for (const d of [divisionsDescriptor, campusesDescriptor, holidaysDescriptor, eventsDescriptor, electivesDescriptor]) {
      expect(Object.keys(blankValues(d.fields)).sort()).toEqual(d.fields.map((f) => f.key).sort());
    }
  });

  it('campuses send blank map and time fields as null and keep the radius numeric', () => {
    const v = { ...blankValues(campusesDescriptor.fields), name: 'Main', checkInRadiusM: '250' };
    expect(campusesDescriptor.toInput(v)).toMatchObject({ name: 'Main', checkInRadiusM: 250, latitude: null, longitude: null, staffDueIn: null, code: null });
    const full = { ...v, latitude: '28.6139', longitude: '77.209', staffDueIn: ' 08:30 ' };
    expect(campusesDescriptor.toInput(full)).toMatchObject({ latitude: 28.6139, longitude: 77.209, staffDueIn: '08:30' });
  });

  it('events default to all-day with no classes held, and round-trip through the form', () => {
    const blank = blankValues(eventsDescriptor.fields);
    expect(blank).toMatchObject({ isAllDay: true, isInstructionalDay: false, isExaminationDay: false });
    const row = { id: '1', yearId: 'y', yearName: 'Y', title: 'Unit test', eventType: 'exam', startDate: '2026-08-10', endDate: '2026-08-14', isAllDay: false, isInstructionalDay: false, isExaminationDay: true, venue: null, description: null, status: 'active' as const };
    expect(eventsDescriptor.toInput(eventsDescriptor.toForm(row))).toMatchObject({ yearId: 'y', eventType: 'exam', isAllDay: false, isExaminationDay: true, venue: null });
  });

  it('elective limits start at 0 and 1 and stay integers', () => {
    expect(blankValues(electivesDescriptor.fields)).toMatchObject({ minSubjects: 0, maxSubjects: 1, enforceLimits: true });
    expect(electivesDescriptor.toInput({ ...blankValues(electivesDescriptor.fields), name: 'Languages', minSubjects: '1', maxSubjects: '2' })).toMatchObject({ minSubjects: 1, maxSubjects: 2 });
  });

  it('subjects offer exactly the recommended category and area lists as selects', () => {
    const cat = subjectsDescriptor.fields.find((f) => f.key === 'category')!;
    const area = subjectsDescriptor.fields.find((f) => f.key === 'area')!;
    expect(cat.kind).toBe('select');
    expect(cat.options).toBe(SUBJECT_CATEGORIES);
    expect(area.options).toBe(SUBJECT_AREAS);
    expect(SUBJECT_CATEGORIES.map((o) => o.value)).toEqual(['core', 'elective', 'language', 'optional', 'vocational']);
  });

  it('classes can be left without a division', () => {
    expect(classesDescriptor.toInput({ ...blankValues(classesDescriptor.fields), code: 'V', name: 'Five', divisionId: '' })).toMatchObject({ divisionId: null });
    expect(classesDescriptor.fields.find((f) => f.key === 'divisionId')!.remote?.endpoint).toBe('/school-divisions');
  });
});

const YEARS = [{ id: 'y1', code: '2026-27', name: '2026-27', startDate: '2026-04-01', endDate: '2027-03-31', isCurrent: true, remarks: null, status: 'active' }];

function fakeServer(permissions: string[]) {
  const holidays: Record<string, unknown>[] = [];
  const calls: { method: string; path: string; body?: Record<string, unknown> }[] = [];
  const json = (status: number, body: unknown, h: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...h } });
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://x');
    const path = url.pathname.replace('/api/v1', '');
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    calls.push({ method, path, body });
    if (path === '/auth/refresh') return json(200, { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 9e5).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 9e8).toISOString(), mustChangePassword: false });
    if (path === '/me/access') {
      return json(200, {
        user: { id: 'u1', name: 'Asha', tier: 'tenant' }, tenant: { id: 't', name: 'School', brand: { primary: '#2F5BFF' }, modules: ['aca'] }, permissions, scopes: {}, fieldMasks: {},
        workspace: { home: 'x', navigation: [{ screenId: 'home', label: 'Home', order: 1 }, { screenId: 'holidays', label: 'Holidays', order: 2 }] },
        mobile: { tabs: [], features: [] }, approvals: { canApprove: [] }, version: 1,
      }, { 'X-Access-Version': '1' });
    }
    if (path === '/academic-years') return json(200, { items: YEARS, page: { number: 1, size: 200, total: 1 } });
    if (path === '/holidays' && method === 'GET') return json(200, { items: holidays, page: { number: 1, size: 25, total: holidays.length } });
    if (path === '/holidays' && method === 'POST') {
      if (!body?.title) return json(400, { code: 'validation_failed', status: 400, errors: [{ field: 'title', code: 'required', message: 'Enter a title.' }] });
      holidays.push({ id: 'h1', yearName: '2026-27', status: 'active', applicableFor: null, description: null, ...body });
      return json(201, holidays[0]);
    }
    return json(404, {});
  }) as typeof fetch;
  return { fetchFn, calls };
}

describe('holidays page', () => {
  it('adds a holiday with a year chosen from the server and an explicit type', async () => {
    const server = fakeServer(['aca.holiday_calendars.view', 'aca.holiday_calendars.create']);
    render(
      <MemoryRouter initialEntries={['/holidays']}>
        <ShellApp session={createWebSession(server.fetchFn)} />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Add holiday' }));
    const sheet = await screen.findByRole('dialog', { name: 'Add holiday' });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(await within(sheet).findByText('Enter a title.')).toBeInTheDocument();

    await userEvent.selectOptions(await within(sheet).findByLabelText('Academic year *'), 'y1');
    await userEvent.type(within(sheet).getByLabelText('Title *'), 'Diwali');
    await userEvent.selectOptions(within(sheet).getByLabelText('Holiday type *'), 'public');
    await userEvent.type(within(sheet).getByLabelText('Start date *'), '2026-11-08');
    await userEvent.type(within(sheet).getByLabelText('End date *'), '2026-11-09');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Diwali')).toBeInTheDocument();
    expect(screen.getByText('8 Nov 2026')).toBeInTheDocument();
    const post = server.calls.filter((c) => c.method === 'POST' && c.path === '/holidays').pop()!;
    expect(post.body).toMatchObject({ yearId: 'y1', title: 'Diwali', holidayType: 'public', isOptional: false, isRecurringAnnual: false, status: 'active' });
  });
});
