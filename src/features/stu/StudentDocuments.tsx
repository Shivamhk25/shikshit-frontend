import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { BadgeCheck, Download, FileText, Image as ImageIcon, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { Button, ConfirmDialog, Input } from '../../design-system';
import { useAccessState } from '../../shell/AccessProvider';
import { useAuth } from '../../shell/AuthProvider';
import { API_BASE } from '../../shell/web-session';
import { formatDate } from '../adm/dates';

/** A student's documents in the edit sheet (STU-03, decision 0020). The file goes straight to storage with a signed link;
 * the server then checks the real bytes. Links to open a file last 5 minutes and every list and download is recorded.
 * Shown only to people who hold the documents permission for the whole school; the server refuses everyone else. */

// eslint-disable-next-line react-refresh/only-export-components
export const DOCUMENT_TYPES = [
  { value: 'birth_certificate', label: 'Birth certificate' },
  { value: 'transfer_certificate', label: 'Transfer certificate' },
  { value: 'previous_marksheet', label: 'Previous marksheet or report card' },
  { value: 'migration_certificate', label: 'Migration certificate' },
  { value: 'medical_certificate', label: 'Medical or fitness certificate' },
  { value: 'parent_id_proof', label: 'Parent ID proof' },
  { value: 'address_proof', label: 'Address proof' },
  { value: 'other', label: 'Other' },
];
// eslint-disable-next-line react-refresh/only-export-components
export const DOCUMENT_ACCEPT = 'application/pdf,image/jpeg,image/png';
// eslint-disable-next-line react-refresh/only-export-components
export const DOCUMENT_TYPES_ALLOWED = DOCUMENT_ACCEPT.split(',');
// eslint-disable-next-line react-refresh/only-export-components
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;

/** Why a file cannot be a document, or null when it can (the server checks again with the real bytes). */
// eslint-disable-next-line react-refresh/only-export-components
export function documentProblem(f: { type: string; size: number }): string | null {
  if (!DOCUMENT_TYPES_ALLOWED.includes(f.type)) return 'Choose a PDF, JPEG or PNG file.';
  if (f.size > DOCUMENT_MAX_BYTES) return 'The file is larger than 10 MB.';
  if (f.size === 0) return 'The file is empty.';
  return null;
}

export interface StudentDocument {
  id: string;
  documentType: string;
  title: string;
  contentType: string;
  sizeBytes: number;
  validUntil: string | null;
  uploadedAt: string;
  uploadedBy: string | null;
  verifiedAt: string | null;
  verifiedBy: string | null;
}

/** The school's calendar day (India) of an instant. */
const istDay = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
};
const typeLabel = (v: string) => DOCUMENT_TYPES.find((t) => t.value === v)?.label ?? v;
const size = (n: number) => (n >= 1024 * 1024 ? `${(n / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
/** Today's date in India, as the school keeps dates. */
const todayIst = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

type Problem = { detail?: string; errors?: { message?: string }[] };
const detail = async (res: Response) => {
  const p = (await res.json().catch(() => ({}))) as Problem;
  return p.errors?.[0]?.message ?? p.detail ?? 'Something went wrong. Please try again.';
};

/** Opens a short-lived link: a PDF downloads, an image opens in a new tab. */
function openLink(url: string) {
  const a = document.createElement('a');
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  document.body.appendChild(a);
  a.click();
  a.remove();
}

const field = 'h-10 w-full rounded-md border border-line bg-surface px-3 text-base text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring';

export function StudentDocuments({ studentId, uploadFetch = (...a) => fetch(...a) }: { studentId: string; uploadFetch?: typeof fetch }) {
  const state = useAccessState();
  const allowed = state.phase === 'ready' && state.access.can('stu.student_documents.view') && state.access.scopesFor('stu.student_documents').includes('tenant');
  const can = (code: string) => state.phase === 'ready' && state.access.can(code);
  if (!allowed) return null;
  return <Documents studentId={studentId} uploadFetch={uploadFetch} canCreate={can('stu.student_documents.create')} canVerify={can('stu.student_documents.edit')} canDelete={can('stu.student_documents.delete')} />;
}

function Documents({ studentId, uploadFetch, canCreate, canVerify, canDelete }: { studentId: string; uploadFetch: typeof fetch; canCreate: boolean; canVerify: boolean; canDelete: boolean }) {
  const { session } = useAuth();
  const base = `${API_BASE}/students/${studentId}/documents`;
  const [items, setItems] = useState<StudentDocument[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [docType, setDocType] = useState('');
  const [title, setTitle] = useState('');
  const [validUntil, setValidUntil] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState<StudentDocument | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await session.fetch(base);
      if (!res.ok) throw new Error(String(res.status));
      setItems(((await res.json()) as { items: StudentDocument[] }).items);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [session, base]);
  useEffect(() => void load(), [load]);

  const chooseType = (v: string) => {
    setDocType(v);
    setErrors((e) => ({ ...e, documentType: '' }));
    if (!title.trim()) setTitle(typeLabel(v));
  };

  const upload = async () => {
    const next: Record<string, string> = {};
    if (!docType) next.documentType = 'Choose the kind of document.';
    if (!title.trim()) next.title = 'Give the document a title.';
    const problem = file ? documentProblem(file) : 'Choose a file.';
    if (problem) next.file = problem;
    setErrors(next);
    if (Object.keys(next).length > 0 || !file) return;
    setBusy('upload');
    try {
      const begin = await session.fetch(`${base}/upload`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contentType: file.type, sizeBytes: file.size }) });
      if (!begin.ok) throw new Error(await detail(begin));
      const u = (await begin.json()) as { fileId: string; uploadUrl: string; headers: Record<string, string> };
      // straight to storage: no Authorization header, only the signed link and the headers it was signed with
      const put = await uploadFetch(u.uploadUrl, { method: 'PUT', headers: u.headers, body: file });
      if (!put.ok) throw new Error('The upload did not go through. Check your connection and try again.');
      const done = await session.fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileId: u.fileId, documentType: docType, title: title.trim(), validUntil: validUntil || null }),
      });
      if (!done.ok) throw new Error(await detail(done));
      toast.success('Document saved');
      setDocType('');
      setTitle('');
      setValidUntil('');
      setFile(null);
      if (input.current) input.current.value = '';
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  const open = async (d: StudentDocument) => {
    setBusy(d.id);
    try {
      const res = await session.fetch(`${base}/${d.id}/download`);
      if (!res.ok) throw new Error(await detail(res));
      openLink(((await res.json()) as { url: string }).url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  const verify = async (d: StudentDocument) => {
    setBusy(d.id);
    try {
      const res = await session.fetch(`${base}/${d.id}/verify`, { method: 'POST' });
      if (!res.ok) throw new Error(await detail(res));
      toast.success('Marked as verified');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (d: StudentDocument) => {
    setBusy(d.id);
    try {
      const res = await session.fetch(`${base}/${d.id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) throw new Error(await detail(res));
      toast.success('Document removed');
      setConfirming(null);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(null);
    }
  };

  // this section sits inside the student form: Enter in a field here must not save the student
  const onEnter = (e: KeyboardEvent) => {
    if (e.key === 'Enter') e.preventDefault();
  };

  const today = todayIst();
  return (
    <section aria-labelledby={`docs-${studentId}`} className="space-y-4 rounded-lg border border-line-subtle bg-canvas p-4">
      <div className="space-y-1">
        <h3 id={`docs-${studentId}`} className="font-display text-lg font-semibold text-fg">
          Documents
        </h3>
        <p className="text-sm text-fg-muted">PDF, JPEG or PNG, up to 10 MB. Every time a document is listed or opened, it is recorded.</p>
      </div>

      {failed ? (
        <p role="alert" className="text-sm text-danger">
          The documents could not be loaded.{' '}
          <button type="button" className="font-medium underline" onClick={() => void load()}>
            Try again
          </button>
        </p>
      ) : items === null ? (
        <p className="text-sm text-fg-muted">Loading documents…</p>
      ) : items.length === 0 ? (
        <div className="rounded-md border border-dashed border-line px-4 py-6 text-center">
          <FileText aria-hidden="true" className="mx-auto mb-2 size-6 text-fg-subtle" />
          <p className="text-sm font-medium text-fg">No documents yet</p>
          <p className="text-sm text-fg-muted">{canCreate ? 'Add the birth certificate, transfer certificate and parent ID proof below.' : 'Nothing has been uploaded for this student.'}</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {items.map((d) => {
            const expired = d.validUntil !== null && d.validUntil < today;
            const Icon = d.contentType === 'application/pdf' ? FileText : ImageIcon;
            return (
              <li key={d.id} className="space-y-2 rounded-md border border-line-subtle bg-surface p-3">
                <div className="flex items-start gap-3">
                  <Icon aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-fg-subtle" />
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium text-fg">{d.title}</p>
                    <p className="text-xs text-fg-muted">
                      {typeLabel(d.documentType)} · {size(d.sizeBytes)} · added {formatDate(istDay(d.uploadedAt))}
                      {d.uploadedBy ? ` by ${d.uploadedBy}` : ''}
                    </p>
                    {d.validUntil ? (
                      <p className={`text-xs ${expired ? 'font-medium text-danger' : 'text-fg-muted'}`}>
                        {expired ? 'Expired on' : 'Valid until'} {formatDate(d.validUntil)}
                      </p>
                    ) : null}
                    <p className={`mt-1 inline-flex items-center gap-1 text-xs ${d.verifiedAt ? 'font-medium text-success' : 'text-fg-muted'}`}>
                      {d.verifiedAt ? (
                        <>
                          <BadgeCheck aria-hidden="true" className="size-3.5" />
                          Verified{d.verifiedBy ? ` by ${d.verifiedBy}` : ''} on {formatDate(istDay(d.verifiedAt))}
                        </>
                      ) : (
                        'Not verified yet'
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" loading={busy === d.id} aria-label={`Open ${d.title}`} onClick={() => void open(d)}>
                    <Download aria-hidden="true" className="size-4" />
                    Open
                  </Button>
                  {canVerify && !d.verifiedAt ? (
                    <Button size="sm" variant="secondary" disabled={busy !== null} aria-label={`Mark verified: ${d.title}`} onClick={() => void verify(d)}>
                      <BadgeCheck aria-hidden="true" className="size-4" />
                      Mark verified
                    </Button>
                  ) : null}
                  {canDelete ? (
                    <Button size="sm" variant="ghost" className="hover:text-danger" disabled={busy !== null} aria-label={`Delete ${d.title}`} onClick={() => setConfirming(d)}>
                      <Trash2 aria-hidden="true" className="size-4" />
                      Delete
                    </Button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canCreate ? (
        <div className="space-y-3 border-t border-line-subtle pt-4" onKeyDown={onEnter}>
          <p className="text-sm font-medium text-fg">Add a document</p>
          <div className="flex flex-col gap-1">
            <label htmlFor={`doc-type-${studentId}`} className="text-sm font-medium text-fg">
              Kind of document *
            </label>
            <select id={`doc-type-${studentId}`} className={field} value={docType} onChange={(e) => chooseType(e.target.value)} aria-invalid={errors.documentType ? true : undefined} aria-describedby={errors.documentType ? `doc-type-${studentId}-e` : undefined}>
              <option value="" disabled>
                Choose…
              </option>
              {DOCUMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            {errors.documentType ? (
              <p id={`doc-type-${studentId}-e`} className="text-sm text-danger">
                {errors.documentType}
              </p>
            ) : null}
          </div>
          <Input label="Title *" value={title} maxLength={120} error={errors.title} onChange={(e) => setTitle(e.target.value)} />
          <Input label="Valid until" type="date" value={validUntil} hint="Only if the document expires." onChange={(e) => setValidUntil(e.target.value)} />
          <div className="flex flex-col gap-1">
            <label htmlFor={`doc-file-${studentId}`} className="text-sm font-medium text-fg">
              File *
            </label>
            <input
              ref={input}
              id={`doc-file-${studentId}`}
              type="file"
              accept={DOCUMENT_ACCEPT}
              className="block w-full text-sm text-fg file:mr-3 file:rounded-md file:border file:border-line file:bg-surface file:px-3 file:py-2 file:text-sm file:font-medium file:text-fg"
              aria-invalid={errors.file ? true : undefined}
              aria-describedby={errors.file ? `doc-file-${studentId}-e` : undefined}
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setErrors((x) => ({ ...x, file: '' }));
              }}
            />
            {errors.file ? (
              <p id={`doc-file-${studentId}-e`} className="text-sm text-danger">
                {errors.file}
              </p>
            ) : null}
          </div>
          <Button size="sm" loading={busy === 'upload'} disabled={busy !== null && busy !== 'upload'} onClick={() => void upload()}>
            <Upload aria-hidden="true" className="size-4" />
            Upload document
          </Button>
        </div>
      ) : null}

      <ConfirmDialog open={confirming !== null} onClose={() => setConfirming(null)} title="Delete this document?">
        <p className="text-sm text-fg-muted">
          {confirming ? `“${confirming.title}” will be removed from the student’s record and deleted from storage. This cannot be undone.` : ''}
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={() => setConfirming(null)}>
            Keep it
          </Button>
          <Button size="sm" variant="destructive" loading={confirming !== null && busy === confirming.id} onClick={() => confirming && void remove(confirming)}>
            Delete document
          </Button>
        </div>
      </ConfirmDialog>
    </section>
  );
}
