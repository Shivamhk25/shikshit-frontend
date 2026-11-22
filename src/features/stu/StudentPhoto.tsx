import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../design-system';
import { useAuth } from '../../shell/AuthProvider';
import { API_BASE } from '../../shell/web-session';

/** A student's photo in the edit sheet (FND-17, decision 0020). The file goes straight to storage with a signed link;
 * the server then checks the real bytes. Links to view it last 5 minutes and every view is recorded. */

// eslint-disable-next-line react-refresh/only-export-components
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
// eslint-disable-next-line react-refresh/only-export-components
export const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/** Why a file cannot be a photo, or null when it can (the server checks again with the real bytes). */
// eslint-disable-next-line react-refresh/only-export-components
export function photoProblem(f: { type: string; size: number }): string | null {
  if (!PHOTO_TYPES.includes(f.type)) return 'Choose a JPEG, PNG or WebP photo.';
  if (f.size > PHOTO_MAX_BYTES) return 'The photo is larger than 5 MB.';
  if (f.size === 0) return 'The file is empty.';
  return null;
}

type Problem = { detail?: string };
const detail = async (res: Response) => ((await res.json().catch(() => ({}))) as Problem).detail ?? 'Something went wrong. Please try again.';

export function StudentPhoto({ studentId, name, uploadFetch = (...a) => fetch(...a) }: { studentId: string; name: string; uploadFetch?: typeof fetch }) {
  const { session } = useAuth();
  const [src, setSrc] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const base = `${API_BASE}/students/${studentId}/photo`;

  const load = useCallback(async () => {
    try {
      const res = await session.fetch(base);
      setSrc(res.ok ? ((await res.json()) as { url: string }).url : null);
    } catch {
      setSrc(null);
    }
  }, [session, base]);
  useEffect(() => void load(), [load]);

  const upload = async (file: File) => {
    const problem = photoProblem(file);
    if (problem) return toast.error(problem);
    setBusy(true);
    try {
      const begin = await session.fetch(`${base}/upload`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contentType: file.type, sizeBytes: file.size }) });
      if (!begin.ok) throw new Error(await detail(begin));
      const u = (await begin.json()) as { fileId: string; uploadUrl: string; headers: Record<string, string> };
      // straight to storage: no Authorization header, only the signed link and the headers it was signed with
      const put = await uploadFetch(u.uploadUrl, { method: 'PUT', headers: u.headers, body: file });
      if (!put.ok) throw new Error('The upload did not go through. Check your connection and try again.');
      const done = await session.fetch(base, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ fileId: u.fileId }) });
      if (!done.ok) throw new Error(await detail(done));
      toast.success('Photo saved');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      const res = await session.fetch(base, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) throw new Error(await detail(res));
      setSrc(null);
      toast.success('Photo removed');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  const initials = name.trim().split(/\s+/).map((p) => p[0] ?? '').slice(0, 2).join('').toUpperCase() || '?';
  return (
    <div className="flex items-center gap-4 rounded-lg border border-line-subtle bg-canvas p-4">
      {src ? (
        <img src={src} alt={`Photo of ${name}`} className="size-16 shrink-0 rounded-full border border-line-subtle object-cover" />
      ) : (
        <span aria-hidden="true" className="flex size-16 shrink-0 items-center justify-center rounded-full bg-subtle font-display text-xl text-fg-muted">
          {initials}
        </span>
      )}
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-sm text-fg-muted">JPEG, PNG or WebP, up to 5 MB.</p>
        <div className="flex flex-wrap gap-2">
          <input ref={input} type="file" accept={PHOTO_TYPES.join(',')} className="sr-only" id={`photo-${studentId}`} aria-label={src ? 'Change photo' : 'Add photo'} onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} />
          <Button type="button" size="sm" variant="secondary" loading={busy} onClick={() => input.current?.click()}>
            <Camera aria-hidden="true" className="size-4" />
            {src ? 'Change photo' : 'Add photo'}
          </Button>
          {src ? (
            <Button type="button" size="sm" variant="ghost" className="hover:text-danger" disabled={busy} onClick={() => void remove()}>
              <Trash2 aria-hidden="true" className="size-4" />
              Remove
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
