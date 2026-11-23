import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { createWebSession } from '../../shell/web-session';
import { ShellApp } from '../../shell/ShellApp';
import { admitHref, blankAdmitForm, buildAdmitBody, buildBatchBody, buildListQuery, outcomeLabel, readFailure, studentHref, type Admission, type AdmissionResult, type BatchRow } from './admissions';

const VIEW = ['adm.admissions.view', 'stu.students.view'];
const ALL = [...VIEW, 'adm.admissions.create'];

function adm(n: number, over: Partial<Admission> = {}): Admission {
  return {
    id: `r-${n}`, applicationNumber: `REG-00000${n}`, appliedOn: '2026-11-10', fullName: `Child${n} Rao`, dateOfBirth: '2018-06-01', gender: 'female', fatherName: null, motherName: null, guardianName: 'Meera Rao', guardianPhone: '9810012345',
    classId: 'c1', className: 'Class 5', sectionId: null, sectionName: null, yearId: 'y1', yearName: '2027-28', status: 'accepted', admitted: false, admittedAt: null, studentId: null, studentCode: null, enrolledSectionName: null, rollNumber: null, ...over,
  };
}

function result(a: Admission, over: Partial<AdmissionResult> = {}): AdmissionResult {
  return {
    registrationId: a.id, applicationNumber: a.applicationNumber, alreadyAdmitted: false,
    student: { id: `s-${a.id}`, registrationCode: 'STU-000045', fullName: a.fullName, className: a.className, sectionName: 'A', rollNumber: '1' },
    enrollmentId: 'e1', yearName: a.yearName, guardians: [{ guardianId: 'g1', name: 'Meera Rao', relation: 'mother', isPrimary: true }], notes: ['No father is named on the registration.'], ...over,
  };
}

type Handler = (path: string, body: Record<string, unknown> | undefined, url: URL) => { status: number; body: unknown } | undefined;

function mount(path: string, permissions: string[], rows: Admission[], handler: Handler = () => undefined) {
  const calls: { method: string; path: string; body?: Record<string, unknown> }[] = [];
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://x');
    const p = url.pathname.replace('/api/v1', '');
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    calls.push({ method, path: p + url.search, body });
    if (p === '/auth/refresh') return json(200, { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 9e5).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 9e8).toISOString(), mustChangePassword: false });
    if (p === '/me/access')
      return json(200, {
        user: { id: 'u1', name: 'Asha', tier: 'tenant' }, tenant: { id: 't1', name: 'School', brand: { primary: '#2F5BFF' }, modules: ['adm', 'stu'] }, permissions, scopes: {}, fieldMasks: {},
        workspace: { home: 'x', navigation: [{ screenId: 'registrations', label: 'Registrations', order: 37 }, { screenId: 'admissions', label: 'Admissions', order: 38 }] },
        mobile: { tabs: [], features: [] }, approvals: { canApprove: [] }, version: 1,
      });
    const custom = handler(p, body, url);
    if (custom) return json(custom.status, custom.body);
    if (p === '/classes') return json(200, { items: [{ id: 'c1', name: 'Class 5' }, { id: 'c2', name: 'Class 6' }], page: { number: 1, size: 200, total: 2 } });
    if (p === '/academic-years') return json(200, { items: [{ id: 'y1', name: '2027-28' }], page: { number: 1, size: 200, total: 1 } });
    if (p === '/class-section-mappings')
      return json(200, { items: [{ classId: 'c1', yearId: 'y1', sectionId: 's1', sectionName: 'Section A' }, { classId: 'c1', yearId: 'y1', sectionId: 's2', sectionName: 'Section B' }], page: { number: 1, size: 200, total: 2 } });
    if (p === '/admissions' && method === 'GET') {
      const admitted = url.searchParams.get('state') === 'admitted';
      const items = rows.filter((r) => r.admitted === admitted);
      return json(200, { items, page: { number: 1, size: 25, total: items.length } });
    }
    const one = /^\/admissions\/([^/]+)$/.exec(p);
    if (one && method === 'GET') return json(200, rows.find((r) => r.id === one[1]));
    if (/^\/student-registrations/.test(p)) return json(200, { items: [{ id: 'r-9', applicationNumber: 'REG-000009', fullName: 'Child9 Rao', status: 'accepted', className: 'Class 5', yearName: '2027-28', appliedOn: '2026-11-10', gender: 'female', sectionName: null }], page: { number: 1, size: 25, total: 1 } });
    return json(404, {});
  }) as typeof fetch;
  render(
    <MemoryRouter initialEntries={[path]}>
      <ShellApp session={createWebSession(fetchFn)} />
    </MemoryRouter>,
  );
  return calls;
}

async function chooseSection(scope: ReturnType<typeof within>, name: string) {
  const select = scope.getByRole('combobox', { name: /^Section/ });
  await waitFor(() => expect(within(select).getAllByRole('option').length).toBeGreaterThan(1));
  await userEvent.selectOptions(select, name);
}

describe('request building and error mapping', () => {
  it('builds the queue query without empty filters', () => {
    expect(buildListQuery({ state: 'ready' })).toBe('state=ready&page=1&pageSize=25');
    expect(buildListQuery({ state: 'admitted', classId: 'c1', yearId: 'y1', search: ' rao ', page: 2, sort: '-admittedAt' })).toBe('state=admitted&page=2&pageSize=25&classId=c1&yearId=y1&q=rao&sort=-admittedAt');
  });

  it('sends only what was typed, trimmed', () => {
    expect(buildAdmitBody({ ...blankAdmitForm(), sectionId: 's1' })).toEqual({ sectionId: 's1' });
    expect(buildAdmitBody({ sectionId: 's1', rollNumber: ' 12 ', studentCode: '', gender: 'male', admissionDate: '2026-11-20', parentEmail: ' a@b.in ', confirmDuplicate: true })).toEqual({
      sectionId: 's1', rollNumber: '12', gender: 'male', admissionDate: '2026-11-20', parentEmail: 'a@b.in', confirmDuplicate: true,
    });
  });

  it('puts each registration id into a batch item', () => {
    expect(buildBatchBody([{ registrationId: 'r1', form: { ...blankAdmitForm(), sectionId: 's1', rollNumber: '4' } }])).toEqual({ items: [{ registrationId: 'r1', sectionId: 's1', rollNumber: '4' }] });
  });

  it('builds the links to the other screens', () => {
    expect(admitHref('r 1')).toBe('/admissions?registration=r%201');
    expect(studentHref('STU-000045')).toBe('/students?q=STU-000045');
  });

  it('maps a 400 into field messages and recognises the duplicate question', async () => {
    const res = new Response(JSON.stringify({ code: 'validation_failed', errors: [{ field: 'rollNumber', code: 'duplicate', message: 'Roll 4 is taken.' }, { field: 'confirmDuplicate', code: 'possible_duplicate', message: 'Same name and date of birth.' }] }), { status: 400 });
    const e = await readFailure(res);
    expect(e.fieldMessages).toEqual({ rollNumber: 'Roll 4 is taken.' });
    expect(e.needsDuplicateConfirmation).toBe(true);
  });

  it('gives a plain message for a 409 that has no detail', async () => {
    const e = await readFailure(new Response(JSON.stringify({ code: 'not_accepted' }), { status: 409 }));
    expect(e.status).toBe(409);
    expect(e.message).toBe('Only an accepted registration can be admitted.');
    expect(outcomeLabel('problem', true)).toBe('Needs attention');
    expect(outcomeLabel('already_admitted', false)).toMatch(/nothing changed/);
  });
});

describe('admissions queue', () => {
  it('lists ready registrations; a view-only user sees no select boxes or Admit buttons', async () => {
    mount('/admissions', VIEW, [adm(1), adm(2, { sectionName: 'Section B' })]);
    const table = await screen.findByRole('table');
    expect(await within(table).findByText('Child1 Rao')).toBeInTheDocument();
    expect(within(table).getByText(/Class 5 · Section B/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Admit / })).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: /fee|exam/i })).not.toBeInTheDocument();
  });

  it('is not available without the view permission', async () => {
    mount('/admissions', [], [adm(1)]);
    expect(await screen.findByRole('alert')).toHaveTextContent('Not available');
  });

  it('sends the class, year, search and state to the server', async () => {
    const calls = mount('/admissions', ALL, [adm(1), adm(2, { admitted: true, studentCode: 'STU-000007', admittedAt: '2026-11-12T00:00:00Z', rollNumber: '3', enrolledSectionName: 'Section A' })]);
    await screen.findByText('Child1 Rao');
    await userEvent.selectOptions(await screen.findByRole('combobox', { name: 'Class' }), 'c1');
    await waitFor(() => expect(calls.some((c) => c.path.includes('classId=c1'))).toBe(true));
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search admissions' }), 'rao');
    await waitFor(() => expect(calls.some((c) => c.path.includes('q=rao'))).toBe(true));
    await userEvent.click(screen.getByRole('button', { name: 'Admitted' }));
    expect(await screen.findByText('Child2 Rao')).toBeInTheDocument();
    expect(calls.some((c) => c.path.includes('state=admitted'))).toBe(true);
    expect(screen.getByRole('link', { name: 'STU-000007' })).toHaveAttribute('href', '/students?q=STU-000007');
  });
});

describe('admit sheet', () => {
  it('admits with a section from the registration’s class and year and links to the student', async () => {
    const a = adm(1);
    const calls = mount('/admissions', ALL, [a], (p, body) => (/\/admit$/.test(p) ? { status: 201, body: result(a) } : undefined));
    await userEvent.click(await screen.findByRole('button', { name: /^Admit REG-000001/ }));
    const sheet = await screen.findByRole('dialog');
    await waitFor(() => expect(calls.some((c) => c.path.startsWith('/class-section-mappings?') && c.path.includes('classId=c1') && c.path.includes('yearId=y1'))).toBe(true));
    expect(within(sheet).getByText('Blank = next number in the section.')).toBeInTheDocument();
    expect(within(sheet).getByText('Blank = automatic.')).toBeInTheDocument();
    expect(within(sheet).queryByRole('combobox', { name: /^Gender/ })).not.toBeInTheDocument();
    await chooseSection(within(sheet), 'Section B');
    await userEvent.type(within(sheet).getByLabelText('Roll number'), '7');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Admit student' }));
    expect(await within(sheet).findByText('Child1 Rao is admitted as STU-000045.')).toBeInTheDocument();
    expect(within(sheet).getByRole('link', { name: 'STU-000045' })).toHaveAttribute('href', '/students?q=STU-000045');
    expect(within(sheet).getByText('No father is named on the registration.')).toBeInTheDocument();
    expect(within(sheet).getByText(/Meera Rao · mother \(primary\)/)).toBeInTheDocument();
    expect(calls.find((c) => c.path.endsWith('/admit'))).toMatchObject({ path: '/admissions/r-1/admit', body: { sectionId: 's2', rollNumber: '7' } });
  });

  it('says plainly when the registration was already admitted (200) and nothing changed', async () => {
    const a = adm(1);
    mount('/admissions', ALL, [a], (p) => (/\/admit$/.test(p) ? { status: 200, body: result(a, { alreadyAdmitted: true, notes: [] }) } : undefined));
    await userEvent.click(await screen.findByRole('button', { name: /^Admit REG-000001/ }));
    const sheet = await screen.findByRole('dialog');
    await chooseSection(within(sheet), 'Section A');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Admit student' }));
    expect(await within(sheet).findByText('Child1 Rao was already admitted as STU-000045. Nothing was changed.')).toBeInTheDocument();
  });

  it('asks for gender only when the registration has none, and shows field errors from a 400', async () => {
    const a = adm(1, { gender: null });
    mount('/admissions', ALL, [a], (p) => (/\/admit$/.test(p) ? { status: 400, body: { code: 'validation_failed', errors: [{ field: 'rollNumber', code: 'duplicate', message: 'Roll 7 is already used in Section A.' }, { field: 'gender', code: 'required', message: 'Choose a gender.' }] } } : undefined));
    await userEvent.click(await screen.findByRole('button', { name: /^Admit REG-000001/ }));
    const sheet = await screen.findByRole('dialog');
    expect(within(sheet).getByRole('combobox', { name: /^Gender/ })).toBeInTheDocument();
    await chooseSection(within(sheet), 'Section A');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Admit student' }));
    expect(await within(sheet).findByText('Roll 7 is already used in Section A.')).toBeInTheDocument();
    expect(within(sheet).getByText('Choose a gender.')).toBeInTheDocument();
    expect(within(sheet).getByLabelText('Roll number')).toHaveAttribute('aria-invalid', 'true');
  });

  it('asks before admitting a possible duplicate, then resends with confirmDuplicate', async () => {
    const a = adm(1);
    let n = 0;
    const calls = mount('/admissions', ALL, [a], (p, body) => {
      if (!/\/admit$/.test(p)) return undefined;
      n += 1;
      return body?.confirmDuplicate ? { status: 201, body: result(a) } : { status: 400, body: { code: 'validation_failed', errors: [{ field: 'confirmDuplicate', code: 'possible_duplicate', message: 'Same name and date of birth.' }] } };
    });
    await userEvent.click(await screen.findByRole('button', { name: /^Admit REG-000001/ }));
    const sheet = await screen.findByRole('dialog');
    await chooseSection(within(sheet), 'Section A');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Admit student' }));
    expect(await within(sheet).findByTestId('duplicate-confirm')).toBeInTheDocument();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Admit anyway' }));
    expect(await within(sheet).findByText('Child1 Rao is admitted as STU-000045.')).toBeInTheDocument();
    expect(n).toBe(2);
    expect(calls.filter((c) => c.path.endsWith('/admit')).at(-1)?.body?.confirmDuplicate).toBe(true);
  });

  it('shows the server reason for a 409', async () => {
    const a = adm(1);
    mount('/admissions', ALL, [a], (p) => (/\/admit$/.test(p) ? { status: 409, body: { code: 'not_accepted', detail: 'This registration is no longer accepted.' } } : undefined));
    await userEvent.click(await screen.findByRole('button', { name: /^Admit REG-000001/ }));
    const sheet = await screen.findByRole('dialog');
    await chooseSection(within(sheet), 'Section A');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Admit student' }));
    expect(await within(sheet).findByText('This registration is no longer accepted.')).toBeInTheDocument();
  });

  it('opens the sheet for ?registration=<id> from the registrations screen', async () => {
    mount('/admissions?registration=r-1', ALL, [adm(1)]);
    expect(await screen.findByRole('dialog', { name: 'Admit Child1 Rao' })).toBeInTheDocument();
  });
});

describe('bulk admit', () => {
  const rowsFor = (...as: Admission[]): BatchRow[] => as.map((a) => ({ registrationId: a.id, applicationNumber: a.applicationNumber, outcome: 'would_admit', problems: [] }));

  it('previews problems per row, then admits only the rows that are ready and shows each outcome with a student link', async () => {
    const a = adm(1);
    const b = adm(2);
    const calls = mount('/admissions', ALL, [a, b], (p, body) => {
      if (p === '/admissions/preview') {
        return { status: 200, body: { rows: [rowsFor(a)[0], { registrationId: b.id, applicationNumber: b.applicationNumber, outcome: 'problem', problems: [{ field: 'rollNumber', code: 'duplicate', message: 'Roll 4 is taken in Section A.' }] }], okCount: 1, problemCount: 1 } };
      }
      if (p === '/admissions/bulk') return { status: 200, body: { rows: [{ ...rowsFor(a)[0], outcome: 'admitted', result: result(a) }], okCount: 1, problemCount: 0 } };
      return undefined;
    });
    await screen.findByText('Child1 Rao');
    await userEvent.click(screen.getByRole('checkbox', { name: 'Select all on this page' }));
    await userEvent.click(screen.getByRole('button', { name: /Admit selected/ }));
    const sheet = await screen.findByRole('dialog');
    await waitFor(() => expect(calls.some((c) => c.path.startsWith('/class-section-mappings'))).toBe(true));
    const one = within(sheet).getByRole('combobox', { name: 'One section for all' });
    await waitFor(() => expect(within(one).getAllByRole('option').length).toBeGreaterThan(1));
    await userEvent.selectOptions(one, 'Section A');
    await userEvent.type(within(within(sheet).getByTestId('bulk-row-r-2')).getByLabelText('Roll number'), '4');
    expect(within(sheet).getByRole('button', { name: 'Admit 0' })).toBeDisabled();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Preview' }));
    expect(await within(sheet).findByText('Roll 4 is taken in Section A.')).toBeInTheDocument();
    expect(within(sheet).getByTestId('preview-summary')).toHaveTextContent('1 can be admitted, 1 need attention.');
    expect(calls.find((c) => c.path === '/admissions/preview')?.body).toEqual({ items: [{ registrationId: 'r-1', sectionId: 's1' }, { registrationId: 'r-2', sectionId: 's1', rollNumber: '4' }] });
    await userEvent.click(within(sheet).getByRole('button', { name: 'Admit 1' }));
    const outcome = await within(sheet).findByTestId('outcome-r-1');
    expect(within(outcome).getByText(/Admitted$/)).toBeInTheDocument();
    expect(within(outcome).getByRole('link', { name: 'STU-000045' })).toHaveAttribute('href', '/students?q=STU-000045');
    expect(calls.find((c) => c.path === '/admissions/bulk')?.body).toEqual({ items: [{ registrationId: 'r-1', sectionId: 's1' }] });
  });

  it('a changed row invalidates the preview', async () => {
    const a = adm(1);
    mount('/admissions', ALL, [a], (p) => (p === '/admissions/preview' ? { status: 200, body: { rows: rowsFor(a), okCount: 1, problemCount: 0 } } : undefined));
    await userEvent.click(await screen.findByRole('checkbox', { name: /^Select REG-000001/ }));
    await userEvent.click(screen.getByRole('button', { name: /Admit selected/ }));
    const sheet = await screen.findByRole('dialog');
    await chooseSection(within(within(sheet).getByTestId('bulk-row-r-1')), 'Section A');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Preview' }));
    expect(await within(sheet).findByRole('button', { name: 'Admit 1' })).toBeEnabled();
    await userEvent.type(within(sheet).getByLabelText('Roll number'), '9');
    expect(within(sheet).getByRole('button', { name: 'Admit 0' })).toBeDisabled();
  });
});

describe('registrations hand-off', () => {
  it('offers Admit on accepted registrations to people who may admit', async () => {
    mount('/registrations', ['adm.student_registrations.view', 'adm.admissions.create'], []);
    const link = await screen.findByRole('link', { name: /^Admit REG-000009/ });
    expect(link).toHaveAttribute('href', '/admissions?registration=r-9');
  });

  it('hides Admit without the admissions create permission', async () => {
    mount('/registrations', ['adm.student_registrations.view'], []);
    await screen.findByText('Child9 Rao');
    expect(screen.queryByRole('link', { name: /^Admit / })).not.toBeInTheDocument();
  });
});
