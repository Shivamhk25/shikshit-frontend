import type { Session } from '@shikshit/shared/session';
import { API_BASE } from '../../shell/web-session';
import { formatDate } from '../adm/dates';

/**
 * STU-08 Student transfers (backend api/openapi/modules/stu-transfers.yaml). A student leaves the school: a request is
 * filed, someone else approves it in the Approvals inbox, then the school completes it, which gives a TC number and
 * marks the student "transferred". These are the shapes, the calls and the small rules the screens need.
 */

export type TransferStatus = 'requested' | 'approved' | 'rejected' | 'cancelled' | 'completed';
export type TransferReason = 'relocation' | 'another_school' | 'financial' | 'health' | 'other';

export interface Transfer {
  id: string;
  student: { id: string; name: string; registrationCode: string };
  className: string | null;
  sectionName: string | null;
  yearName: string | null;
  requestedOn: string;
  reason: TransferReason;
  reasonNote: string | null;
  destinationSchool: string | null;
  lastAttendanceDate: string | null;
  status: TransferStatus;
  approvalRequestId: string | null;
  tcNumber: string | null;
  tcIssuedOn: string | null;
  dues: { status: 'not_tracked'; note: string };
  createdAt: string;
  updatedAt: string;
}

export interface TransferCertificate {
  tcNumber: string;
  issuedOn: string;
  schoolName: string;
  student: { fullName: string; registrationCode: string; dateOfBirth: string; gender: string; admissionDate: string | null };
  className: string | null;
  sectionName: string | null;
  yearName: string | null;
  lastAttendanceDate: string | null;
  reason: TransferReason;
  reasonLabel: string;
  reasonNote: string | null;
  destinationSchool: string | null;
  guardians: { name: string; relation: string }[];
}

export interface StudentChoice {
  id: string;
  registrationCode: string;
  fullName: string;
  status: string;
  currentClassName: string | null;
  currentSectionName: string | null;
}

export const PAGE_SIZE = 25;
export const NOTE_MAX = 1000;
export const DESTINATION_MAX = 200;

export const REASONS: { value: TransferReason; label: string }[] = [
  { value: 'relocation', label: 'Relocation' },
  { value: 'another_school', label: 'Another school' },
  { value: 'financial', label: 'Financial' },
  { value: 'health', label: 'Health' },
  { value: 'other', label: 'Other' },
];

export const STATUSES: { value: TransferStatus; label: string }[] = [
  { value: 'requested', label: 'Requested' },
  { value: 'approved', label: 'Approved' },
  { value: 'completed', label: 'Completed' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const reasonLabel = (v: string): string => REASONS.find((r) => r.value === v)?.label ?? v;
export const statusLabel = (v: string): string => STATUSES.find((s) => s.value === v)?.label ?? v;

/** The class line of a transfer: "Class 5 · A", or a dash for a student who had no enrolment. */
export function classLine(t: Pick<Transfer, 'className' | 'sectionName'>): string {
  if (!t.className) return '—';
  return t.sectionName ? `${t.className}\u00a0·\u00a0${t.sectionName}` : t.className;
}

/** Today's date in India as YYYY-MM-DD, because the school's day is the one the server checks "not in the future" against. */
export function todayIndia(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

/** Where the approver decides this transfer (the existing Approvals screen opens that request). */
export const approvalHref = (approvalRequestId: string): string => `/approvals?id=${encodeURIComponent(approvalRequestId)}`;

/** The printable transfer certificate of a completed transfer. */
export const certificateHref = (transferId: string): string => `/transfers/${encodeURIComponent(transferId)}/certificate`;

// ---- what each person may do with each row

export type TransferAction = 'view' | 'edit' | 'openApproval' | 'complete' | 'cancel' | 'printCertificate' | 'delete';

/** The permissions that decide the actions. `edit` also covers completing and cancelling (the server's rule). */
export interface TransferPerms {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

/**
 * The actions a row offers, from its status and what the person may do. The server checks every call again; this only
 * keeps people from seeing buttons that would be refused. A completed transfer is never edited, cancelled or deleted.
 */
export function allowedActions(t: Pick<Transfer, 'status' | 'approvalRequestId'>, perms: Pick<TransferPerms, 'view' | 'edit' | 'delete'>): TransferAction[] {
  if (!perms.view) return [];
  const out: TransferAction[] = ['view'];
  const open = t.status === 'requested' || t.status === 'approved';
  if (open && perms.edit) out.push('edit');
  if (t.status === 'requested' && t.approvalRequestId) out.push('openApproval');
  if (t.status === 'approved' && perms.edit) out.push('complete');
  if (open && perms.edit) out.push('cancel');
  if (t.status === 'completed') out.push('printCertificate');
  if ((t.status === 'cancelled' || t.status === 'rejected') && perms.delete) out.push('delete');
  return out;
}

export type StepState = 'done' | 'current' | 'upcoming' | 'stopped';
export interface TimelineStep {
  key: string;
  label: string;
  state: StepState;
  detail?: string;
}

/** The path of a transfer: requested, approved, completed; or requested and then stopped by a rejection or a cancellation. */
export function timelineSteps(t: Pick<Transfer, 'status' | 'requestedOn' | 'tcIssuedOn' | 'tcNumber'>, format: (iso: string | null) => string = (v) => v ?? ''): TimelineStep[] {
  const requested: TimelineStep = { key: 'requested', label: 'Requested', state: 'done', detail: format(t.requestedOn) };
  switch (t.status) {
    case 'requested':
      return [requested, { key: 'approved', label: 'Approval', state: 'current', detail: 'Waiting for approval' }, { key: 'completed', label: 'Completed', state: 'upcoming' }];
    case 'approved':
      return [requested, { key: 'approved', label: 'Approved', state: 'done' }, { key: 'completed', label: 'Completed', state: 'current', detail: 'Ready to complete' }];
    case 'completed':
      return [requested, { key: 'approved', label: 'Approved', state: 'done' }, { key: 'completed', label: 'Completed', state: 'done', detail: [t.tcNumber, t.tcIssuedOn ? format(t.tcIssuedOn) : ''].filter(Boolean).join(' · ') }];
    case 'rejected':
      return [requested, { key: 'rejected', label: 'Rejected', state: 'stopped', detail: 'The approver did not approve this transfer' }];
    default:
      return [requested, { key: 'cancelled', label: 'Cancelled', state: 'stopped' }];
  }
}

// ---- the request form

export interface TransferForm {
  studentId: string;
  requestedOn: string;
  reason: TransferReason | '';
  reasonNote: string;
  destinationSchool: string;
  lastAttendanceDate: string;
}

export function blankTransferForm(now: Date = new Date()): TransferForm {
  return { studentId: '', requestedOn: todayIndia(now), reason: '', reasonNote: '', destinationSchool: '', lastAttendanceDate: '' };
}

export function formFromTransfer(t: Transfer): TransferForm {
  return { studentId: t.student.id, requestedOn: t.requestedOn, reason: t.reason, reasonNote: t.reasonNote ?? '', destinationSchool: t.destinationSchool ?? '', lastAttendanceDate: t.lastAttendanceDate ?? '' };
}

/** Problems the person can fix before anything is sent, keyed by field. The server checks all of it again. */
export function validateTransferForm(f: TransferForm, mode: 'create' | 'edit', now: Date = new Date()): Record<string, string> {
  const errors: Record<string, string> = {};
  const today = todayIndia(now);
  if (mode === 'create') {
    if (!f.studentId) errors.studentId = 'Choose the student.';
    if (!f.requestedOn) errors.requestedOn = 'Enter the date of the request.';
    else if (f.requestedOn > today) errors.requestedOn = 'The request date cannot be in the future.';
  }
  if (!f.reason) errors.reason = 'Choose a reason.';
  const note = f.reasonNote.trim();
  if (f.reason === 'other' && !note) errors.reasonNote = 'Tell us the reason when you choose Other.';
  else if (note.length > NOTE_MAX) errors.reasonNote = `Keep the note within ${NOTE_MAX} characters.`;
  if (f.destinationSchool.trim().length > DESTINATION_MAX) errors.destinationSchool = `Keep the school name within ${DESTINATION_MAX} characters.`;
  if (f.lastAttendanceDate && f.lastAttendanceDate > today) errors.lastAttendanceDate = 'The last day of attendance cannot be in the future.';
  return errors;
}

const orNull = (v: string): string | null => (v.trim() ? v.trim() : null);

/** The body of a new request. Blank optional values go as null. */
export function buildCreateBody(f: TransferForm): Record<string, unknown> {
  return { studentId: f.studentId, requestedOn: f.requestedOn, reason: f.reason, reasonNote: orNull(f.reasonNote), destinationSchool: orNull(f.destinationSchool), lastAttendanceDate: f.lastAttendanceDate || null };
}

/** The body of a change: the student and the request date are fixed once the request is filed. */
export function buildUpdateBody(f: TransferForm): Record<string, unknown> {
  return { reason: f.reason, reasonNote: orNull(f.reasonNote), destinationSchool: orNull(f.destinationSchool), lastAttendanceDate: f.lastAttendanceDate || null };
}

export interface ListQuery {
  page?: number;
  pageSize?: number;
  sort?: string;
  search?: string;
  status?: string;
  classId?: string;
}

/** The query string of the list. Empty filters are not sent. */
export function buildListQuery(q: ListQuery): string {
  const p = new URLSearchParams({ page: String(q.page ?? 1), pageSize: String(q.pageSize ?? PAGE_SIZE) });
  if (q.sort) p.set('sort', q.sort);
  if (q.search?.trim()) p.set('q', q.search.trim());
  if (q.status) p.set('status', q.status);
  if (q.classId) p.set('classId', q.classId);
  return p.toString();
}

const capitalise = (v: string) => (v ? v[0].toUpperCase() + v.slice(1) : '—');

/** The particulars of the certificate, in the order a school transfer certificate lists them. */
export function certificateRows(c: TransferCertificate): { label: string; value: string; note?: string }[] {
  const studied = [c.className, c.sectionName].filter(Boolean).join(' ');
  return [
    { label: 'Name of the student', value: c.student.fullName },
    { label: 'Registration number', value: c.student.registrationCode },
    { label: 'Date of birth', value: formatDate(c.student.dateOfBirth) },
    { label: 'Gender', value: capitalise(c.student.gender) },
    { label: 'Date of admission', value: formatDate(c.student.admissionDate) },
    { label: 'Parent or guardian', value: c.guardians.length > 0 ? c.guardians.map((g) => `${g.name} (${g.relation})`).join(', ') : '—' },
    { label: 'Class last studied', value: studied ? `${studied}${c.yearName ? `, ${c.yearName}` : ''}` : '—' },
    { label: 'Last day of attendance', value: formatDate(c.lastAttendanceDate) },
    { label: 'Reason for leaving', value: c.reasonLabel, note: c.reasonNote ?? undefined },
    { label: 'School joined next', value: c.destinationSchool || '—' },
  ];
}

/** "Asha Rao (R-0001) · Class 5 A": enough to tell two students with the same name apart. */
export function studentOption(s: StudentChoice): { value: string; label: string } {
  const where = s.currentClassName ? ` · ${[s.currentClassName, s.currentSectionName].filter(Boolean).join(' ')}` : '';
  return { value: s.id, label: `${s.fullName} (${s.registrationCode})${where}${s.status === 'paused' ? ' · paused' : ''}` };
}

// ---- errors

/** A failed call: the status, the problem code, a message in plain words, and one message per field the server named. */
export class TransfersError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly fields: Record<string, string>,
    message: string,
  ) {
    super(message);
  }
}

const CONFLICTS: Record<string, string> = {
  open_transfer: 'This student already has a transfer in progress. Finish or cancel that one first.',
  not_approved: 'This transfer has not been approved yet. The approver decides it in Approvals.',
  not_editable: 'This transfer can no longer be changed.',
  not_cancellable: 'This transfer can no longer be cancelled.',
  not_deletable: 'Only a cancelled or rejected transfer can be deleted.',
  not_completed: 'A transfer certificate is available once the transfer is completed.',
  student_not_transferable: 'This student is no longer active, so the transfer cannot be completed.',
};

type ProblemBody = { code?: string; detail?: string; errors?: { field: string; message: string; code?: string }[] };

/** Reads a failed answer into a TransfersError. The first message for a field wins. */
export async function readFailure(res: Response): Promise<TransfersError> {
  let p: ProblemBody = {};
  try {
    p = (await res.json()) as ProblemBody;
  } catch {
    /* not JSON */
  }
  const fields: Record<string, string> = {};
  for (const e of p.errors ?? []) fields[e.field] ??= e.message;
  const code = p.code ?? 'error';
  let message: string;
  if (res.status === 409) message = code === 'not_eligible' ? p.detail || 'This transfer cannot be completed yet.' : CONFLICTS[code] ?? (p.detail || 'This cannot be done right now.');
  else if (res.status === 403) message = code === 'read_only_visit' ? 'Nothing can be changed during a read-only support visit.' : p.detail || 'You do not have permission to do this.';
  else if (res.status === 404) message = 'This transfer no longer exists. Refresh the list.';
  else message = p.detail || 'Something went wrong. Please try again.';
  return new TransfersError(res.status, code, fields, message);
}

// ---- the calls

/** The calls the transfers screens make. Every call goes through the signed-in session. */
export function createTransfersApi(session: Session) {
  const call = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    let res: Response;
    try {
      res = await session.fetch(`${API_BASE}${path}`, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new TransfersError(0, 'network', {}, 'Cannot reach the server. Check your connection.');
    }
    if (!res.ok) throw await readFailure(res);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  };
  const id = encodeURIComponent;
  return {
    list: (q: ListQuery) => call<{ items: Transfer[]; page: { total: number } }>('GET', `/student-transfers?${buildListQuery(q)}`),
    get: (transferId: string) => call<Transfer>('GET', `/student-transfers/${id(transferId)}`),
    create: (f: TransferForm) => call<Transfer>('POST', '/student-transfers', buildCreateBody(f)),
    update: (transferId: string, f: TransferForm) => call<Transfer>('PUT', `/student-transfers/${id(transferId)}`, buildUpdateBody(f)),
    remove: (transferId: string) => call<void>('DELETE', `/student-transfers/${id(transferId)}`),
    /** Completes an approved transfer. Doing it twice is safe: the answer says `alreadyCompleted`. */
    complete: (transferId: string, issuedOn?: string) => call<{ transfer: Transfer; alreadyCompleted: boolean }>('POST', `/student-transfers/${id(transferId)}/complete`, issuedOn ? { issuedOn } : {}),
    cancel: (transferId: string, comment?: string) => call<Transfer>('POST', `/student-transfers/${id(transferId)}/cancel`, comment?.trim() ? { comment: comment.trim() } : {}),
    certificate: (transferId: string) => call<TransferCertificate>('GET', `/student-transfers/${id(transferId)}/certificate`),
    classes: async () => (await call<{ items: { id: string; name: string }[] }>('GET', '/classes?page=1&pageSize=200')).items,
    /** Active and paused students matching the text (a transfer may be asked for either). Needs permission to view students. */
    students: async (q: string): Promise<StudentChoice[]> => {
      const one = (status: string) => {
        const p = new URLSearchParams({ pageSize: '20', status });
        if (q.trim()) p.set('q', q.trim());
        return call<{ items: StudentChoice[] }>('GET', `/students?${p.toString()}`);
      };
      const [active, paused] = await Promise.all([one('active'), one('paused')]);
      const seen = new Set<string>();
      return [...active.items, ...paused.items].filter((s) => !seen.has(s.id) && seen.add(s.id)).sort((a, b) => a.fullName.localeCompare(b.fullName)).slice(0, 20);
    },
  };
}

export type TransfersApi = ReturnType<typeof createTransfersApi>;
