import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it } from 'vitest';
import { createWebSession } from '../../shell/web-session';
import { ShellApp } from '../../shell/ShellApp';
import { pollConfig } from './pollConfig';
import type { BatchStatus, ImportBatch, ImportPack, ImportRow } from './importApi';

const ALL = ['onb.workspace.view', 'onb.imports.view', 'onb.imports.import', 'onb.imports.commit', 'onb.imports.rollback'];

const ENTITIES = [
  {
    key: 'school_divisions',
    title: 'School divisions',
    domain: 'academic',
    templateVersion: 1,
    columns: [
      { key: 'code', label: 'Code', required: true, kind: 'text' },
      { key: 'name', label: 'Name', required: true, kind: 'text' },
    ],
  },
  {
    key: 'academic_years',
    title: 'Academic years',
    domain: 'academic',
    templateVersion: 1,
    columns: [
      { key: 'code', label: 'Code', required: true, kind: 'text' },
      { key: 'name', label: 'Name', required: true, kind: 'text' },
    ],
  },
  {
    key: 'academic_terms',
    title: 'Terms',
    domain: 'academic',
    templateVersion: 1,
    columns: [
      { key: 'code', label: 'Code', required: true, kind: 'text' },
      { key: 'title', label: 'Title', required: true, kind: 'text' },
    ],
  },
  {
    key: 'rooms',
    title: 'Rooms',
    domain: 'academic',
    templateVersion: 1,
    columns: [
      { key: 'code', label: 'Code', required: true, kind: 'text' },
      { key: 'name', label: 'Name', required: true, kind: 'text' },
    ],
  },
];

const step = (entity: string, title: string, order: number, over: Partial<ImportPack['steps'][number]> = {}): ImportPack['steps'][number] => ({
  entity, title, order, count: 0, state: 'todo', required: false, requires: [], next: false, ...over,
});

const PACK: ImportPack = {
  key: 'academic', title: 'Academic structure', domain: 'academic', ready: false,
  steps: [
    step('academic_years', 'Academic years', 1, { required: true, next: true }),
    step('academic_terms', 'Terms', 2, { state: 'waiting', requires: ['academic_years'] }),
    step('school_divisions', 'School divisions', 3),
    step('classes', 'Classes', 4, { required: true }),
    step('rooms', 'Rooms', 5, { count: 6, state: 'done' }),
  ],
  rules: [
    { key: 'current_year', label: 'A current academic year is set', met: false, checked: true },
    { key: 'class_mappings', label: 'Every class has a section and mapped subjects', met: false, checked: false, detail: 'Checked once class-section and subject-class mappings can be set up.' },
  ],
};

const PACK_AFTER: ImportPack = {
  ...PACK,
  steps: [step('academic_years', 'Academic years', 1, { required: true, count: 1, state: 'done' }), ...PACK.steps.slice(1).map((s) => (s.entity === 'academic_terms' ? { ...s, state: 'todo' as const } : s)), ],
  rules: [{ key: 'current_year', label: 'A current academic year is set', met: true, checked: true }, PACK.rules[1]!],
};

interface Opts {
  /** Rows the file contains, with the verdict the server gives each. */
  rows?: ImportRow[];
  uploadError?: { status: number; code: string; detail?: string; errors?: { field: string; code: string; message: string }[] };
  commitError?: { status: number; code: string; detail: string };
  existing?: ImportBatch[];
  /** The pack the server describes; absent means the caller has no access to it (404). */
  pack?: ImportPack;
  /** The institute requires approval; `uploader` says whether the signed-in user (u1) or someone else (u2) uploaded the file. */
  approval?: { uploader: 'me' | 'other' };
  /** How many reads a file stays in "checking" before it is checked. Raise it to keep that state on screen long enough to assert. */
  checkPolls?: number;
  approveError?: { status: number; code: string; detail: string };
  /** Current institute setting served by /onboarding/settings. */
  approvalSetting?: boolean;
  settingsError?: { status: number; code: string; detail: string };
}

/** A fake of the real contract: cookie session, /me/access, and the /onboarding operations with background progress. */
function fakeServer(permissions: string[], opts: Opts = {}) {
  const calls: { method: string; path: string; form?: Record<string, string> }[] = [];
  const rows = opts.rows ?? [
    { rowNo: 2, status: 'valid', action: 'create', cells: { code: 'PRI', name: 'Primary' }, problems: [] },
    { rowNo: 3, status: 'valid', action: 'create', cells: { code: 'SEN', name: 'Senior' }, problems: [] },
  ];
  const errors = rows.filter((r) => r.status === 'error').length;
  const ready = rows.length - errors;
  let batch: ImportBatch | null = null;
  let committed = false;
  let approvalSetting = opts.approvalSetting ?? true;
  let polls = 0;
  let waits = 0; // polls seen since the last commit or rollback: the work takes a few polls, as on a real server
  const json = (status: number, body: unknown, h: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...h } });
  const problem = (status: number, body: Record<string, unknown>) => json(status, { status, ...body });
  const mk = (over: Partial<ImportBatch>): ImportBatch => ({
    id: 'b1', entity: 'school_divisions', strategy: 'upsert', commitMode: 'all_or_nothing', status: 'uploaded', fileName: 'x.csv', totalRows: rows.length, validRows: 0, warningRows: 0,
    errorRows: 0, committedRows: 0, revertedRows: 0, progressDone: 0, progressTotal: rows.length, failure: null, createdAt: '2026-11-21T10:00:00Z', createdBy: opts.approval?.uploader === 'other' ? 'u2' : 'u1',
    approvalRequired: Boolean(opts.approval), approvedAt: null, rejectReason: null, committedAt: null, rollbackDeadline: null, ...over,
  });
  const setStatus = (s: BatchStatus) => {
    if (!batch) return;
    batch = { ...batch, status: s };
    if (s === 'validated') batch = { ...batch, validRows: ready, errorRows: errors, fileProblems: [] };
    if (s === 'committed') batch = { ...batch, committedRows: ready, progressDone: ready, rollbackDeadline: '2026-11-28T10:00:00Z' };
    if (s === 'rolled_back') batch = { ...batch, revertedRows: Math.max(0, batch.committedRows - 1) };
  };

  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://x');
    const path = url.pathname.replace('/api/v1', '');
    const method = init?.method ?? 'GET';
    let form: Record<string, string> | undefined;
    if (init?.body instanceof FormData) {
      form = {};
      init.body.forEach((v, k) => (form![k] = v instanceof File ? `file:${v.name}` : String(v)));
    }
    calls.push({ method, path: path + url.search, form });

    if (path === '/auth/refresh') return json(200, { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 9e5).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 9e8).toISOString(), mustChangePassword: false });
    if (path === '/me/access') {
      return json(200, {
        user: { id: 'u1', name: 'Asha', tier: 'tenant' },
        tenant: { id: 't1', name: 'School', brand: { primary: '#2F5BFF' }, modules: ['onb'] },
        permissions,
        scopes: {},
        fieldMasks: {},
        workspace: { home: 'x', navigation: [{ screenId: 'home', label: 'Home', order: 1 }, { screenId: 'onboarding', label: 'Onboarding', order: 2 }] },
        mobile: { tabs: [], features: [] },
        approvals: { canApprove: [] },
        version: 1,
      }, { 'X-Access-Version': '1' });
    }
    if (path === '/onboarding/entities') return json(200, { items: ENTITIES });
    if (path === '/onboarding/packs/academic') return opts.pack ? json(200, committed ? PACK_AFTER : opts.pack) : problem(404, { code: 'not_found' });
    if (path === '/onboarding/templates/school_divisions') return new Response('Code,Name\nPRI,Primary\n', { status: 200, headers: { 'Content-Type': 'text/csv' } });
    if (path === '/onboarding/imports' && method === 'POST') {
      if (opts.uploadError) return problem(opts.uploadError.status, opts.uploadError);
      batch = mk({ strategy: form!.strategy as ImportBatch['strategy'], commitMode: form!.commitMode as ImportBatch['commitMode'], fileName: form!.file!.replace('file:', '') });
      polls = 0;
      return json(202, batch);
    }
    if (path === '/onboarding/imports' && method === 'GET') {
      let items = opts.existing ?? (batch ? [batch] : []);
      if (url.searchParams.get('awaitingApproval') === 'true') items = items.filter((b) => b.status === 'validated' && b.approvalRequired && !b.approvedAt);
      return json(200, { items, page: { number: 1, size: 8, total: items.length } });
    }
    if (path === '/onboarding/settings') {
      if (!permissions.includes('onb.maker_checker.view')) return problem(403, { code: 'permission_denied' });
      if (method === 'PUT') {
        if (opts.settingsError) return problem(opts.settingsError.status, opts.settingsError);
        approvalSetting = JSON.parse(String(init?.body)).importApprovalRequired as boolean;
      }
      return json(200, { importApprovalRequired: approvalSetting });
    }
    const m = /^\/onboarding\/imports\/([^/]+)(\/.*)?$/.exec(path);
    if (m) {
      const sub = m[2] ?? '';
      if (m[1] === 'missing') return problem(404, { code: 'not_found' });
      const found = batch ?? opts.existing?.find((b) => b.id === m[1]) ?? null;
      if (!found) return problem(404, { code: 'not_found' });
      batch = found;
      if (sub === '' && method === 'GET') {
        polls++;
        if (batch.status === 'uploaded') setStatus('validating');
        else if (batch.status === 'validating' && polls > (opts.checkPolls ?? 1)) setStatus('validated');
        else if (batch.status === 'committing' && ++waits > 2) setStatus('committed');
        else if (batch.status === 'rolling_back' && ++waits > 2) setStatus('rolled_back');
        return json(200, batch);
      }
      if (sub === '/rows') {
        const st = url.searchParams.get('status');
        const items = rows.filter((r) => !st || r.status === st);
        return json(200, { items, page: { number: 1, size: 25, total: items.length } });
      }
      if (sub === '/errors.csv') return new Response('Code,Name,Problems\n,No code,Enter a code.\n', { status: 200, headers: { 'Content-Type': 'text/csv' } });
      if (sub === '/commit' && method === 'POST') {
        if (opts.commitError) return problem(opts.commitError.status, opts.commitError);
        waits = 0;
        committed = true;
        setStatus('committing');
        return json(202, batch);
      }
      if (sub === '/approve' && method === 'POST') {
        if (opts.approveError) return problem(opts.approveError.status, opts.approveError);
        if (batch.createdBy === 'u1') return problem(409, { code: 'conflict', detail: 'You uploaded this file, so someone else has to approve it.' });
        waits = 0;
        committed = true;
        batch = { ...batch, approvedAt: '2026-11-21T11:00:00Z' };
        setStatus('committing');
        return json(202, batch);
      }
      if (sub === '/reject' && method === 'POST') {
        const reason = String(JSON.parse(String(init?.body)).reason ?? '').trim();
        if (!reason) return problem(400, { code: 'validation_failed', errors: [{ field: 'reason', code: 'required', message: 'Enter a reason.' }] });
        batch = { ...batch, status: 'rejected', rejectReason: reason };
        return json(200, batch);
      }
      if (sub === '/rollback' && method === 'POST') {
        waits = 0;
        setStatus('rolling_back');
        return json(202, batch);
      }
    }
    return json(404, {});
  }) as typeof fetch;
  return { fetchFn, calls };
}

function mount(permissions: string[], opts?: Opts) {
  const server = fakeServer(permissions, opts);
  render(
    <MemoryRouter initialEntries={['/onboarding']}>
      <ShellApp session={createWebSession(server.fetchFn)} />
    </MemoryRouter>,
  );
  return server;
}

const csv = (name = 'divisions.csv') => new File(['code,name\nPRI,Primary\n'], name, { type: 'text/csv' });

async function upload(file: File = csv()) {
  await userEvent.upload(await screen.findByLabelText('Choose a file'), file);
  await userEvent.click(screen.getByRole('button', { name: 'Check my file' }));
}

const BAD_ROWS: ImportRow[] = [
  { rowNo: 2, status: 'valid', action: 'create', cells: { code: 'PRI', name: 'Primary' }, problems: [] },
  { rowNo: 3, status: 'error', action: null, cells: { name: 'No code' }, problems: [{ column: 'code', code: 'required', message: 'Enter a code.', severity: 'error' }] },
];

describe('import workspace', () => {
  beforeAll(() => {
    pollConfig.ms = 20;
  });

  it('offers only what the server lists, and a template', async () => {
    const server = mount(ALL);
    expect(await screen.findByRole('heading', { name: 'Import data' })).toBeInTheDocument();
    expect(await screen.findByRole('option', { name: 'School divisions' })).toBeInTheDocument();
    expect(screen.getByText('Code')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Download the CSV template' }));
    await waitFor(() => expect(server.calls.some((c) => c.path === '/onboarding/templates/school_divisions')).toBe(true));
  });

  it('shows an empty state when nothing can be imported', async () => {
    const server = fakeServer(ALL);
    const orig = server.fetchFn;
    const fetchFn = (async (i: RequestInfo | URL, init?: RequestInit) =>
      String(i).endsWith('/onboarding/entities') ? new Response(JSON.stringify({ items: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } }) : orig(i, init)) as typeof fetch;
    render(
      <MemoryRouter initialEntries={['/onboarding']}>
        <ShellApp session={createWebSession(fetchFn)} />
      </MemoryRouter>,
    );
    expect(await screen.findByText('Nothing to import yet')).toBeInTheDocument();
  });

  it('does not let someone without the import permission start an import', async () => {
    mount(['onb.workspace.view', 'onb.imports.view']);
    expect(await screen.findByText(/You can look at imports but not start one/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check my file' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Choose a file' })).toBeDisabled();
    expect(screen.getByLabelText('Choose a file', { selector: 'input' })).toBeDisabled();
  });

  it('rejects a wrong file type before uploading anything', async () => {
    const server = mount(ALL);
    await userEvent.upload(await screen.findByLabelText('Choose a file'), new File(['x'], 'notes.pdf'), { applyAccept: false });
    expect(await screen.findByText('Choose a .csv or .xlsx file.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check my file' })).toBeDisabled();
    expect(server.calls.some((c) => c.method === 'POST' && c.path === '/onboarding/imports')).toBe(false);
  });

  it('uploads with the chosen options, waits for the check, and shows the rows', async () => {
    const server = mount(ALL, { checkPolls: 30 }); // about 600 ms in "checking", so the assertion below cannot miss it
    await userEvent.click(await screen.findByLabelText(/Add new only/));
    await userEvent.click(screen.getByLabelText(/Import the valid rows/));
    await upload();

    await waitFor(() => expect(screen.getAllByRole('status').some((el) => (el.textContent ?? '').includes('Checking divisions.csv'))).toBe(true));
    expect(await screen.findByRole('button', { name: 'Import 2 rows' }, { timeout: 4000 })).toBeEnabled();
    const post = server.calls.find((c) => c.method === 'POST' && c.path === '/onboarding/imports')!;
    expect(post.form).toEqual({ entity: 'school_divisions', strategy: 'insert', commitMode: 'skip_invalid', file: 'file:divisions.csv' });
    expect(screen.getByText('Primary')).toBeInTheDocument();
    expect(screen.getByText('Senior')).toBeInTheDocument();
    expect(screen.getAllByText('will be added')).toHaveLength(2);
  });

  it('blocks an all-or-nothing import that has errors, and explains why', async () => {
    const server = mount(ALL, { rows: BAD_ROWS });
    await upload();
    expect(await screen.findByText(/1 row needs fixing before this file can be imported/, undefined, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import 1 row' })).toBeDisabled();
    expect(screen.getByText('Enter a code.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Download rows to fix' }));
    await waitFor(() => expect(server.calls.some((c) => c.path.endsWith('/errors.csv'))).toBe(true));
    await userEvent.click(screen.getByRole('tab', { name: /Need fixing/ }));
    await waitFor(() => expect(screen.queryByText('Primary')).not.toBeInTheDocument());
    expect(server.calls.some((c) => c.path.includes('/rows') && c.path.includes('status=error'))).toBe(true);
  });

  it('imports, then rolls back after confirming', async () => {
    const server = mount(ALL);
    await upload();
    await userEvent.click(await screen.findByRole('button', { name: 'Import 2 rows' }, { timeout: 4000 }));
    expect(await screen.findByText('2 rows imported.', undefined, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText(/You can undo this until 28 Nov 2026/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Roll back' }));
    expect(server.calls.some((c) => c.path.endsWith('/rollback'))).toBe(false); // asks first
    const group = screen.getByRole('group', { name: 'Confirm rollback' });
    await userEvent.click(within(group).getByRole('button', { name: 'Yes, roll back' }));
    expect(await screen.findByText('Rolled back 1 of 2 school divisions.', undefined, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText(/1 record was changed after the import/)).toBeInTheDocument();
  });

  it('can keep the import instead of rolling back', async () => {
    const server = mount(ALL);
    await upload();
    await userEvent.click(await screen.findByRole('button', { name: 'Import 2 rows' }, { timeout: 4000 }));
    await screen.findByText('2 rows imported.', undefined, { timeout: 4000 });
    await userEvent.click(screen.getByRole('button', { name: 'Roll back' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep it' }));
    expect(screen.getByRole('button', { name: 'Roll back' })).toBeInTheDocument();
    expect(server.calls.some((c) => c.path.endsWith('/rollback'))).toBe(false);
  });

  it('hides the rollback without its permission', async () => {
    mount(['onb.workspace.view', 'onb.imports.view', 'onb.imports.import', 'onb.imports.commit']);
    await upload();
    await userEvent.click(await screen.findByRole('button', { name: 'Import 2 rows' }, { timeout: 4000 }));
    await screen.findByText('2 rows imported.', undefined, { timeout: 4000 });
    expect(screen.queryByRole('button', { name: 'Roll back' })).not.toBeInTheDocument();
  });

  it('shows who cannot import why, instead of a dead button', async () => {
    mount(['onb.workspace.view', 'onb.imports.view', 'onb.imports.import']);
    await upload();
    const btn = await screen.findByRole('button', { name: 'Import 2 rows' }, { timeout: 4000 });
    expect(btn).toBeDisabled();
    expect(screen.getByText(/only someone with import approval can import it/)).toBeInTheDocument();
  });

  it('shows the reason when the server refuses the commit, and keeps the file open', async () => {
    mount(ALL, { commitError: { status: 409, code: 'conflict', detail: 'This file is already being imported.' } });
    await upload();
    await userEvent.click(await screen.findByRole('button', { name: 'Import 2 rows' }, { timeout: 4000 }));
    expect(await screen.findByText('This file is already being imported.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import 2 rows' })).toBeEnabled();
  });

  it('shows the server reason when an upload is refused', async () => {
    mount(ALL, { uploadError: { status: 400, code: 'validation_failed', errors: [{ field: 'file', code: 'missing_columns', message: 'The file is missing required columns: Name.' }] } });
    await upload();
    expect(await screen.findByText('The file is missing required columns: Name.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Check my file' })).toBeEnabled();
  });

  it('reopens an earlier file from the recent list', async () => {
    const earlier: ImportBatch = {
      id: 'old', entity: 'school_divisions', strategy: 'upsert', commitMode: 'all_or_nothing', status: 'committed', fileName: 'last-term.csv', totalRows: 2, validRows: 2, warningRows: 0, errorRows: 0,
      committedRows: 2, revertedRows: 0, progressDone: 2, progressTotal: 2, failure: null, createdAt: '2026-11-20T10:00:00Z', committedAt: '2026-11-20T10:05:00Z', rollbackDeadline: '2026-11-27T10:05:00Z', createdBy: 'u1', approvalRequired: false, approvedAt: null, rejectReason: null,
    };
    mount(ALL, { existing: [earlier] });
    expect(await screen.findByText('last-term.csv')).toBeInTheDocument();
    expect(screen.getByText(/School divisions · 2 rows · 20 Nov 2026/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open last-term.csv' }));
    expect(await screen.findByText('2 rows imported.')).toBeInTheDocument();
  });

  describe('academic setup checklist', () => {
    it('lists the steps in order with what each has and what to do next', async () => {
      mount(ALL, { pack: PACK });
      const panel = await screen.findByRole('region', { name: 'Academic structure setup' });
      const text = panel.querySelector('ol')!.textContent ?? '';
      const at = ['Academic years', 'Terms', 'School divisions', 'Classes', 'Rooms'].map((t) => text.indexOf(t));
      expect(at.every((n) => n >= 0)).toBe(true);
      expect([...at].sort((x, y) => x - y)).toEqual(at);
      expect(within(panel).getByText('0 of 2 required steps have data.')).toBeInTheDocument();
      expect(within(panel).getByText('Not ready yet')).toBeInTheDocument();
      expect(within(panel).getByText('Next')).toBeInTheDocument();
      expect(within(panel).getByText('Needs academic years first')).toBeInTheDocument();
      expect(within(panel).getByText('6 records')).toBeInTheDocument();
      expect(within(panel).getByText('Optional, not started')).toBeInTheDocument();
      expect(within(panel).getByText(/Checked once class-section and subject-class mappings/)).toBeInTheDocument();
      expect(within(panel).getByText(/not marked ready until every rule can be checked/)).toBeInTheDocument();
    });

    it('picks the step in the form when its Import button is used', async () => {
      mount(ALL, { pack: PACK });
      const panel = await screen.findByRole('region', { name: 'Academic structure setup' });
      expect(screen.getByLabelText('What are you importing?')).toHaveValue('school_divisions');
      await userEvent.click(within(panel).getByRole('button', { name: 'Import more rooms' }));
      expect(screen.getByLabelText('What are you importing?')).toHaveValue('rooms');
      await userEvent.click(within(panel).getByRole('button', { name: 'Import academic years' }));
      expect(screen.getByLabelText('What are you importing?')).toHaveValue('academic_years');
    });

    it('does not offer a step that is waiting for an earlier one, or a step the caller cannot import', async () => {
      mount(ALL, { pack: PACK });
      const panel = await screen.findByRole('region', { name: 'Academic structure setup' });
      expect(within(panel).getByRole('button', { name: 'Import terms' })).toBeDisabled();
      // classes are not in this caller's importable list, so the step has no button
      expect(within(panel).queryByRole('button', { name: /classes/i })).not.toBeInTheDocument();
    });

    it('disables the step buttons without the import permission', async () => {
      mount(['onb.workspace.view', 'onb.imports.view'], { pack: PACK });
      const panel = await screen.findByRole('region', { name: 'Academic structure setup' });
      expect(within(panel).getByRole('button', { name: 'Import academic years' })).toBeDisabled();
    });

    it('shows nothing when the caller has no access to the pack', async () => {
      mount(ALL);
      await screen.findByRole('heading', { name: 'Import data' });
      await screen.findByLabelText('What are you importing?');
      expect(screen.queryByRole('region', { name: 'Academic structure setup' })).not.toBeInTheDocument();
    });

    it('refreshes after an import, so the year is done and terms open up', async () => {
      mount(ALL, { pack: PACK });
      await screen.findByRole('region', { name: 'Academic structure setup' });
      await upload();
      await userEvent.click(await screen.findByRole('button', { name: 'Import 2 rows' }, { timeout: 4000 }));
      await screen.findByText('2 rows imported.', undefined, { timeout: 4000 });
      await userEvent.click(screen.getByRole('button', { name: 'Done' }));
      const panel = await screen.findByRole('region', { name: 'Academic structure setup' });
      await waitFor(() => expect(within(panel).getByText('1 record')).toBeInTheDocument());
      expect(within(panel).queryByText('Needs academic years first')).not.toBeInTheDocument();
      expect(within(panel).getByText('1 of 2 required steps have data.')).toBeInTheDocument();
    });
  });

  describe('approval before import', () => {
    const REVIEW = [...ALL, 'onb.imports.review'];

    it('makes the uploader wait: no import button, and a clear explanation', async () => {
      mount(REVIEW, { approval: { uploader: 'me' } });
      await upload();
      expect(await screen.findByText('Waiting for approval', undefined, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.getByText(/You uploaded this file, so an admin or principal other than you has to approve it/)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Import \d+ rows?$/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Approve and import/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Reject/ })).not.toBeInTheDocument();
    });

    it('lets someone else approve, which imports the file', async () => {
      const server = mount(REVIEW, { approval: { uploader: 'other' }, existing: [] });
      await upload();
      await userEvent.click(await screen.findByRole('button', { name: 'Approve and import 2 rows' }, { timeout: 4000 }));
      expect(await screen.findByText('2 rows imported.', undefined, { timeout: 4000 })).toBeInTheDocument();
      expect(server.calls.some((c) => c.path.endsWith('/approve') && c.method === 'POST')).toBe(true);
      expect(server.calls.some((c) => c.path.endsWith('/commit'))).toBe(false);
    });

    it('rejects with a reason, shows it, and stops asking the server', async () => {
      const server = mount(REVIEW, { approval: { uploader: 'other' } });
      await upload();
      await userEvent.click(await screen.findByRole('button', { name: 'Reject…' }, { timeout: 4000 }));
      const send = screen.getByRole('button', { name: 'Reject file' });
      expect(send).toBeDisabled(); // a reason is required
      await userEvent.type(screen.getByLabelText('Why are you rejecting it?'), 'Wrong academic year.');
      await userEvent.click(send);
      expect(await screen.findByText('This file was rejected. Nothing was imported.')).toBeInTheDocument();
      expect(screen.getByText('Wrong academic year.')).toBeInTheDocument();
      const polls = () => server.calls.filter((c) => c.path === '/onboarding/imports/b1').length;
      const before = polls();
      await new Promise((r) => setTimeout(r, 120));
      expect(polls()).toBe(before); // a rejected file is final, so polling has stopped
    });

    it('can cancel a rejection without sending anything', async () => {
      const server = mount(REVIEW, { approval: { uploader: 'other' } });
      await upload();
      await userEvent.click(await screen.findByRole('button', { name: 'Reject…' }, { timeout: 4000 }));
      await userEvent.type(screen.getByLabelText('Why are you rejecting it?'), 'x');
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(screen.getByRole('button', { name: 'Approve and import 2 rows' })).toBeInTheDocument();
      expect(server.calls.some((c) => c.path.endsWith('/reject'))).toBe(false);
    });

    it('tells someone without review rights that approval is needed, and offers nothing', async () => {
      mount(ALL, { approval: { uploader: 'other' } });
      await upload();
      expect(await screen.findByText('An admin or principal has to approve this file before it is imported.', undefined, { timeout: 4000 })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Approve and import/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Reject/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /^Import \d+ rows?$/ })).not.toBeInTheDocument();
    });

    it('does not offer approval for a file with errors that must all be valid, but still allows rejecting', async () => {
      mount(REVIEW, { approval: { uploader: 'other' }, rows: BAD_ROWS });
      await upload();
      const approve = await screen.findByRole('button', { name: 'Approve and import 1 row' }, { timeout: 4000 });
      expect(approve).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Reject…' })).toBeEnabled();
    });

    it('shows the server reason when an approval is refused', async () => {
      mount(REVIEW, { approval: { uploader: 'other' }, approveError: { status: 409, code: 'conflict', detail: 'This file was just rejected.' } });
      await upload();
      await userEvent.click(await screen.findByRole('button', { name: 'Approve and import 2 rows' }, { timeout: 4000 }));
      expect(await screen.findByText('This file was just rejected.')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Approve and import 2 rows' })).toBeEnabled();
    });

    it('labels a waiting file in the recent list and reopens it for the approver', async () => {
      const waiting: ImportBatch = {
        id: 'w1', entity: 'school_divisions', strategy: 'upsert', commitMode: 'all_or_nothing', status: 'validated', fileName: 'waiting.csv', totalRows: 2, validRows: 2, warningRows: 0, errorRows: 0,
        committedRows: 0, revertedRows: 0, progressDone: 0, progressTotal: 2, failure: null, createdAt: '2026-11-20T10:00:00Z', committedAt: null, rollbackDeadline: null, createdBy: 'u2',
        approvalRequired: true, approvedAt: null, rejectReason: null,
      };
      mount(REVIEW, { existing: [waiting], approval: { uploader: 'other' } });
      expect((await screen.findAllByText('waiting.csv')).length).toBe(2); // in the approver's list and in recent files
      expect(screen.getByText('Waiting for approval', { selector: 'span' })).toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Open waiting.csv' }));
      expect(await screen.findByRole('button', { name: 'Approve and import 2 rows' })).toBeEnabled();
    });
  });

  describe('finding files that wait, and the approval switch', () => {
    const waitingFile = (over: Partial<ImportBatch> = {}): ImportBatch => ({
      id: 'w1', entity: 'school_divisions', strategy: 'upsert', commitMode: 'all_or_nothing', status: 'validated', fileName: 'waiting.csv', totalRows: 3, validRows: 3, warningRows: 0, errorRows: 0,
      committedRows: 0, revertedRows: 0, progressDone: 0, progressTotal: 3, failure: null, createdAt: '2026-11-20T10:00:00Z', committedAt: null, rollbackDeadline: null, createdBy: 'u2',
      approvalRequired: true, approvedAt: null, rejectReason: null, ...over,
    });
    const REVIEW = [...ALL, 'onb.imports.review'];
    const MANAGE = [...REVIEW, 'onb.maker_checker.view', 'onb.maker_checker.manage'];

    it('shows an approver the files other people uploaded, and opens one to review', async () => {
      mount(REVIEW, { existing: [waitingFile(), waitingFile({ id: 'w2', fileName: 'mine.csv', createdBy: 'u1' })] });
      const section = await screen.findByRole('region', { name: 'Waiting for your approval' });
      expect(within(section).getByText('waiting.csv')).toBeInTheDocument();
      expect(within(section).queryByText('mine.csv')).not.toBeInTheDocument(); // an approver cannot approve their own file
      expect(within(section).getByText(/3 rows ready/)).toBeInTheDocument();
      await userEvent.click(within(section).getByRole('button', { name: 'Review waiting.csv' }));
      expect(await screen.findByRole('button', { name: 'Approve and import 3 rows' })).toBeEnabled();
    });

    it('shows nothing of the kind to someone who cannot review', async () => {
      mount(ALL, { existing: [waitingFile()] });
      await screen.findByText('Recent files');
      expect(screen.queryByRole('region', { name: 'Waiting for your approval' })).not.toBeInTheDocument();
    });

    it('shows no section when nothing is waiting', async () => {
      mount(REVIEW, { existing: [] });
      await screen.findByLabelText('What are you importing?');
      expect(screen.queryByRole('region', { name: 'Waiting for your approval' })).not.toBeInTheDocument();
    });

    it('shows the approval switch to someone who can manage it', async () => {
      mount(MANAGE, { approvalSetting: true });
      const card = await screen.findByRole('region', { name: 'Approval' });
      expect(within(card).getByRole('checkbox')).toBeChecked();
      expect(within(card).getByRole('checkbox')).toBeEnabled();
    });

    it('asks before turning approval off, and does nothing when the answer is to keep it', async () => {
      const server = mount(MANAGE, { approvalSetting: true });
      const card = await screen.findByRole('region', { name: 'Approval' });
      await userEvent.click(within(card).getByRole('checkbox'));
      const confirm = within(card).getByRole('group', { name: 'Confirm turning approval off' });
      expect(server.calls.some((c) => c.method === 'PUT')).toBe(false); // nothing is sent before the answer
      await userEvent.click(within(confirm).getByRole('button', { name: 'Keep it on' }));
      expect(within(card).queryByRole('group', { name: 'Confirm turning approval off' })).not.toBeInTheDocument();
      expect(within(card).getByRole('checkbox')).toBeChecked();
      expect(server.calls.some((c) => c.method === 'PUT')).toBe(false);
    });

    it('turns approval off after confirming, and says so', async () => {
      const server = mount(MANAGE, { approvalSetting: true });
      const card = await screen.findByRole('region', { name: 'Approval' });
      await userEvent.click(within(card).getByRole('checkbox'));
      await userEvent.click(within(card).getByRole('button', { name: 'Turn approval off' }));
      expect(await within(card).findByRole('status')).toHaveTextContent('Approval is off.');
      expect(within(card).getByRole('checkbox')).not.toBeChecked();
      const put = server.calls.find((c) => c.method === 'PUT' && c.path === '/onboarding/settings')!;
      expect(put).toBeDefined();
    });

    it('turns approval on straight away, without a question', async () => {
      const server = mount(MANAGE, { approvalSetting: false });
      const card = await screen.findByRole('region', { name: 'Approval' });
      expect(within(card).getByRole('checkbox')).not.toBeChecked();
      await userEvent.click(within(card).getByRole('checkbox'));
      expect(await within(card).findByRole('status')).toHaveTextContent('Approval is on.');
      expect(within(card).getByRole('checkbox')).toBeChecked();
      expect(within(card).queryByRole('group')).not.toBeInTheDocument();
      expect(server.calls.filter((c) => c.method === 'PUT')).toHaveLength(1);
    });

    it('lets a viewer see the switch but not change it', async () => {
      mount([...REVIEW, 'onb.maker_checker.view'], { approvalSetting: true });
      const card = await screen.findByRole('region', { name: 'Approval' });
      expect(within(card).getByRole('checkbox')).toBeDisabled();
      expect(within(card).getByText('Only someone who manages approval can change this.')).toBeInTheDocument();
    });

    it('hides the switch entirely without the view permission', async () => {
      const server = mount(REVIEW, { approvalSetting: true });
      await screen.findByLabelText('What are you importing?');
      expect(screen.queryByRole('region', { name: 'Approval' })).not.toBeInTheDocument();
      expect(server.calls.some((c) => c.path === '/onboarding/settings')).toBe(false); // it does not even ask
    });

    it('shows the server reason when the change is refused and leaves the switch as it was', async () => {
      mount(MANAGE, { approvalSetting: false, settingsError: { status: 403, code: 'permission_denied', detail: 'You do not have permission to do this.' } });
      const card = await screen.findByRole('region', { name: 'Approval' });
      await userEvent.click(within(card).getByRole('checkbox'));
      expect(await within(card).findByRole('alert')).toHaveTextContent('You do not have permission to do this.');
      expect(within(card).getByRole('checkbox')).not.toBeChecked();
    });
  });
});
