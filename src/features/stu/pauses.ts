import type { Session } from '@shikshit/shared/session';
import { API_BASE } from '../../shell/web-session';
import { classLine, NOTE_MAX, PAGE_SIZE, studentOption, todayIndia, type StudentChoice } from './transfers';

/**
 * STU-09 Student pauses (backend api/openapi/modules/stu-pauses.yaml). A student is away for a while and expected back.
 * Pausing sets the student to "paused"; marking the student back (or cancelling a pause entered by mistake) sets them
 * to "active" again. These are the shapes, the calls and the small rules the screens need.
 */

export { classLine, NOTE_MAX, PAGE_SIZE, studentOption, todayIndia };
export type { StudentChoice };

export type PauseStatus = 'active' | 'ended' | 'cancelled';
export type PauseReason = 'illness' | 'family_relocation' | 'financial' | 'family_emergency' | 'other';

export interface Pause {
  id: string;
  student: { id: string; name: string; registrationCode: string };
  className: string | null;
  sectionName: string | null;
  yearName: string | null;
  pausedFrom: string;
  days: number | null;
  expectedBack: string | null;
  overdue: boolean;
  reason: PauseReason;
  reasonNote: string | null;
  status: PauseStatus;
  endedOn: string | null;
  closeNote: string | null;
  figures: { owed: { status: 'not_tracked'; note: string }; missed: { status: 'not_tracked'; note: string } };
  createdAt: string;
  updatedAt: string;
}

export const REASONS: { value: PauseReason; label: string }[] = [
  { value: 'illness', label: 'Illness' },
  { value: 'family_relocation', label: 'Family relocation' },
  { value: 'financial', label: 'Financial reasons' },
  { value: 'family_emergency', label: 'Family emergency' },
  { value: 'other', label: 'Other' },
];

export const STATUSES: { value: PauseStatus; label: string }[] = [
  { value: 'active', label: 'Paused now' },
  { value: 'ended', label: 'Back' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const reasonLabel = (v: string): string => REASONS.find((r) => r.value === v)?.label ?? v;
export const statusLabel = (v: string): string => STATUSES.find((s) => s.value === v)?.label ?? v;

/** "5 days", "1 day", "Today" for a pause that began today, or a dash when there is no count (a cancelled pause). */
export function daysLabel(days: number | null): string {
  if (days === null) return '—';
  if (days === 0) return 'Today';
  return days === 1 ? '1 day' : `${days} days`;
}

// ---- what each person may do with each row

export type PauseAction = 'view' | 'edit' | 'end' | 'cancel';

/** The permissions that decide the actions. Ending, cancelling and editing all take the edit permission (the server's rule). */
export interface PausePerms {
  view: boolean;
  create: boolean;
  edit: boolean;
}

/** The actions a row offers. The server checks every call again; this only hides buttons that would be refused. */
export function allowedActions(p: Pick<Pause, 'status'>, perms: Pick<PausePerms, 'view' | 'edit'>): PauseAction[] {
  if (!perms.view) return [];
  const out: PauseAction[] = ['view'];
  if (p.status === 'active' && perms.edit) out.push('edit', 'end', 'cancel');
  return out;
}

// ---- the form

export interface PauseForm {
  studentId: string;
  pausedFrom: string;
  expectedBack: string;
  reason: PauseReason | '';
  reasonNote: string;
}

export function blankPauseForm(now: Date = new Date()): PauseForm {
  return { studentId: '', pausedFrom: todayIndia(now), expectedBack: '', reason: '', reasonNote: '' };
}

export function formFromPause(p: Pause): PauseForm {
  return { studentId: p.student.id, pausedFrom: p.pausedFrom, expectedBack: p.expectedBack ?? '', reason: p.reason, reasonNote: p.reasonNote ?? '' };
}

/** Problems the person can fix before anything is sent, keyed by field. The server checks all of it again. */
export function validatePauseForm(f: PauseForm, mode: 'create' | 'edit', startsOn: string = f.pausedFrom, now: Date = new Date()): Record<string, string> {
  const errors: Record<string, string> = {};
  const today = todayIndia(now);
  if (mode === 'create') {
    if (!f.studentId) errors.studentId = 'Choose the student.';
    if (!f.pausedFrom) errors.pausedFrom = 'Enter the day the pause starts.';
    else if (f.pausedFrom > today) errors.pausedFrom = 'The pause cannot start in the future. Record it when it begins.';
  }
  if (f.expectedBack && startsOn && f.expectedBack < startsOn) errors.expectedBack = 'The expected back date cannot be before the pause starts.';
  if (!f.reason) errors.reason = 'Choose a reason.';
  const note = f.reasonNote.trim();
  if (f.reason === 'other' && !note) errors.reasonNote = 'Tell us the reason when you choose Other.';
  else if (note.length > NOTE_MAX) errors.reasonNote = `Keep the note within ${NOTE_MAX} characters.`;
  return errors;
}

const orNull = (v: string): string | null => (v.trim() ? v.trim() : null);

/** The body of a new pause. Blank optional values go as null. */
export function buildCreateBody(f: PauseForm): Record<string, unknown> {
  return { studentId: f.studentId, pausedFrom: f.pausedFrom, expectedBack: f.expectedBack || null, reason: f.reason, reasonNote: orNull(f.reasonNote) };
}

/** The body of a change: the student and the start date are fixed once the pause is recorded. */
export function buildUpdateBody(f: PauseForm): Record<string, unknown> {
  return { expectedBack: f.expectedBack || null, reason: f.reason, reasonNote: orNull(f.reasonNote) };
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

// ---- errors

/** A failed call: the status, the problem code, a message in plain words, and one message per field the server named. */
export class PausesError extends Error {
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
  already_paused: 'This student already has an active pause. Mark them back first.',
  not_active: 'This pause has already ended or been cancelled. Refresh the list.',
};

type ProblemBody = { code?: string; detail?: string; errors?: { field: string; message: string; code?: string }[] };

/** Reads a failed answer into a PausesError. The first message for a field wins. */
export async function readFailure(res: Response): Promise<PausesError> {
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
  if (res.status === 409) message = CONFLICTS[code] ?? (p.detail || 'This cannot be done right now.');
  else if (res.status === 403) message = code === 'read_only_visit' ? 'Nothing can be changed during a read-only support visit.' : p.detail || 'You do not have permission to do this.';
  else if (res.status === 404) message = 'This pause no longer exists. Refresh the list.';
  else message = p.detail || 'Something went wrong. Please try again.';
  return new PausesError(res.status, code, fields, message);
}

// ---- the calls

/** The calls the pauses screens make. Every call goes through the signed-in session. */
export function createPausesApi(session: Session) {
  const call = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    let res: Response;
    try {
      res = await session.fetch(`${API_BASE}${path}`, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new PausesError(0, 'network', {}, 'Cannot reach the server. Check your connection.');
    }
    if (!res.ok) throw await readFailure(res);
    return (await res.json()) as T;
  };
  const id = encodeURIComponent;
  return {
    list: (q: ListQuery) => call<{ items: Pause[]; page: { total: number } }>('GET', `/student-pauses?${buildListQuery(q)}`),
    create: (f: PauseForm) => call<Pause>('POST', '/student-pauses', buildCreateBody(f)),
    update: (pauseId: string, f: PauseForm) => call<Pause>('PUT', `/student-pauses/${id(pauseId)}`, buildUpdateBody(f)),
    /** The student is back. Without a date it is today. */
    end: (pauseId: string, endedOn?: string, note?: string) => call<Pause>('POST', `/student-pauses/${id(pauseId)}/end`, { ...(endedOn ? { endedOn } : {}), ...(note?.trim() ? { note: note.trim() } : {}) }),
    cancel: (pauseId: string, note?: string) => call<Pause>('POST', `/student-pauses/${id(pauseId)}/cancel`, note?.trim() ? { note: note.trim() } : {}),
    classes: async () => (await call<{ items: { id: string; name: string }[] }>('GET', '/classes?page=1&pageSize=200')).items,
    /** Active and paused students matching the text. Needs permission to view students. */
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

export type PausesApi = ReturnType<typeof createPausesApi>;
