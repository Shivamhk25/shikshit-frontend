import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeAll, describe, expect, it } from 'vitest';
import { createWebSession } from '../../shell/web-session';
import { ShellApp } from '../../shell/ShellApp';
import { pollConfig } from './pollConfig';
import type { BatchStatus, ImportBatch, ImportRow } from './importApi';

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
];

interface Opts {
  /** Rows the file contains, with the verdict the server gives each. */
  rows?: ImportRow[];
  uploadError?: { status: number; code: string; detail?: string; errors?: { field: string; code: string; message: string }[] };
  commitError?: { status: number; code: string; detail: string };
  existing?: ImportBatch[];
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
  let polls = 0;
  let waits = 0; // polls seen since the last commit or rollback: the work takes a few polls, as on a real server
  const json = (status: number, body: unknown, h: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...h } });
  const problem = (status: number, body: Record<string, unknown>) => json(status, { status, ...body });
  const mk = (over: Partial<ImportBatch>): ImportBatch => ({
    id: 'b1', entity: 'school_divisions', strategy: 'upsert', commitMode: 'all_or_nothing', status: 'uploaded', fileName: 'x.csv', totalRows: rows.length, validRows: 0, warningRows: 0,
    errorRows: 0, committedRows: 0, revertedRows: 0, progressDone: 0, progressTotal: rows.length, failure: null, createdAt: '2026-11-21T10:00:00Z', committedAt: null, rollbackDeadline: null, ...over,
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
    if (path === '/onboarding/templates/school_divisions') return new Response('Code,Name\nPRI,Primary\n', { status: 200, headers: { 'Content-Type': 'text/csv' } });
    if (path === '/onboarding/imports' && method === 'POST') {
      if (opts.uploadError) return problem(opts.uploadError.status, opts.uploadError);
      batch = mk({ strategy: form!.strategy as ImportBatch['strategy'], commitMode: form!.commitMode as ImportBatch['commitMode'], fileName: form!.file!.replace('file:', '') });
      polls = 0;
      return json(202, batch);
    }
    if (path === '/onboarding/imports' && method === 'GET') return json(200, { items: opts.existing ?? (batch ? [batch] : []), page: { number: 1, size: 8, total: 1 } });
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
        else if (batch.status === 'validating' && polls > 1) setStatus('validated');
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
        setStatus('committing');
        return json(202, batch);
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
    const server = mount(ALL);
    await userEvent.click(await screen.findByLabelText(/Add new only/));
    await userEvent.click(screen.getByLabelText(/Import the valid rows/));
    await upload();

    expect(await screen.findByRole('status')).toHaveTextContent('Checking divisions.csv');
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
      committedRows: 2, revertedRows: 0, progressDone: 2, progressTotal: 2, failure: null, createdAt: '2026-11-20T10:00:00Z', committedAt: '2026-11-20T10:05:00Z', rollbackDeadline: '2026-11-27T10:05:00Z',
    };
    mount(ALL, { existing: [earlier] });
    expect(await screen.findByText('last-term.csv')).toBeInTheDocument();
    expect(screen.getByText(/School divisions · 2 rows · 20 Nov 2026/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Open last-term.csv' }));
    expect(await screen.findByText('2 rows imported.')).toBeInTheDocument();
  });
});
