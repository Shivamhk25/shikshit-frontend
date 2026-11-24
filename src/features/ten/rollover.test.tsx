import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { createWebSession } from '../../shell/web-session';
import { ShellApp } from '../../shell/ShellApp';
import {
  count, defaultFrom, defaultSelection, inChecklistOrder, nextYearName, plusYear, readFailure, reasonText, resultText, RolloverError, shiftText, suggestNewYear, yearsAfter,
  type Checklist, type ChecklistStep, type Run, type StepId, type StepResult, type YearOption,
} from './rollover';

const VIEW = ['ten.year_rollover.view'];
const RUN = [...VIEW, 'ten.year_rollover.create'];
const ALL = [...RUN, 'ten.year_rollover.edit'];

const year = (over: Partial<YearOption> = {}): YearOption => ({ id: 'y1', code: 'Y1', name: '2026-27', startDate: '2026-04-01', endDate: '2027-03-31', isCurrent: true, status: 'active', ...over });
const y2 = year({ id: 'y2', code: 'Y2', name: '2027-28', startDate: '2027-04-01', endDate: '2028-03-31', isCurrent: false });

const step = (id: StepId, title: string, over: Partial<ChecklistStep> = {}): ChecklistStep => ({
  id, title, description: `${title} description.`, defaultOn: true, irreversible: false, sourceCount: 2, targetCount: 0, ...over,
});

const steps = (): ChecklistStep[] => [
  step('terms', 'Terms'),
  step('class_sections', 'Class sections', { sourceCount: 3 }),
  step('subject_classes', 'Class subjects', { sourceCount: 5 }),
  step('holidays', 'Holidays', { sourceCount: 4 }),
  step('calendar_events', 'Calendar events', { defaultOn: false, sourceCount: 1 }),
  step('make_current', 'Make the new year current', { defaultOn: false, irreversible: true, sourceCount: 0 }),
];

const checklist = (over: Partial<Checklist> = {}): Checklist => ({
  from: year(), to: y2, shift: { mode: 'years', years: 1, days: 0 }, steps: steps(), promotions: { sections: 3, promoted: 1 }, notes: ['Elective groups are not tied to a year.'], ...over,
});

const result = (step: StepId, over: Partial<StepResult> = {}): StepResult => ({
  step, dryRun: false, fromYearId: 'y1', toYearId: 'y2', createdCount: 2, existingCount: 0, skippedCount: 0, conflictCount: 0, reviewCount: 0, items: [], itemsTruncated: false, warnings: [], blockers: [],
  shift: { mode: 'years', years: 1, days: 0 }, runId: 'r1', ranAt: '2026-11-24T05:00:00Z', ...over,
});

describe('rollover helpers', () => {
  it('words the date shift', () => {
    expect(shiftText({ mode: 'years', years: 1, days: 0 })).toBe('Dates move forward by 1 year.');
    expect(shiftText({ mode: 'years', years: 2, days: 0 })).toBe('Dates move forward by 2 years.');
    expect(shiftText({ mode: 'days', years: 0, days: 426 })).toBe('Dates move forward by 426 days, because the two years start on different days.');
  });

  it('counts a result in words, leaving out the zeros', () => {
    expect(resultText({ ...result('terms'), dryRun: true, existingCount: 1, conflictCount: 1, skippedCount: 2 })).toBe('2 to copy · 1 already there · 2 skipped · 1 cannot be copied');
    expect(resultText(result('terms', { createdCount: 3 }))).toBe('3 copied');
    expect(resultText(result('terms', { createdCount: 0 }))).toBe('Nothing to copy');
    expect(count(1, 'term')).toBe('1 term');
    expect(count(2, 'class section')).toBe('2 class sections');
  });

  it('names the reasons a row could not be copied', () => {
    expect(reasonText('outside_year')).toBe('Falls outside the new year');
    expect(reasonText('section_not_mapped')).toBe('Section not mapped yet');
    expect(reasonText('something_new')).toBe('something_new');
  });

  it('suggests the next year from the last one', () => {
    expect(nextYearName('2026-27')).toBe('2027-28');
    expect(nextYearName('2029-30')).toBe('2030-31');
    expect(nextYearName('2026-2027')).toBe('2027-2028');
    expect(nextYearName('AY 2026')).toBe('AY 2027');
    expect(nextYearName('Session')).toBe('');
    expect(plusYear('2026-04-01')).toBe('2027-04-01');
    expect(plusYear('2028-02-29')).toBe('2029-02-28');
    expect(plusYear('nope')).toBe('');
    expect(suggestNewYear(year({ code: '2026-27' }))).toEqual({ code: '2027-28', name: '2027-28', startDate: '2027-04-01', endDate: '2028-03-31' });
  });

  it('proposes the current year, and the years that come after it', () => {
    const list = [year({ id: 'y0', name: '2025-26', startDate: '2025-04-01', isCurrent: false }), year(), y2];
    expect(defaultFrom(list)).toBe('y1');
    expect(defaultFrom(list.map((y) => ({ ...y, isCurrent: false })))).toBe('y2');
    expect(defaultFrom([])).toBe('');
    expect(yearsAfter(list, 'y0').map((y) => y.id)).toEqual(['y1', 'y2']);
    expect(yearsAfter(list, 'y2')).toEqual([]);
    expect(yearsAfter(list, 'nope')).toEqual([]);
  });

  it('ticks the default steps but never the irreversible one, and nothing for someone who cannot run them', () => {
    expect(defaultSelection(steps(), true)).toEqual(['terms', 'class_sections', 'subject_classes', 'holidays']);
    expect(defaultSelection(steps(), false)).toEqual([]);
  });

  it('keeps the ticked steps in checklist order', () => {
    expect(inChecklistOrder(steps(), new Set<StepId>(['make_current', 'terms', 'holidays']))).toEqual(['terms', 'holidays', 'make_current']);
  });

  it('reads a failed answer with its reasons', async () => {
    const e = await readFailure(new Response(JSON.stringify({ code: 'blocked', errors: [{ field: 'step', code: 'blocked', message: 'No terms.' }] }), { status: 409 }));
    expect(e).toMatchObject({ status: 409, code: 'blocked', message: 'This step cannot run yet. Nothing was changed.' });
    expect(e.reasons[0].message).toBe('No terms.');
    expect((await readFailure(new Response('nope', { status: 500 }))).message).toBe('Something went wrong. Please try again.');
    expect(new RolloverError(400, 'validation_failed', [{ field: 'code', code: 'duplicate', message: 'Used.' }], 'x').fieldMessage('code')).toBe('Used.');
  });
});

type Call = { method: string; path: string; body?: Record<string, unknown> };
type Handler = (method: string, path: string, body: Record<string, unknown> | undefined, url: URL) => { status: number; body?: unknown } | undefined;

function mount(permissions: string[], handler: Handler, years: YearOption[] = [year(), y2]) {
  const calls: Call[] = [];
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
        user: { id: 'u1', name: 'Asha', tier: 'tenant' }, tenant: { id: 't1', name: 'School', brand: { primary: '#2F5BFF' }, modules: ['ten'] }, permissions, scopes: {}, fieldMasks: {},
        workspace: { home: 'x', navigation: [{ screenId: 'year_rollover', label: 'Year rollover', order: 22 }] }, mobile: { tabs: [], features: [] }, approvals: { canApprove: [] }, version: 1,
      });
    const custom = handler(method, p, body, url);
    if (custom) return json(custom.status, custom.body);
    if (p === '/academic-years') return json(200, { items: years, page: { number: 1, size: 200, total: years.length } });
    return json(404, {});
  }) as typeof fetch;
  render(
    <MemoryRouter initialEntries={['/year-rollover']}>
      <ShellApp session={createWebSession(fetchFn)} />
    </MemoryRouter>,
  );
  return calls;
}

async function toChecklist(user: ReturnType<typeof userEvent.setup>) {
  await screen.findAllByRole('option', { name: '2027-28' });
  await user.click(screen.getByRole('button', { name: /Continue/ }));
  await screen.findByRole('list', { name: 'Rollover steps' });
}

describe('Year rollover wizard', () => {
  it('shows the years, the checklist with its defaults, and a preview with the rows that cannot be copied', async () => {
    const user = userEvent.setup();
    const calls = mount(RUN, (method, p) => {
      if (method === 'GET' && p === '/year-rollover/checklist') return { status: 200, body: checklist({ steps: steps().map((s) => (s.id === 'terms' ? { ...s, lastRun: { id: 'r0', ranAt: '2026-11-22T05:00:00Z', runByName: 'Asha', createdCount: 2, existingCount: 0, skippedCount: 0, conflictCount: 0, reviewCount: 0 } } : s)) }) };
      if (method === 'POST' && p === '/year-rollover/steps/terms/preview')
        return {
          status: 200,
          body: result('terms', {
            dryRun: true, runId: null, ranAt: null, createdCount: 1, conflictCount: 1, warnings: ['One term was moved.'],
            items: [
              { label: 'T2 · Second term', status: 'conflict', reason: 'outside_year', message: 'The moved dates fall outside 2027-28.', detail: '2026-10-01 to 2027-03-31 becomes 2027-10-01 to 2028-03-31', review: false },
              { label: 'T1 · First term', status: 'create', reason: '', message: '', detail: '2026-04-01 to 2026-09-30 becomes 2027-04-01 to 2027-09-30', review: false },
            ],
          }),
        };
      return undefined;
    });
    // both years are chosen for you: the current one and the one after it
    await screen.findAllByRole('option', { name: '2027-28' });
    expect(screen.getByLabelText('Year being rolled over')).toHaveValue('y1');
    expect(screen.getByLabelText('Year to set up')).toHaveValue('y2');
    await user.click(screen.getByRole('button', { name: /Continue/ }));

    await screen.findByRole('list', { name: 'Rollover steps' });
    expect(calls.find((c) => c.path.startsWith('/year-rollover/checklist'))!.path).toBe('/year-rollover/checklist?fromYearId=y1&toYearId=y2');
    expect(screen.getByTestId('shift')).toHaveTextContent('1 Apr 2026 to 31 Mar 2027 becomes 1 Apr 2027 to 31 Mar 2028. Dates move forward by 1 year.');
    for (const [name, on] of [['Terms', true], ['Class sections', true], ['Class subjects', true], ['Holidays', true], ['Calendar events', false], ['Make the new year current', false]] as const) {
      const box = screen.getByRole('checkbox', { name: `Include ${name}` });
      expect(box).toHaveProperty('checked', on);
    }
    expect(screen.getByText('Cannot be undone from here')).toBeInTheDocument();
    expect(screen.getByText('2 in 2026-27 · 0 in 2027-28')).toBeInTheDocument();
    expect(screen.getByTestId('last-run-terms')).toHaveTextContent('Last run 22 Nov 2026, 10:30 am by Asha: 2 copied.');
    expect(screen.getByTestId('last-run-holidays')).toHaveTextContent('Not run yet.');
    expect(screen.getByTestId('promotion-progress')).toHaveTextContent('1 of 3 class sections with students in 2026-27 has been promoted into 2027-28');
    expect(screen.getByRole('link', { name: 'Open Promotions' })).toHaveAttribute('href', '/promotions');
    expect(screen.getByText('Elective groups are not tied to a year.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Preview Terms' }));
    expect(await screen.findByTestId('preview-terms')).toHaveTextContent('If you run it now: 1 to copy · 1 cannot be copied.');
    const panel = screen.getByRole('group', { name: 'Preview of Terms' });
    expect(within(panel).getByText('Falls outside the new year')).toBeInTheDocument();
    expect(within(panel).getByText('One term was moved.')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST' && c.path === '/year-rollover/steps/terms/run')).toBe(false); // a preview runs nothing
    expect(calls.find((c) => c.path === '/year-rollover/steps/terms/preview')!.body).toEqual({ fromYearId: 'y1', toYearId: 'y2' });
  });

  it('runs the ticked steps in order, each on its own, and reports each result', async () => {
    const user = userEvent.setup();
    const calls = mount(RUN, (method, p) => {
      if (method === 'GET' && p === '/year-rollover/checklist') return { status: 200, body: checklist() };
      if (method === 'POST' && p === '/year-rollover/steps/holidays/run') return { status: 200, body: result('holidays', { createdCount: 3, skippedCount: 1, reviewCount: 2 }) };
      if (method === 'POST' && p.startsWith('/year-rollover/steps/') && p.endsWith('/run')) return { status: 200, body: result(p.split('/')[3] as StepId) };
      return undefined;
    });
    await toChecklist(user);
    await user.click(screen.getByRole('checkbox', { name: 'Include Class subjects' })); // untick one
    expect(screen.getByRole('button', { name: 'Run 3 selected steps' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Run 3 selected steps' }));

    expect(await screen.findByTestId('result-holidays')).toHaveTextContent('3 copied · 1 skipped');
    const runs = calls.filter((c) => c.method === 'POST' && c.path.endsWith('/run'));
    expect(runs.map((c) => c.path)).toEqual(['/year-rollover/steps/terms/run', '/year-rollover/steps/class_sections/run', '/year-rollover/steps/holidays/run']);
    expect(runs.every((c) => c.body!.confirm === false)).toBe(true);
    expect(screen.getByTestId('result-terms')).toHaveTextContent('2 copied');
    expect(screen.getByTestId('review-note')).toHaveTextContent('2 holidays may fall on different dates this year');
    expect(screen.getByRole('link', { name: 'Review the holidays' })).toHaveAttribute('href', '/holidays');
    expect(screen.queryByText(/was not run/)).not.toBeInTheDocument();
  });

  it('stops at the first step that fails, says so, and lists what did not run', async () => {
    const user = userEvent.setup();
    const calls = mount(RUN, (method, p) => {
      if (method === 'GET' && p === '/year-rollover/checklist') return { status: 200, body: checklist() };
      if (method === 'POST' && p === '/year-rollover/steps/terms/run') return { status: 200, body: result('terms') };
      if (method === 'POST' && p === '/year-rollover/steps/class_sections/run') return { status: 500, body: { code: 'internal', detail: 'Something went wrong. Please try again.' } };
      return undefined;
    });
    await toChecklist(user);
    await user.click(screen.getByRole('button', { name: /Run 4 selected steps/ }));
    expect(await screen.findByText('Class sections did not run, and nothing in it was changed.')).toBeInTheDocument();
    expect(screen.getByTestId('result-terms')).toBeInTheDocument();
    expect(screen.getByText('Class subjects was not run.')).toBeInTheDocument();
    expect(screen.getByText('Holidays was not run.')).toBeInTheDocument();
    expect(calls.filter((c) => c.path.endsWith('/run')).map((c) => c.path)).toEqual(['/year-rollover/steps/terms/run', '/year-rollover/steps/class_sections/run']);
    // going back reloads the checklist with the counts the steps left behind
    await user.click(screen.getByRole('button', { name: /Back to the checklist/ }));
    await screen.findByRole('list', { name: 'Rollover steps' });
    expect(calls.filter((c) => c.path.startsWith('/year-rollover/checklist'))).toHaveLength(2);
  });

  it('asks before making the year current, shows what changes and the warnings, and sends the confirmation', async () => {
    const user = userEvent.setup();
    const calls = mount(ALL, (method, p) => {
      if (method === 'GET' && p === '/year-rollover/checklist') return { status: 200, body: checklist() };
      if (method === 'POST' && p === '/year-rollover/steps/make_current/preview')
        return {
          status: 200,
          body: result('make_current', { dryRun: true, items: [{ label: 'Make 2027-28 the current year', status: 'create', reason: '', message: '', detail: 'The current year changes from 2026-27 to 2027-28.', review: false }],
            warnings: ['2 of 3 class sections with students in 2026-27 have not been promoted into 2027-28 yet.'] }),
        };
      if (method === 'POST' && p === '/year-rollover/steps/make_current/run') return { status: 200, body: result('make_current', { createdCount: 1 }) };
      if (method === 'POST' && p.endsWith('/run')) return { status: 200, body: result(p.split('/')[3] as StepId) };
      return undefined;
    });
    await toChecklist(user);
    await user.click(screen.getByRole('checkbox', { name: 'Include Make the new year current' }));
    await user.click(screen.getByRole('button', { name: /Run 5 selected steps/ }));
    const dialog = await screen.findByRole('alertdialog', { name: 'Make 2027-28 the current year?' });
    expect(dialog).toHaveTextContent('This cannot be undone from here');
    expect(dialog).toHaveTextContent('The current year changes from 2026-27 to 2027-28.');
    expect(within(dialog).getByRole('list', { name: 'Warnings' })).toHaveTextContent('2 of 3 class sections');
    expect(calls.some((c) => c.path.endsWith('/run'))).toBe(false); // nothing ran before the confirmation
    await user.click(within(dialog).getByRole('button', { name: 'Make current' }));

    expect(await screen.findByTestId('result-make_current')).toHaveTextContent('2027-28 is now the current year.');
    const runs = calls.filter((c) => c.method === 'POST' && c.path.endsWith('/run'));
    expect(runs.at(-1)).toMatchObject({ path: '/year-rollover/steps/make_current/run', body: { confirm: true } });
    expect(runs.slice(0, -1).every((c) => c.body!.confirm === false)).toBe(true);
  });

  it('does not let the year be made current while the preview says it cannot', async () => {
    const user = userEvent.setup();
    const calls = mount(ALL, (method, p) => {
      if (method === 'GET' && p === '/year-rollover/checklist') return { status: 200, body: checklist() };
      if (method === 'POST' && p === '/year-rollover/steps/make_current/preview') return { status: 200, body: result('make_current', { dryRun: true, blockers: ['2027-28 has no terms. Run the terms step or add them first.'] }) };
      return undefined;
    });
    await toChecklist(user);
    await user.click(screen.getByRole('checkbox', { name: 'Include Make the new year current' }));
    await user.click(screen.getByRole('button', { name: /Run 5 selected steps/ }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('2027-28 has no terms.');
    expect(within(dialog).getByRole('button', { name: 'Make current' })).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(calls.some((c) => c.path.endsWith('/run'))).toBe(false);
  });

  it('offers to create the new year when none follows, with the next year filled in, and shows what the server refuses', async () => {
    const user = userEvent.setup();
    let attempts = 0;
    const created = year({ id: 'y9', code: '2027-28', name: '2027-28', startDate: '2027-04-01', endDate: '2028-03-31', isCurrent: false });
    let have = [year()];
    const calls = mount(
      RUN,
      (method, p) => {
        if (method === 'POST' && p === '/year-rollover/years') {
          attempts += 1;
          if (attempts === 1) return { status: 400, body: { code: 'validation_failed', detail: 'Some fields need your attention.', errors: [{ field: 'startDate', code: 'overlaps_year', message: 'These dates overlap another academic year.' }] } };
          have = [year(), created];
          return { status: 201, body: created };
        }
        if (method === 'GET' && p === '/academic-years') return { status: 200, body: { items: have, page: { number: 1, size: 200, total: have.length } } };
        if (method === 'GET' && p === '/year-rollover/checklist') return { status: 200, body: checklist({ to: created }) };
        return undefined;
      },
      have,
    );
    const name = await screen.findByLabelText('Name');
    expect(name).toHaveValue('2027-28');
    expect(screen.getByLabelText('Code')).toHaveValue('2027-28');
    expect(screen.getByLabelText('Starts on')).toHaveValue('2027-04-01');
    expect(screen.getByLabelText('Ends on')).toHaveValue('2028-03-31');
    expect(screen.getByRole('button', { name: /Continue/ })).toBeDisabled(); // not before the year exists

    await user.click(screen.getByRole('button', { name: 'Create year' }));
    expect(await screen.findByText('These dates overlap another academic year.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create year' }));
    await waitFor(() => expect(screen.getByLabelText('Year to set up')).toHaveValue('y9'));
    expect(calls.filter((c) => c.path === '/year-rollover/years').at(-1)!.body).toEqual({ fromYearId: 'y1', code: '2027-28', name: '2027-28', startDate: '2027-04-01', endDate: '2028-03-31' });
    await user.click(screen.getByRole('button', { name: /Continue/ }));
    await screen.findByRole('list', { name: 'Rollover steps' });
    expect(calls.find((c) => c.path.startsWith('/year-rollover/checklist'))!.path).toContain('toYearId=y9');
  });

  it('lets someone who can only view look at the checklist but not preview or run anything', async () => {
    const user = userEvent.setup();
    mount(VIEW, (method, p) => (method === 'GET' && p === '/year-rollover/checklist' ? { status: 200, body: checklist() } : undefined));
    await toChecklist(user);
    expect(screen.getByRole('button', { name: 'Preview Terms' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Run selected steps' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Include Terms' })).toBeDisabled();
    expect(screen.getAllByText('You do not have permission to run this step.').length).toBeGreaterThan(0);
  });

  it('keeps the make-current step off for someone without the edit permission', async () => {
    const user = userEvent.setup();
    mount(RUN, (method, p) => (method === 'GET' && p === '/year-rollover/checklist' ? { status: 200, body: checklist() } : undefined));
    await toChecklist(user);
    expect(screen.getByRole('checkbox', { name: 'Include Make the new year current' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'Include Terms' })).toBeEnabled();
    expect(screen.getByText('Making a year current needs the edit permission for year rollover.')).toBeInTheDocument();
  });

  it('does not offer to make a year current that already is', async () => {
    const user = userEvent.setup();
    mount(ALL, (method, p) => (method === 'GET' && p === '/year-rollover/checklist' ? { status: 200, body: checklist({ to: { ...y2, isCurrent: true }, from: year({ isCurrent: false }) }) } : undefined));
    await toChecklist(user);
    expect(screen.getByRole('checkbox', { name: 'Include Make the new year current' })).toBeDisabled();
    expect(screen.getByText('2027-28 is already the current year.')).toBeInTheDocument();
  });

  it('shows why the checklist could not be opened', async () => {
    const user = userEvent.setup();
    mount(RUN, (method, p) => (method === 'GET' && p === '/year-rollover/checklist' ? { status: 400, body: { code: 'validation_failed', detail: 'The new year must start after the year being rolled over.' } } : undefined));
    await screen.findAllByRole('option', { name: '2027-28' });
    await user.click(screen.getByRole('button', { name: /Continue/ }));
    expect(await screen.findByRole('alert')).toHaveTextContent('The new year must start after the year being rolled over.');
    expect(screen.queryByRole('list', { name: 'Rollover steps' })).not.toBeInTheDocument();
  });
});

describe('Year rollover history', () => {
  const run = (over: Partial<Run> = {}): Run => ({
    id: 'h1', fromYearId: 'y1', fromYearName: '2026-27', toYearId: 'y2', toYearName: '2027-28', step: 'terms', status: 'completed', createdCount: 2, existingCount: 0, skippedCount: 0, conflictCount: 0,
    reviewCount: 0, warnings: [], error: null, runByName: 'Asha', ranAt: '2026-11-22T05:00:00Z', ...over,
  });

  it('lists what was run, who ran it, and what failed', async () => {
    const user = userEvent.setup();
    mount(VIEW, (method, p) => {
      if (method === 'GET' && p === '/year-rollover/history')
        return { status: 200, body: { items: [run({ id: 'h2', step: 'make_current', status: 'failed', error: 'Blocked: 2027-28 has no terms.', createdCount: 0, runByName: null }), run({ warnings: ['A room is gone.'] })], page: { number: 1, size: 25, total: 2 } } };
      return undefined;
    });
    await user.click(await screen.findByRole('button', { name: 'History' }));
    const table = await screen.findByRole('table', { name: 'Rollover steps that were run' });
    expect(within(table).getByText('Failed: Blocked: 2027-28 has no terms.')).toBeInTheDocument();
    expect(within(table).getByText('Make year current')).toBeInTheDocument();
    expect(within(table).getByText('2 copied')).toBeInTheDocument();
    expect(within(table).getByText('A room is gone.')).toBeInTheDocument();
    expect(within(table).getAllByText('2026-27 to 2027-28')).toHaveLength(2);
  });

  it('says so when nothing has been run', async () => {
    const user = userEvent.setup();
    mount(VIEW, (method, p) => (method === 'GET' && p === '/year-rollover/history' ? { status: 200, body: { items: [], page: { number: 1, size: 25, total: 0 } } } : undefined));
    await user.click(await screen.findByRole('button', { name: 'History' }));
    expect(await screen.findByText('No rollover step has been run yet.')).toBeInTheDocument();
  });

  it('pages through a long history', async () => {
    const user = userEvent.setup();
    const calls = mount(VIEW, (method, p) => (method === 'GET' && p.startsWith('/year-rollover/history') ? { status: 200, body: { items: [run()], page: { number: 1, size: 25, total: 60 } } } : undefined));
    await user.click(await screen.findByRole('button', { name: 'History' }));
    await screen.findByText('Page 1 of 3');
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await screen.findByText('Page 2 of 3');
    expect(calls.at(-1)!.path).toBe('/year-rollover/history?page=2&pageSize=25');
  });
});
