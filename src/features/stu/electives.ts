import type { Session } from '@shikshit/shared/session';
import { API_BASE } from '../../shell/web-session';

export type StudentElectiveStatus = 'chosen' | 'confirmed';
export type StudentElectiveChangeStatus = 'requested' | 'approved' | 'rejected' | 'cancelled';

export interface ElectiveSubject {
  id: string;
  code: string;
  name: string;
}

export interface ElectiveGroupLimits {
  id: string;
  name: string;
  code: string | null;
  minSubjects: number;
  maxSubjects: number;
  enforceLimits: boolean;
}

export interface ElectiveWarning {
  code: 'below_minimum' | 'above_maximum';
  message: string;
}

export interface StudentElectiveStudent {
  id: string;
  name: string;
  registrationCode: string;
}

export interface StudentElective {
  id: string;
  student: StudentElectiveStudent;
  yearId: string;
  yearName: string;
  classId: string | null;
  className: string | null;
  sectionId: string | null;
  sectionName: string | null;
  group: ElectiveGroupLimits;
  subjects: ElectiveSubject[];
  offered: ElectiveSubject[];
  status: StudentElectiveStatus;
  withinLimits: boolean;
  warnings: ElectiveWarning[];
  createdAt: string;
  updatedAt: string;
}

export interface StudentElectivePage {
  items: StudentElective[];
  page: { total: number; page: number; pageSize: number };
}

export interface StudentElectiveCreate {
  studentId: string;
  yearId: string;
  groupId: string;
  subjectIds: string[];
  status?: StudentElectiveStatus;
}

export interface StudentElectiveReplace {
  subjectIds: string[];
  status?: StudentElectiveStatus;
}

export interface StudentElectiveHistoryItem {
  id: string;
  action: 'create' | 'replace' | 'swap' | 'status' | 'delete';
  subjectsBefore: ElectiveSubject[];
  subjectsAfter: ElectiveSubject[];
  statusBefore: string | null;
  statusAfter: string | null;
  source: 'staff' | 'change_request';
  changeId: string | null;
  approvalRequestId: string | null;
  changedAt: string;
  changedBy: { id: string; name: string } | null;
}

export interface StudentElectiveHistory {
  items: StudentElectiveHistoryItem[];
}

export interface StudentElectiveRosterStudent {
  student: StudentElectiveStudent;
  rollNumber: string | null;
  choiceId: string | null;
  status: StudentElectiveStatus | null;
  subjects: ElectiveSubject[];
  withinLimits: boolean;
  warnings: ElectiveWarning[];
}

export interface ElectiveNamed {
  id: string;
  name: string;
}

export interface StudentElectiveRoster {
  year: ElectiveNamed;
  class: ElectiveNamed;
  section: ElectiveNamed;
  group: ElectiveGroupLimits;
  offered: ElectiveSubject[];
  students: StudentElectiveRosterStudent[];
}

export interface StudentElectiveRosterRow {
  studentId: string;
  subjectIds: string[];
  status?: StudentElectiveStatus;
}

export interface StudentElectiveRosterSave {
  yearId: string;
  classId: string;
  sectionId: string;
  groupId: string;
  rows: StudentElectiveRosterRow[];
}

export interface StudentElectiveRosterResult {
  created: number;
  updated: number;
  removed: number;
  unchanged: number;
  items: { studentId: string; choiceId: string | null; result: 'created' | 'updated' | 'removed' | 'unchanged' }[];
}

export interface StudentElectiveChangeDecision {
  outcome: 'approved' | 'rejected';
  decidedBy: { id: string; name: string } | null;
  decidedAt: string;
  note: string | null;
}

export interface StudentElectiveChange {
  id: string;
  student: StudentElectiveStudent;
  yearId: string;
  yearName: string;
  className: string | null;
  sectionName: string | null;
  group: ElectiveNamed;
  choiceId: string;
  fromSubject: ElectiveSubject;
  toSubject: ElectiveSubject;
  wantedFrom: string;
  reason: string;
  status: StudentElectiveChangeStatus;
  approvalRequestId: string | null;
  requestedBy: { id: string; name: string } | null;
  decision: StudentElectiveChangeDecision | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudentElectiveChangePage {
  items: StudentElectiveChange[];
  page: { total: number; page: number; pageSize: number };
}

export interface StudentElectiveChangeCreate {
  choiceId: string;
  fromSubjectId: string;
  toSubjectId: string;
  wantedFrom?: string;
  reason: string;
}

export interface StudentElectiveChangeCancel {
  comment?: string;
}

export const PAGE_SIZE = 25;
export const REASON_MAX = 500;

export const STATUS_LABELS: Record<StudentElectiveStatus, string> = {
  chosen: 'Chosen',
  confirmed: 'Confirmed',
};

export const CHANGE_STATUS_LABELS: Record<StudentElectiveChangeStatus, string> = {
  requested: 'Requested',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export function statusLabel(v: string): string {
  return STATUS_LABELS[v as StudentElectiveStatus] ?? v;
}

export function changeStatusLabel(v: string): string {
  return CHANGE_STATUS_LABELS[v as StudentElectiveChangeStatus] ?? v;
}

export function classLine(c: Pick<StudentElective, 'className' | 'sectionName'>): string {
  if (!c.className) return '—';
  return c.sectionName ? `${c.className}\u00a0·\u00a0${c.sectionName}` : c.className;
}

export function approvalHref(approvalRequestId: string): string {
  return `/approvals?id=${encodeURIComponent(approvalRequestId)}`;
}

export interface ListQuery {
  page?: number;
  pageSize?: number;
  sort?: string;
  search?: string;
  status?: string;
  yearId?: string;
  classId?: string;
  sectionId?: string;
  groupId?: string;
  studentId?: string;
}

export function buildListQuery(q: ListQuery): string {
  const p = new URLSearchParams({ page: String(q.page ?? 1), pageSize: String(q.pageSize ?? PAGE_SIZE) });
  if (q.sort) p.set('sort', q.sort);
  if (q.search?.trim()) p.set('q', q.search.trim());
  if (q.status) p.set('status', q.status);
  if (q.yearId) p.set('yearId', q.yearId);
  if (q.classId) p.set('classId', q.classId);
  if (q.sectionId) p.set('sectionId', q.sectionId);
  if (q.groupId) p.set('groupId', q.groupId);
  if (q.studentId) p.set('studentId', q.studentId);
  return p.toString();
}

export interface ChangeListQuery {
  page?: number;
  pageSize?: number;
  sort?: string;
  search?: string;
  status?: string;
  studentId?: string;
  choiceId?: string;
  groupId?: string;
  yearId?: string;
  classId?: string;
  sectionId?: string;
}

export function buildChangeListQuery(q: ChangeListQuery): string {
  const p = new URLSearchParams({ page: String(q.page ?? 1), pageSize: String(q.pageSize ?? PAGE_SIZE) });
  if (q.sort) p.set('sort', q.sort);
  if (q.search?.trim()) p.set('q', q.search.trim());
  if (q.status) p.set('status', q.status);
  if (q.studentId) p.set('studentId', q.studentId);
  if (q.choiceId) p.set('choiceId', q.choiceId);
  if (q.groupId) p.set('groupId', q.groupId);
  if (q.yearId) p.set('yearId', q.yearId);
  if (q.classId) p.set('classId', q.classId);
  if (q.sectionId) p.set('sectionId', q.sectionId);
  return p.toString();
}

export async function readFailure(res: Response): Promise<ElectivesError> {
  let p: { code?: string; detail?: string; errors?: { field: string; message: string; code?: string }[] } = {};
  try {
    p = (await res.json()) as typeof p;
  } catch {
    /* not JSON */
  }
  const fields: Record<string, string> = {};
  for (const e of p.errors ?? []) fields[e.field] ??= e.message;
  const code = p.code ?? 'error';
  let message: string;
  if (res.status === 409) message = CONFLICTS[code] ?? (p.detail || 'This cannot be done right now.');
  else if (res.status === 403) message = code === 'read_only_visit' ? 'Nothing can be changed during a read-only support visit.' : p.detail || 'You do not have permission to do this.';
  else if (res.status === 404) message = 'This record no longer exists. Refresh the list.';
  else message = p.detail || 'Something went wrong. Please try again.';
  return new ElectivesError(res.status, code, fields, message);
}

export class ElectivesError extends Error {
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
  choice_exists: 'This student already has a choice for this group and year.',
  open_change_request: 'A change request for this subject is already waiting for a decision.',
  open_change: 'This student already has a change request in progress.',
  not_chosen: 'The student has not chosen that subject.',
  same_subject: 'The new subject is the same as the current one.',
  already_chosen: 'The student has already chosen that subject.',
  not_in_group: 'That subject is not offered by this group to the student\'s class.',
  not_found: 'The record was not found.',
  not_enrolled: 'The student is not enrolled in any class for that year.',
  inactive: 'That group is not active.',
  not_offered: 'That group offers no subjects to this class section.',
  below_minimum: 'The choice would be below the group\'s minimum.',
  above_maximum: 'The choice would exceed the group\'s maximum.',
  not_cancellable: 'This change request can no longer be cancelled.',
};

export function createElectivesApi(session: Session) {
  const call = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    let res: Response;
    try {
      res = await session.fetch(`${API_BASE}${path}`, {
        method,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ElectivesError(0, 'network', {}, 'Cannot reach the server. Check your connection.');
    }
    if (!res.ok) throw await readFailure(res);
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  };
  const id = encodeURIComponent;
  return {
    list: (q: ListQuery) => call<StudentElectivePage>('GET', `/student-electives?${buildListQuery(q)}`),
    get: (choiceId: string) => call<StudentElective>('GET', `/student-electives/${id(choiceId)}`),
    create: (f: StudentElectiveCreate) => call<StudentElective>('POST', '/student-electives', f),
    replace: (choiceId: string, f: StudentElectiveReplace) => call<StudentElective>('PUT', `/student-electives/${id(choiceId)}`, f),
    remove: (choiceId: string) => call<void>('DELETE', `/student-electives/${id(choiceId)}`),
    history: (choiceId: string) => call<StudentElectiveHistory>('GET', `/student-electives/${id(choiceId)}/history`),
    roster: (yearId: string, classId: string, sectionId: string, groupId: string) =>
      call<StudentElectiveRoster>('GET', `/student-electives/roster?yearId=${id(yearId)}&classId=${id(classId)}&sectionId=${id(sectionId)}&groupId=${id(groupId)}`),
    saveRoster: (f: StudentElectiveRosterSave) => call<StudentElectiveRosterResult>('PUT', '/student-electives/roster', f),
    changesList: (q: ChangeListQuery) => call<StudentElectiveChangePage>('GET', `/student-elective-changes?${buildChangeListQuery(q)}`),
    changeGet: (changeId: string) => call<StudentElectiveChange>('GET', `/student-elective-changes/${id(changeId)}`),
    changeCreate: (f: StudentElectiveChangeCreate) => call<StudentElectiveChange>('POST', '/student-elective-changes', f),
    changeCancel: (changeId: string, f: StudentElectiveChangeCancel) => call<StudentElectiveChange>('POST', `/student-elective-changes/${id(changeId)}/cancel`, f),
  };
}

export type ElectivesApi = ReturnType<typeof createElectivesApi>;