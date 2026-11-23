import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Toaster } from 'sonner';
import { AccessProvider } from '../../shell/AccessProvider';
import { AuthProvider } from '../../shell/AuthProvider';
import { createWebSession } from '../../shell/web-session';
import { documentProblem, DOCUMENT_TYPES, StudentDocuments, type StudentDocument } from './StudentDocuments';

const ALL = ['stu.student_documents.view', 'stu.student_documents.create', 'stu.student_documents.edit', 'stu.student_documents.delete'];

const doc = (n: number, over: Partial<StudentDocument> = {}): StudentDocument => ({
  id: `d${n}`, documentType: 'birth_certificate', title: `Birth certificate ${n}`, contentType: 'application/pdf', sizeBytes: 250 * 1024, validUntil: null,
  uploadedAt: '2026-11-10T09:00:00Z', uploadedBy: 'Asha Verma', verifiedAt: null, verifiedBy: null, ...over,
});

function mount(permissions: string[], initial: StudentDocument[], opts: { scopes?: string[]; confirmFails?: boolean } = {}) {
  let rows = [...initial];
  const calls: { method: string; path: string; body?: Record<string, unknown> }[] = [];
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://x');
    const path = url.pathname.replace('/api/v1', '');
    const method = init?.method ?? 'GET';
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined;
    calls.push({ method, path, body });
    if (path === '/auth/refresh') return json(200, { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 9e5).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 9e8).toISOString(), mustChangePassword: false });
    if (path === '/me/access') {
      return json(200, {
        user: { id: 'u1', name: 'Asha', tier: 'tenant' }, tenant: { id: 't1', name: 'School', brand: { primary: '#2F5BFF' }, modules: ['stu'] }, permissions,
        scopes: { 'stu.student_documents': opts.scopes ?? ['tenant'] }, fieldMasks: {}, workspace: { home: 'x', navigation: [] }, mobile: { tabs: [], features: [] }, approvals: { canApprove: [] }, version: 1,
      });
    }
    if (path === '/students/s1/documents/upload') return json(201, { fileId: 'f1', uploadUrl: 'https://storage.test/t/x/student_document/f1?sig=1', headers: { 'Content-Type': 'application/pdf' }, expiresAt: '' });
    if (path === '/students/s1/documents' && method === 'POST') {
      if (opts.confirmFails) return json(400, { code: 'bad_upload', detail: 'The upload did not arrive, or it is not a PDF, JPEG or PNG file of at most 10 MB. Try again.' });
      rows = [doc(9, { title: String(body?.title), documentType: String(body?.documentType), validUntil: (body?.validUntil as string | null) ?? null }), ...rows];
      return json(201, rows[0]);
    }
    if (path === '/students/s1/documents') return json(200, { items: rows });
    const m = /^\/students\/s1\/documents\/(d\d+)(\/download|\/verify)?$/.exec(path);
    if (m && m[2] === '/download') return json(200, { url: `https://storage.test/${m[1]}?sig=2`, contentType: 'application/pdf', disposition: 'attachment', expiresAt: '' });
    if (m && m[2] === '/verify') {
      rows = rows.map((r) => (r.id === m[1] ? { ...r, verifiedAt: '2026-11-12T09:00:00Z', verifiedBy: 'Asha' } : r));
      return json(200, rows.find((r) => r.id === m[1]));
    }
    if (m && method === 'DELETE') {
      rows = rows.filter((r) => r.id !== m[1]);
      return new Response(null, { status: 204 });
    }
    return json(404, {});
  }) as typeof fetch;
  const uploads: { url: string; auth: string | null; type: string | null }[] = [];
  const uploadFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const h = new Headers(init?.headers);
    uploads.push({ url: String(input), auth: h.get('Authorization'), type: h.get('Content-Type') });
    return new Response(null, { status: 200 });
  }) as typeof fetch;
  const session = createWebSession(fetchFn);
  void session.restore();
  render(
    <AuthProvider session={session}>
      <AccessProvider>
        <StudentDocuments studentId="s1" uploadFetch={uploadFetch} />
        <Toaster />
      </AccessProvider>
    </AuthProvider>,
  );
  return { calls, uploads };
}

const pdf = () => new File([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2])], 'bc.pdf', { type: 'application/pdf' });

describe('student documents', () => {
  it('checks the file before sending it, and offers only the fixed list of types', () => {
    expect(documentProblem({ type: 'text/html', size: 10 })).toMatch(/PDF, JPEG or PNG/);
    expect(documentProblem({ type: 'image/svg+xml', size: 10 })).toMatch(/PDF, JPEG or PNG/);
    expect(documentProblem({ type: 'application/pdf', size: 11 * 1024 * 1024 })).toMatch(/10 MB/);
    expect(documentProblem({ type: 'application/pdf', size: 0 })).toMatch(/empty/);
    expect(documentProblem({ type: 'image/png', size: 10 })).toBeNull();
    expect(DOCUMENT_TYPES.map((t) => t.value)).toEqual(['birth_certificate', 'transfer_certificate', 'previous_marksheet', 'migration_certificate', 'medical_certificate', 'parent_id_proof', 'address_proof', 'other']);
  });

  it('shows an empty state with the upload form', async () => {
    mount(ALL, []);
    expect(await screen.findByText('No documents yet')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Upload document/ })).toBeInTheDocument();
  });

  it('lists documents with verification and expiry', async () => {
    mount(ALL, [doc(1, { verifiedAt: '2026-11-11T09:00:00Z', verifiedBy: 'Meera Rao' }), doc(2, { title: 'ID proof', documentType: 'parent_id_proof', contentType: 'image/png', validUntil: '2020-01-01' })]);
    expect(await screen.findByText('Birth certificate 1')).toBeInTheDocument();
    expect(screen.getByText(/Verified by Meera Rao on 11 Nov 2026/)).toBeInTheDocument();
    expect(screen.getByText('Not verified yet')).toBeInTheDocument();
    expect(screen.getByText(/Expired on/)).toBeInTheDocument();
  });

  it('is hidden without the permission or when the grant is not school-wide', async () => {
    const { calls } = mount(['stu.students.view'], [doc(1)]);
    await waitFor(() => expect(calls.some((c) => c.path === '/me/access')).toBe(true));
    expect(screen.queryByText('Documents')).not.toBeInTheDocument();
    expect(calls.some((c) => c.path === '/students/s1/documents')).toBe(false);
  });

  it('hides the class-section grant', async () => {
    const { calls } = mount(ALL, [doc(1)], { scopes: ['class_section:1'] });
    await waitFor(() => expect(calls.some((c) => c.path === '/me/access')).toBe(true));
    expect(screen.queryByText('Documents')).not.toBeInTheDocument();
  });

  it('shows no write controls to a view-only user', async () => {
    mount(['stu.student_documents.view'], [doc(1)]);
    expect(await screen.findByText('Birth certificate 1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Open Birth certificate 1' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mark/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Upload document/ })).not.toBeInTheDocument();
  });

  it('uploads straight to storage without the sign-in token, then saves the details', async () => {
    const { calls, uploads } = mount(ALL, []);
    await screen.findByText('No documents yet');
    await userEvent.selectOptions(screen.getByLabelText('Kind of document *'), 'transfer_certificate');
    expect(screen.getByLabelText('Title *')).toHaveValue('Transfer certificate');
    await userEvent.upload(screen.getByLabelText('File *'), pdf());
    await userEvent.click(screen.getByRole('button', { name: /Upload document/ }));
    expect(await screen.findByText('Document saved')).toBeInTheDocument();
    expect(uploads).toEqual([{ url: 'https://storage.test/t/x/student_document/f1?sig=1', auth: null, type: 'application/pdf' }]);
    expect(calls.find((c) => c.path.endsWith('/documents/upload'))?.body).toEqual({ contentType: 'application/pdf', sizeBytes: 7 });
    expect(calls.find((c) => c.method === 'POST' && c.path === '/students/s1/documents')?.body).toEqual({ fileId: 'f1', documentType: 'transfer_certificate', title: 'Transfer certificate', validUntil: null });
    expect(await screen.findByRole('button', { name: 'Open Transfer certificate' })).toBeInTheDocument();
  });

  it('asks for the missing details and sends nothing', async () => {
    const { uploads } = mount(ALL, []);
    await screen.findByText('No documents yet');
    await userEvent.click(screen.getByRole('button', { name: /Upload document/ }));
    expect(await screen.findByText('Choose the kind of document.')).toBeInTheDocument();
    expect(screen.getByText('Give the document a title.')).toBeInTheDocument();
    expect(screen.getByText('Choose a file.')).toBeInTheDocument();
    expect(uploads).toHaveLength(0);
  });

  it('refuses a wrong file type without contacting the server', async () => {
    const { uploads } = mount(ALL, []);
    await screen.findByText('No documents yet');
    await userEvent.selectOptions(screen.getByLabelText('Kind of document *'), 'other');
    await userEvent.upload(screen.getByLabelText('File *'), new File(['<svg/>'], 'x.svg', { type: 'image/svg+xml' }), { applyAccept: false });
    await userEvent.click(screen.getByRole('button', { name: /Upload document/ }));
    expect(await screen.findByText('Choose a PDF, JPEG or PNG file.')).toBeInTheDocument();
    expect(uploads).toHaveLength(0);
  });

  it('shows why the server rejected an upload', async () => {
    mount(ALL, [], { confirmFails: true });
    await screen.findByText('No documents yet');
    await userEvent.selectOptions(screen.getByLabelText('Kind of document *'), 'other');
    await userEvent.upload(screen.getByLabelText('File *'), pdf());
    await userEvent.click(screen.getByRole('button', { name: /Upload document/ }));
    expect(await screen.findByText(/is not a PDF, JPEG or PNG file/)).toBeInTheDocument();
  });

  it('marks a document verified', async () => {
    const { calls } = mount(ALL, [doc(1)]);
    await userEvent.click(await screen.findByRole('button', { name: 'Mark verified: Birth certificate 1' }));
    expect(await screen.findByText(/Verified by Asha on 12 Nov 2026/)).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST' && c.path === '/students/s1/documents/d1/verify')).toBe(true);
    expect(screen.queryByRole('button', { name: /Mark verified/ })).not.toBeInTheDocument();
  });

  it('deletes only after a confirmation', async () => {
    const { calls } = mount(ALL, [doc(1)]);
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Birth certificate 1' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep it' }));
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Delete Birth certificate 1' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete document' }));
    expect(await screen.findByText('No documents yet')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'DELETE' && c.path === '/students/s1/documents/d1')).toBe(true);
  });

  it('asks for a fresh link each time a document is opened', async () => {
    const { calls } = mount(ALL, [doc(1)]);
    await userEvent.click(await screen.findByRole('button', { name: 'Open Birth certificate 1' }));
    await waitFor(() => expect(calls.some((c) => c.path === '/students/s1/documents/d1/download')).toBe(true));
  });
});
