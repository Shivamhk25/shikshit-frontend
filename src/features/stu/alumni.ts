import type { Session } from '@shikshit/shared/session';
import { API_BASE } from '../../shell/web-session';
import { PAGE_SIZE } from './transfers';

/**
 * STU-10 Alumni (backend api/openapi/modules/stu-alumni.yaml). A read-only list of former students: graduates and
 * transferred students, with the class they left from and the date they left.
 */

export { PAGE_SIZE };

export type AlumniReason = 'graduated' | 'transferred' | 'other';

export interface Alumnus {
  id: string;
  name: string;
  registrationCode: string;
  admissionDate: string | null;
  lastClassName: string | null;
  lastSectionName: string | null;
  yearName: string | null;
  reason: AlumniReason;
  reasonLabel: string;
  exitDate: string | null;
  tcNumber: string | null;
  destinationSchool: string | null;
  lastAttendanceDate: string | null;
}

export const REASONS: { value: AlumniReason; label: string }[] = [
  { value: 'graduated', label: 'Graduated' },
  { value: 'transferred', label: 'Transferred' },
  { value: 'other', label: 'Other' },
];

/** The class line: "Class 8 · A", or a dash for a student who never had an enrolment. */
export function lastClassLine(a: Pick<Alumnus, 'lastClassName' | 'lastSectionName'>): string {
  if (!a.lastClassName) return '—';
  return a.lastSectionName ? `${a.lastClassName}\u00a0·\u00a0${a.lastSectionName}` : a.lastClassName;
}

/** What to say when the date a student left is not known (a status set by hand, with no promotion or transfer behind it). */
export const UNKNOWN_EXIT = 'Not recorded';

/** Why the exit date may be empty, shown in the detail sheet. */
export function exitNote(a: Pick<Alumnus, 'reason' | 'exitDate'>): string | null {
  if (a.exitDate) return a.reason === 'transferred' ? 'The date on the transfer certificate.' : a.reason === 'graduated' ? 'The day the promotion was committed.' : null;
  return 'This student was marked as having left without a graduation or a completed transfer, so the date is not known.';
}

export interface ListQuery {
  page?: number;
  pageSize?: number;
  sort?: string;
  search?: string;
  reason?: string;
  classId?: string;
  yearId?: string;
}

/** The query string of the list. Empty filters are not sent. */
export function buildListQuery(q: ListQuery): string {
  const p = new URLSearchParams({ page: String(q.page ?? 1), pageSize: String(q.pageSize ?? PAGE_SIZE) });
  if (q.sort) p.set('sort', q.sort);
  if (q.search?.trim()) p.set('q', q.search.trim());
  if (q.reason) p.set('reason', q.reason);
  if (q.classId) p.set('classId', q.classId);
  if (q.yearId) p.set('yearId', q.yearId);
  return p.toString();
}

/** A failed call, with a message in plain words. */
export class AlumniError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** The calls the alumni screen makes. Every call goes through the signed-in session. */
export function createAlumniApi(session: Session) {
  const get = async <T>(path: string): Promise<T> => {
    let res: Response;
    try {
      res = await session.fetch(`${API_BASE}${path}`);
    } catch {
      throw new AlumniError(0, 'Cannot reach the server. Check your connection.');
    }
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { detail?: string };
      throw new AlumniError(res.status, res.status === 403 ? body.detail || 'You do not have permission to see this.' : body.detail || 'Something went wrong. Please try again.');
    }
    return (await res.json()) as T;
  };
  return {
    list: (q: ListQuery) => get<{ items: Alumnus[]; page: { total: number } }>(`/alumni?${buildListQuery(q)}`),
    classes: async () => (await get<{ items: { id: string; name: string }[] }>('/classes?page=1&pageSize=200')).items,
    years: async () => (await get<{ items: { id: string; name: string }[] }>('/academic-years?page=1&pageSize=200')).items,
  };
}

export type AlumniApi = ReturnType<typeof createAlumniApi>;
