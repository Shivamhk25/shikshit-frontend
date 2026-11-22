import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Toaster } from 'sonner';
import { AuthProvider } from '../../shell/AuthProvider';
import { createWebSession } from '../../shell/web-session';
import { photoProblem, StudentPhoto } from './StudentPhoto';

function mount(opts: { hasPhoto?: boolean; confirmFails?: boolean } = {}) {
  const calls: { method: string; url: string; auth: string | null; body?: unknown }[] = [];
  let photo = opts.hasPhoto ?? false;
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    calls.push({ method, url, auth: new Headers(init?.headers).get('Authorization'), body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined });
    const p = new URL(url, 'http://x').pathname.replace('/api/v1', '');
    if (p === '/auth/refresh') return json(200, { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 9e5).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 9e8).toISOString(), mustChangePassword: false });
    if (p === '/students/s1/photo/upload') return json(201, { fileId: 'f1', uploadUrl: 'https://storage.test/t/x/student_photo/f1?sig=1', headers: { 'Content-Type': 'image/png' }, expiresAt: '' });
    if (p === '/students/s1/photo' && method === 'PUT') {
      if (opts.confirmFails) return json(400, { code: 'bad_upload', detail: 'The upload did not arrive, or it is not a JPEG, PNG or WebP photo of at most 5 MB. Try again.' });
      photo = true;
      return new Response(null, { status: 204 });
    }
    if (p === '/students/s1/photo' && method === 'DELETE') {
      photo = false;
      return new Response(null, { status: 204 });
    }
    if (p === '/students/s1/photo') return photo ? json(200, { url: 'https://storage.test/photo.png?sig=2', expiresAt: '' }) : json(404, {});
    return json(404, {});
  }) as typeof fetch;
  const uploads: { url: string; headers: Headers; auth: string | null }[] = [];
  const uploadFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const h = new Headers(init?.headers);
    uploads.push({ url: String(input), headers: h, auth: h.get('Authorization') });
    return new Response(null, { status: 200 });
  }) as typeof fetch;
  const session = createWebSession(fetchFn);
  void session.restore();
  render(
    <AuthProvider session={session}>
      <StudentPhoto studentId="s1" name="Asha Kumar" uploadFetch={uploadFetch} />
      <Toaster />
    </AuthProvider>,
  );
  return { calls, uploads };
}

const png = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])], 'asha.png', { type: 'image/png' });

describe('student photo', () => {
  it('checks the file before sending it', () => {
    expect(photoProblem({ type: 'image/gif', size: 10 })).toMatch(/JPEG, PNG or WebP/);
    expect(photoProblem({ type: 'image/png', size: 6 * 1024 * 1024 })).toMatch(/5 MB/);
    expect(photoProblem({ type: 'image/webp', size: 10 })).toBeNull();
  });

  it('uploads straight to storage without the sign-in token, then confirms and shows it', async () => {
    const { calls, uploads } = mount();
    expect(await screen.findByText('AK')).toBeInTheDocument();
    await userEvent.upload(screen.getByLabelText('Add photo'), png());
    expect(await screen.findByRole('img', { name: 'Photo of Asha Kumar' })).toHaveAttribute('src', 'https://storage.test/photo.png?sig=2');
    expect(uploads).toHaveLength(1);
    expect(uploads[0].url).toBe('https://storage.test/t/x/student_photo/f1?sig=1');
    expect(uploads[0].headers.get('Content-Type')).toBe('image/png');
    expect(uploads[0].auth).toBeNull();
    expect(calls.find((c) => c.method === 'POST' && c.url.endsWith('/photo/upload'))?.body).toEqual({ contentType: 'image/png', sizeBytes: 7 });
    expect(calls.find((c) => c.method === 'PUT')?.body).toEqual({ fileId: 'f1' });
  });

  it('refuses a wrong file type without contacting the server', async () => {
    const { uploads } = mount();
    await screen.findByText('AK');
    await userEvent.upload(screen.getByLabelText('Add photo'), new File(['GIF89a'], 'x.gif', { type: 'image/gif' }), { applyAccept: false });
    expect(await screen.findByText('Choose a JPEG, PNG or WebP photo.')).toBeInTheDocument();
    expect(uploads).toHaveLength(0);
  });

  it('shows why the server rejected an upload', async () => {
    mount({ confirmFails: true });
    await screen.findByText('AK');
    await userEvent.upload(screen.getByLabelText('Add photo'), png());
    expect(await screen.findByText(/did not arrive, or it is not/)).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Photo of/ })).not.toBeInTheDocument();
  });

  it('removes a photo', async () => {
    mount({ hasPhoto: true });
    await screen.findByRole('img', { name: 'Photo of Asha Kumar' });
    await userEvent.click(screen.getByRole('button', { name: /Remove/ }));
    expect(await screen.findByText('Photo removed')).toBeInTheDocument();
    expect(screen.getByText('AK')).toBeInTheDocument();
  });
});
