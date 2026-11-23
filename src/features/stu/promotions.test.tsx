import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { createWebSession } from '../../shell/web-session';
import { ShellApp } from '../../shell/ShellApp';
import {
  buildListQuery, buildRows, formsFromDetail, formsFromProposal, outcomeText, proposalQuery, readFailure, rowError, sectionsOf, tally, tallyText, targetClassId, undoReasonText, PromotionsError,
  type Batch, type BatchRow, type Detail, type Outcome, type OutcomeRow, type Proposal, type RowForm,
} from './promotions';

const VIEW = ['stu.student_promotions.view'];
const PREPARE = [...VIEW, 'stu.student_promotions.create', 'stu.student_promotions.delete'];
const ALL = [...PREPARE, 'stu.student_promotions.edit', 'stu.students.create', 'stu.students.edit'];

const proposal = (over: Partial<Proposal> = {}): Proposal => ({
  fromYearId: 'y1', fromYearName: '2026-27', toYearId: 'y2', toYearName: '2027-28', classId: 'c5', className: 'Class 5', sectionId: 'sa', sectionName: 'Section A',
  nextClassId: 'c6', nextClassName: 'Class 6', isLastClass: false, existingBatchId: null, existingBatchStatus: null,
  candidates: [
    { studentId: 's1', registrationCode: 'R-1', studentName: 'Asha Rao', studentStatus: 'active', enrollmentId: 'e1', rollNumber: '7', decision: 'promote', toClassId: 'c6', toClassName: 'Class 6' },
    { studentId: 's2', registrationCode: 'R-2', studentName: 'Bina Rao', studentStatus: 'active', enrollmentId: 'e2', rollNumber: '3', decision: 'promote', toClassId: 'c6', toClassName: 'Class 6' },
    { studentId: 's3', registrationCode: 'R-3', studentName: 'Chitra Rao', studentStatus: 'paused', enrollmentId: 'e3', rollNumber: '1', decision: 'leave_out', toClassId: null, toClassName: null },
  ],
  ...over,
});

const batch = (over: Partial<Batch> = {}): Batch => ({
  id: 'b1', fromYearId: 'y1', fromYearName: '2026-27', toYearId: 'y2', toYearName: '2027-28', fromClassId: 'c5', fromClassName: 'Class 5', fromSectionId: 'sa', fromSectionName: 'Section A',
  rollMode: 'alphabetical', note: null, status: 'draft', studentCount: 3, promoteCount: 2, repeatCount: 0, graduateCount: 0, leaveOutCount: 1, committedAt: null, committedByName: null, undoUntil: null,
  canUndo: false, duesOverrideReason: null, undoneAt: null, undoneByName: null, undoReason: null, createdAt: '2026-11-20T04:00:00Z', updatedAt: '2026-11-20T04:00:00Z', ...over,
});

const row = (over: Partial<BatchRow> = {}): BatchRow => ({
  studentId: 's1', registrationCode: 'R-1', studentName: 'Asha Rao', studentStatus: 'active', enrollmentId: 'e1', rollNumber: '7', decision: 'promote', toClassId: 'c6', toClassName: 'Class 6', toSectionId: null,
  toSectionName: null, newRollNumber: null, newEnrollmentId: null, enrolledClassName: null, enrolledSectionName: null, enrolledRollNumber: null, ...over,
});

const detail = (b: Partial<Batch> = {}, rows?: BatchRow[]): Detail => ({
  batch: batch(b),
  rows: rows ?? [row(), row({ studentId: 's2', registrationCode: 'R-2', studentName: 'Bina Rao', enrollmentId: 'e2', rollNumber: '3' }), row({ studentId: 's3', registrationCode: 'R-3', studentName: 'Chitra Rao', studentStatus: 'paused', decision: 'leave_out', toClassId: null, toClassName: null })],
});

const outRow = (over: Partial<OutcomeRow> = {}): OutcomeRow => ({
  studentId: 's1', registrationCode: 'R-1', studentName: 'Asha Rao', decision: 'promote', outcome: 'enrol', toClassId: 'c6', toClassName: 'Class 6', toSectionId: 'sa', toSectionName: 'Section A', rollNumber: '1', enrollmentId: null, problems: [], ...over,
});

const outcome = (rows: OutcomeRow[], over: Partial<Outcome> = {}): Outcome => ({
  batch: batch(), rows, committed: false, alreadyCommitted: false, undone: false, alreadyUndone: false, enrolledCount: rows.filter((r) => r.outcome === 'enrol').length, graduatedCount: 0,
  leftOutCount: rows.filter((r) => r.outcome === 'leave_out').length, problemCount: rows.filter((r) => r.outcome === 'problem').length, warnings: [], duesOverridden: false, ...over,
});

describe('promotions helpers', () => {
  const forms: RowForm[] = [
    { studentId: 's1', decision: 'promote', toClassId: 'c6', toSectionId: 'sb', rollNumber: ' 12 ' },
    { studentId: 's2', decision: 'repeat', toClassId: 'c9', toSectionId: '', rollNumber: '' },
    { studentId: 's3', decision: 'graduate', toClassId: 'c6', toSectionId: 'sb', rollNumber: '4' },
    { studentId: 's4', decision: 'leave_out', toClassId: '', toSectionId: '', rollNumber: '4' },
  ];

  it('sends a class only to a student who is promoted, and a section and roll number only to those who move', () => {
    expect(buildRows(forms)).toEqual([
      { studentId: 's1', decision: 'promote', toClassId: 'c6', toSectionId: 'sb', rollNumber: '12' },
      { studentId: 's2', decision: 'repeat', toClassId: null, toSectionId: null, rollNumber: null },
      { studentId: 's3', decision: 'graduate', toClassId: null, toSectionId: null, rollNumber: null },
      { studentId: 's4', decision: 'leave_out', toClassId: null, toSectionId: null, rollNumber: null },
    ]);
  });

  it('starts from the server defaults and from a saved draft', () => {
    const f = formsFromProposal(proposal());
    expect(f.map((r) => [r.decision, r.toClassId])).toEqual([['promote', 'c6'], ['promote', 'c6'], ['leave_out', '']]);
    const d = formsFromDetail(detail({}, [row({ toSectionId: 'sb', newRollNumber: '9' }), row({ studentId: 's2', decision: 'repeat', toClassId: 'c5' })]));
    expect(d[0]).toMatchObject({ toClassId: 'c6', toSectionId: 'sb', rollNumber: '9' });
    expect(d[1]).toMatchObject({ decision: 'repeat', toClassId: '' });
  });

  it('counts the decisions in words', () => {
    expect(tallyText(tally(forms))).toBe('1 to promote, 1 repeating, 1 graduating, 1 left out');
    expect(tallyText(tally([]))).toBe('No students');
  });

  it('finds the target class of a row and the sections of a class', () => {
    expect(targetClassId(forms[0], 'c5')).toBe('c6');
    expect(targetClassId(forms[1], 'c5')).toBe('c5');
    expect(targetClassId(forms[2], 'c5')).toBe('');
    expect(sectionsOf([{ classId: 'c6', sectionId: 'sa', sectionName: 'A' }, { classId: 'c7', sectionId: 'sb', sectionName: 'B' }], 'c6')).toEqual([{ id: 'sa', name: 'A' }]);
  });

  it('builds queries without empty filters', () => {
    expect(buildListQuery({ status: '' })).toBe('page=1&pageSize=25');
    expect(buildListQuery({ status: 'draft', page: 2 })).toBe('page=2&pageSize=25&status=draft');
    expect(proposalQuery({ fromYearId: 'a', toYearId: 'b', classId: 'c', sectionId: 'd' })).toBe('fromYearId=a&toYearId=b&classId=c&sectionId=d');
  });

  it('reads a failed answer, with the reasons and the row a message belongs to', async () => {
    const res = new Response(JSON.stringify({ code: 'cannot_undo', errors: [{ field: 's1', code: 'enrolment_changed', message: 'x' }] }), { status: 409 });
    const e = await readFailure(res);
    expect(e).toMatchObject({ status: 409, code: 'cannot_undo', message: 'This promotion can no longer be undone. Nothing was changed.' });
    expect(e.reasons[0].code).toBe('enrolment_changed');
    expect((await readFailure(new Response('nope', { status: 500 }))).message).toBe('Something went wrong. Please try again.');
    const v = new PromotionsError(400, 'validation_failed', [{ field: 'rows[1].toClassId', code: 'not_found', message: 'No such class.' }], 'bad');
    expect(rowError(v, 1)).toBe('No such class.');
    expect(rowError(v, 0)).toBeUndefined();
  });

  it('describes outcomes and undo reasons', () => {
    expect(outcomeText(outRow())).toBe('Class 6 · Section A · roll 1');
    expect(outcomeText(outRow({ rollNumber: null }))).toBe('Class 6 · Section A · no roll number');
    expect(outcomeText(outRow({ outcome: 'graduate' }))).toBe('Graduates (marked alumni)');
    expect(undoReasonText('promoted_onward')).toBe('The student was promoted again.');
    expect(undoReasonText('new_code')).toBe('new_code');
  });
});

type Call = { method: string; path: string; body?: Record<string, unknown> };
type Handler = (method: string, path: string, body: Record<string, unknown> | undefined, url: URL) => { status: number; body?: unknown } | undefined;

function mount(path: string, permissions: string[], handler: Handler) {
  const calls: Call[] = [];
  const json = (status: number, body: unknown) => (status === 204 ? new Response(null, { status }) : new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
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
        workspace: { home: 'x', navigation: [{ screenId: 'promotions', label: 'Promotions', order: 45 }] }, mobile: { tabs: [], features: [] }, approvals: { canApprove: [] }, version: 1,
      });
    const custom = handler(method, p, body, url);
    if (custom) return json(custom.status, custom.body);
    if (p === '/academic-years') return json(200, { items: [{ id: 'y1', name: '2026-27' }, { id: 'y2', name: '2027-28' }], page: { number: 1, size: 200, total: 2 } });
    if (p === '/classes') return json(200, { items: [{ id: 'c5', name: 'Class 5' }, { id: 'c6', name: 'Class 6' }, { id: 'c7', name: 'Class 7' }], page: { number: 1, size: 200, total: 3 } });
    if (p === '/class-section-mappings') {
      const year = url.searchParams.get('yearId');
      const items =
        year === 'y1'
          ? [{ classId: 'c5', yearId: 'y1', sectionId: 'sa', sectionName: 'Section A' }]
          : [{ classId: 'c6', yearId: 'y2', sectionId: 'sa', sectionName: 'Section A' }, { classId: 'c6', yearId: 'y2', sectionId: 'sb', sectionName: 'Section B' }];
      return json(200, { items, page: { number: 1, size: 200, total: items.length } });
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

async function chooseSource(user: ReturnType<typeof userEvent.setup>) {
  await screen.findAllByRole('option', { name: '2026-27' });
  await user.selectOptions(screen.getByLabelText('Year being closed'), 'y1');
  expect(screen.getByLabelText('New year')).toHaveValue('y2');
  await screen.findByRole('option', { name: 'Class 5' });
  await user.selectOptions(screen.getByLabelText('Class'), 'c5');
  await user.selectOptions(await screen.findByRole('combobox', { name: 'Section' }), 'sa');
  await user.click(screen.getByRole('button', { name: 'Show students' }));
}

describe('Promotions wizard', () => {
  it('walks a class section through promote, enroll, preview, commit and undo', async () => {
    const user = userEvent.setup();
    let saved: Detail | null = null;
    let previews = 0;
    const calls = mount('/promotions', ALL, (method, p, body) => {
      if (method === 'GET' && p === '/promotions/proposal') return { status: 200, body: proposal() };
      if (method === 'POST' && p === '/promotions') {
        saved = detail({}, (body!.rows as { studentId: string; decision: BatchRow['decision'] }[]).map((r, i) => row({ studentId: r.studentId, decision: r.decision, studentName: ['Asha Rao', 'Bina Rao', 'Chitra Rao'][i], registrationCode: `R-${i + 1}` })));
        return { status: 201, body: saved };
      }
      if (method === 'PUT' && p === '/promotions/b1') return { status: 200, body: saved };
      if (method === 'POST' && p === '/promotions/b1/preview') {
        previews += 1;
        return previews === 1
          ? { status: 200, body: outcome([outRow(), outRow({ studentId: 's2', studentName: 'Bina Rao', outcome: 'problem', rollNumber: null, problems: [{ field: 'rollNumber', code: 'roll_taken', message: 'Roll number 3 is already used in Class 6 (Section A).' }] }), outRow({ studentId: 's3', studentName: 'Chitra Rao', decision: 'leave_out', outcome: 'leave_out', toClassId: null, toClassName: null, toSectionId: null, toSectionName: null, rollNumber: null })], { warnings: ['Class 6 (Section A) would have 31 students; its capacity is 30.'] }) }
          : { status: 200, body: outcome([outRow(), outRow({ studentId: 's2', studentName: 'Bina Rao', rollNumber: '2' }), outRow({ studentId: 's3', studentName: 'Chitra Rao', decision: 'leave_out', outcome: 'leave_out', toClassId: null, rollNumber: null })]) };
      }
      if (method === 'POST' && p === '/promotions/b1/commit') {
        saved = detail({ status: 'committed', committedAt: '2026-11-21T05:00:00Z', committedByName: 'Asha', undoUntil: '2026-11-28T05:00:00Z', canUndo: true }, [
          row({ newEnrollmentId: 'n1', enrolledClassName: 'Class 6', enrolledSectionName: 'Section A', enrolledRollNumber: '1' }),
          row({ studentId: 's2', studentName: 'Bina Rao', newEnrollmentId: 'n2', enrolledClassName: 'Class 6', enrolledSectionName: 'Section A', enrolledRollNumber: '2' }),
          row({ studentId: 's3', studentName: 'Chitra Rao', decision: 'leave_out', toClassId: null }),
        ]);
        return { status: 200, body: outcome([], { committed: true }) };
      }
      if (method === 'GET' && p === '/promotions/b1') return { status: 200, body: saved };
      if (method === 'POST' && p === '/promotions/b1/undo') {
        saved = detail({ status: 'undone', undoneAt: '2026-11-22T05:00:00Z', undoneByName: 'Asha', undoReason: 'Wrong year' }, saved!.rows);
        return { status: 200, body: outcome([], { undone: true }) };
      }
      return undefined;
    });

    await chooseSource(user);
    // the server's defaults
    expect(await screen.findByRole('combobox', { name: 'Decision for Asha Rao' })).toHaveValue('promote');
    expect(screen.getByRole('combobox', { name: 'Class for Asha Rao' })).toHaveValue('c6');
    const paused = screen.getByRole('combobox', { name: 'Decision for Chitra Rao' });
    expect(paused).toHaveValue('leave_out');
    expect(within(paused).getByRole('option', { name: 'Promote' })).toBeDisabled(); // a student who is not active can only be left out
    expect(screen.getByTestId('tally')).toHaveTextContent('2 to promote, 1 left out');

    // a per-student override
    await user.selectOptions(screen.getByRole('combobox', { name: 'Decision for Bina Rao' }), 'repeat');
    expect(screen.queryByRole('combobox', { name: 'Class for Bina Rao' })).not.toBeInTheDocument();
    expect(screen.getByTestId('tally')).toHaveTextContent('1 to promote, 1 repeating, 1 left out');
    await user.selectOptions(screen.getByRole('combobox', { name: 'Decision for Bina Rao' }), 'promote');
    await user.click(screen.getByRole('button', { name: /Save and continue/ }));

    const create = calls.find((c) => c.method === 'POST' && c.path === '/promotions')!;
    expect(create.body).toMatchObject({ fromYearId: 'y1', toYearId: 'y2', fromClassId: 'c5', fromSectionId: 'sa', rollMode: 'alphabetical' });
    expect(create.body!.rows).toEqual([
      { studentId: 's1', decision: 'promote', toClassId: 'c6', toSectionId: null, rollNumber: null },
      { studentId: 's2', decision: 'promote', toClassId: 'c6', toSectionId: null, rollNumber: null },
      { studentId: 's3', decision: 'leave_out', toClassId: null, toSectionId: null, rollNumber: null },
    ]);

    // step 2: sections of the new class, a typed roll number, then the preview with a problem
    const section = await screen.findByRole('combobox', { name: 'Section for Asha Rao' });
    expect(within(section).getByRole('option', { name: 'Same section (Section A)' })).toBeInTheDocument();
    expect(within(section).getByRole('option', { name: 'Section B' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enrol…/ })).toBeDisabled(); // not before a preview
    await user.type(screen.getByRole('textbox', { name: 'Roll number for Bina Rao' }), '3');
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(await screen.findByText('Roll number 3 is already used in Class 6 (Section A).')).toBeInTheDocument();
    expect(screen.getByTestId('preview-summary')).toHaveTextContent('1 student needs attention');
    expect(screen.getByText(/capacity is 30/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Enrol…/ })).toBeDisabled();
    const save = calls.filter((c) => c.method === 'PUT' && c.path === '/promotions/b1').at(-1)!;
    expect((save.body!.rows as Record<string, unknown>[])[1]).toMatchObject({ studentId: 's2', rollNumber: '3' });

    // fix it, preview again, enrol
    await user.clear(screen.getByRole('textbox', { name: 'Roll number for Bina Rao' }));
    expect(screen.queryByTestId('preview-summary')).not.toBeInTheDocument(); // an edit clears the preview
    await user.click(screen.getByRole('button', { name: 'Preview' }));
    expect(await screen.findByText('Ready: 2 to enrol, 1 left out.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Enrol…/ }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Enrol these students?' });
    expect(dialog).toHaveTextContent('2 will be enrolled in 2027-28');
    await user.click(within(dialog).getByRole('button', { name: 'Enrol now' }));

    // step 3
    expect(await screen.findByTestId('batch-status')).toHaveTextContent('Committed on 21 Nov 2026');
    expect(screen.getByText(/You can undo this until/)).toBeInTheDocument();
    expect(screen.getByText('Class 6 · Section A · roll 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Undo this promotion/ }));
    const ask = await screen.findByRole('alertdialog', { name: 'Undo this promotion?' });
    expect(within(ask).getByRole('button', { name: 'Undo promotion' })).toBeDisabled(); // a reason is needed
    await user.type(within(ask).getByRole('textbox', { name: 'Why are you undoing it?' }), 'Wrong year');
    await user.click(within(ask).getByRole('button', { name: 'Undo promotion' }));
    await waitFor(() => expect(screen.getByTestId('batch-status')).toHaveTextContent('Undone on 22 Nov 2026'));
    expect(calls.find((c) => c.path === '/promotions/b1/undo')!.body).toEqual({ reason: 'Wrong year' });
    expect(screen.queryByRole('button', { name: /Undo this promotion/ })).not.toBeInTheDocument();
  });

  it('shows why an undo was refused, with the students named', async () => {
    const user = userEvent.setup();
    const committed = detail({ status: 'committed', committedAt: '2026-11-21T05:00:00Z', undoUntil: '2026-11-28T05:00:00Z', canUndo: true }, [
      row({ newEnrollmentId: 'n1', enrolledClassName: 'Class 6', enrolledSectionName: 'Section A', enrolledRollNumber: '1' }),
    ]);
    mount('/promotions', ALL, (method, p) => {
      if (method === 'GET' && p === '/promotions') return { status: 200, body: { items: [committed.batch], page: { number: 1, size: 25, total: 1 } } };
      if (method === 'GET' && p === '/promotions/b1') return { status: 200, body: committed };
      if (method === 'POST' && p === '/promotions/b1/undo') return { status: 409, body: { code: 'cannot_undo', errors: [{ field: 's1', code: 'enrolment_changed', message: 'edited' }] } };
      return undefined;
    });
    await user.click(await screen.findByRole('button', { name: 'History' }));
    await user.click(await screen.findByRole('button', { name: /Open Class 5 Section A/ }));
    await user.click(await screen.findByRole('button', { name: /Undo this promotion/ }));
    const ask = await screen.findByRole('alertdialog', { name: 'Undo this promotion?' });
    await user.type(within(ask).getByRole('textbox', { name: 'Why are you undoing it?' }), 'x');
    await user.click(within(ask).getByRole('button', { name: 'Undo promotion' }));
    expect(await screen.findByTestId('undo-reasons')).toHaveTextContent('Asha Rao: A new enrolment was edited.');
    expect(screen.getByRole('alert')).toHaveTextContent('can no longer be undone');
    expect(screen.getByTestId('batch-status')).toHaveTextContent('Committed on');
  });

  it('lets someone who can only view look but not save or enrol', async () => {
    const user = userEvent.setup();
    mount('/promotions', VIEW, (method, p) => (method === 'GET' && p === '/promotions/proposal' ? { status: 200, body: proposal() } : undefined));
    await chooseSource(user);
    await screen.findByRole('combobox', { name: 'Decision for Asha Rao' });
    expect(screen.getByRole('button', { name: /Save and continue/ })).toBeDisabled();
    expect(screen.getByText('You can look at this class section but not change it.')).toBeInTheDocument();
  });

  it('opens the saved draft of a class section instead of starting another', async () => {
    const user = userEvent.setup();
    const calls = mount('/promotions', ALL, (method, p) => {
      if (method === 'GET' && p === '/promotions/proposal') return { status: 200, body: proposal({ existingBatchId: 'b1', existingBatchStatus: 'draft' }) };
      if (method === 'GET' && p === '/promotions/b1') return { status: 200, body: detail({ rollMode: 'keep' }, [row({ decision: 'repeat', toClassId: 'c5' }), row({ studentId: 's2', studentName: 'Bina Rao' })]) };
      if (method === 'PUT' && p === '/promotions/b1') return { status: 200, body: detail({ rollMode: 'keep' }) };
      return undefined;
    });
    await chooseSource(user);
    expect(await screen.findByText(/Continuing the draft saved on/)).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Decision for Asha Rao' })).toHaveValue('repeat');
    await user.click(screen.getByRole('button', { name: /Save and continue/ }));
    await screen.findByRole('radio', { name: 'Keep each roll number' });
    expect(screen.getByRole('radio', { name: 'Keep each roll number' })).toBeChecked();
    expect(calls.some((c) => c.method === 'POST' && c.path === '/promotions')).toBe(false);
    expect(calls.some((c) => c.method === 'PUT' && c.path === '/promotions/b1')).toBe(true);
  });

  it('opens a class section that was already promoted at the result', async () => {
    const user = userEvent.setup();
    mount('/promotions', ALL, (method, p) => {
      if (method === 'GET' && p === '/promotions/proposal') return { status: 200, body: proposal({ existingBatchId: 'b1', existingBatchStatus: 'committed' }) };
      if (method === 'GET' && p === '/promotions/b1') return { status: 200, body: detail({ status: 'committed', committedAt: '2026-11-21T05:00:00Z', canUndo: false }) };
      return undefined;
    });
    await chooseSource(user);
    expect(await screen.findByTestId('batch-status')).toHaveTextContent('Committed on 21 Nov 2026');
    expect(screen.getByText('The undo window has closed.')).toBeInTheDocument();
  });

  it('keeps the user on step 1 and names the row when saving fails', async () => {
    const user = userEvent.setup();
    mount('/promotions', ALL, (method, p) => {
      if (method === 'GET' && p === '/promotions/proposal') return { status: 200, body: proposal() };
      if (method === 'POST' && p === '/promotions') return { status: 400, body: { code: 'validation_failed', detail: 'Some fields need your attention.', errors: [{ field: 'rows[1].toClassId', code: 'not_found', message: 'This class does not exist.' }] } };
      return undefined;
    });
    await chooseSource(user);
    await screen.findByRole('combobox', { name: 'Decision for Asha Rao' });
    await user.click(screen.getByRole('button', { name: /Save and continue/ }));
    expect(await screen.findByText('This class does not exist.')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Some fields need your attention.');
    expect(screen.queryByRole('radio')).not.toBeInTheDocument();
  });
});

describe('Promotions history', () => {
  it('lists the batches and filters them by status', async () => {
    const user = userEvent.setup();
    const calls = mount('/promotions', VIEW, (method, p, _b, url) => {
      if (method === 'GET' && p === '/promotions') {
        const status = url.searchParams.get('status');
        const all = [batch(), batch({ id: 'b2', status: 'committed', fromClassName: 'Class 7', committedAt: '2026-11-21T05:00:00Z' })];
        const items = status ? all.filter((b) => b.status === status) : all;
        return { status: 200, body: { items, page: { number: 1, size: 25, total: items.length } } };
      }
      return undefined;
    });
    await user.click(await screen.findByRole('button', { name: 'History' }));
    expect(await screen.findByText('Class 7 · Section A')).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Committed' })).toBeInTheDocument();
    await user.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'draft');
    await waitFor(() => expect(screen.queryByText('Class 7 · Section A')).not.toBeInTheDocument());
    expect(calls.at(-1)!.path).toContain('status=draft');
  });

  it('says so when nothing has been promoted yet', async () => {
    const user = userEvent.setup();
    mount('/promotions', VIEW, (method, p) => (method === 'GET' && p === '/promotions' ? { status: 200, body: { items: [], page: { number: 1, size: 25, total: 0 } } } : undefined));
    await user.click(await screen.findByRole('button', { name: 'History' }));
    expect(await screen.findByText('No promotions yet.')).toBeInTheDocument();
  });
});
