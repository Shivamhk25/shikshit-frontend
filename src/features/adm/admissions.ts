import type { Session } from '@shikshit/shared/session';
import { API_BASE } from '../../shell/web-session';

/** ADM-05 Admissions (backend api/openapi/modules/adm-admissions.yaml): turns an accepted registration into a student
 * with an enrolment. These are the request and answer shapes, the calls, and the small rules the screen needs. */

export type AdmissionState = 'ready' | 'admitted';

export interface Admission {
  id: string;
  applicationNumber: string;
  appliedOn: string;
  fullName: string;
  dateOfBirth: string;
  gender: string | null;
  fatherName: string | null;
  motherName: string | null;
  guardianName: string | null;
  guardianPhone: string;
  classId: string;
  className: string;
  /** The section noted on the registration. Only a suggestion. */
  sectionId: string | null;
  sectionName: string | null;
  yearId: string;
  yearName: string;
  status: string;
  admitted: boolean;
  admittedAt: string | null;
  studentId: string | null;
  studentCode: string | null;
  enrolledSectionName: string | null;
  rollNumber: string | null;
}

/** What the registrar decides. Blank optional values are left out of the request. */
export interface AdmitForm {
  sectionId: string;
  rollNumber: string;
  studentCode: string;
  gender: string;
  admissionDate: string;
  parentEmail: string;
  confirmDuplicate: boolean;
}

export const blankAdmitForm = (a?: Pick<Admission, 'sectionId'>): AdmitForm => ({
  sectionId: a?.sectionId ?? '',
  rollNumber: '',
  studentCode: '',
  gender: '',
  admissionDate: '',
  parentEmail: '',
  confirmDuplicate: false,
});

export interface AdmissionGuardian {
  guardianId: string;
  name: string;
  relation: string;
  isPrimary: boolean;
}

export interface AdmissionResult {
  registrationId: string;
  applicationNumber: string;
  alreadyAdmitted: boolean;
  student: { id: string; registrationCode: string; fullName: string; className: string | null; sectionName: string | null; rollNumber: string | null };
  enrollmentId: string;
  yearName: string;
  guardians: AdmissionGuardian[];
  notes: string[];
}

export interface AdmissionProblem {
  field: string;
  code: string;
  message: string;
}

export type BatchOutcome = 'would_admit' | 'admitted' | 'already_admitted' | 'problem';

export interface BatchRow {
  registrationId: string;
  applicationNumber: string;
  outcome: BatchOutcome;
  problems: AdmissionProblem[];
  result?: AdmissionResult;
}

export interface BatchResult {
  rows: BatchRow[];
  okCount: number;
  problemCount: number;
}

export interface ClassSectionChoice {
  sectionId: string;
  sectionName: string;
}

export const MAX_BATCH = 200;
export const PAGE_SIZE = 25;

export const GENDER_CHOICES = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
];

/** An error from the admissions API: the status, the problem code, the message for the whole form, and one entry per field. */
export class AdmissionsError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly fields: Record<string, AdmissionProblem>,
    message: string,
  ) {
    super(message);
  }

  /** The server asked for a yes before admitting a second student with the same name and date of birth. */
  get needsDuplicateConfirmation(): boolean {
    return this.fields.confirmDuplicate?.code === 'possible_duplicate';
  }

  /** Field messages as the form shows them; the duplicate question is asked separately, not as a field error. */
  get fieldMessages(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(this.fields)) if (k !== 'confirmDuplicate') out[k] = v.message;
    return out;
  }
}

type ProblemBody = { code?: string; detail?: string; errors?: AdmissionProblem[] };

/** Reads a failed answer into an AdmissionsError. The first message for a field wins. */
export async function readFailure(res: Response): Promise<AdmissionsError> {
  let p: ProblemBody = {};
  try {
    p = (await res.json()) as ProblemBody;
  } catch {
    /* not JSON */
  }
  const fields: Record<string, AdmissionProblem> = {};
  for (const e of p.errors ?? []) fields[e.field] ??= e;
  const conflict: Record<string, string> = {
    not_accepted: 'Only an accepted registration can be admitted.',
    not_eligible: 'This registration cannot be admitted.',
    student_removed: 'The student created from this registration was removed.',
  };
  return new AdmissionsError(res.status, p.code ?? 'error', fields, p.detail ?? conflict[p.code ?? ''] ?? 'Something went wrong. Please try again.');
}

const clean = (v: string) => v.trim();
const orNothing = (v: string) => (clean(v) ? clean(v) : undefined);

/** The request body for one admission: the section, plus each optional value only when it was typed. */
export function buildAdmitBody(f: AdmitForm): Record<string, unknown> {
  const body: Record<string, unknown> = { sectionId: f.sectionId };
  const optional: [string, string][] = [
    ['rollNumber', f.rollNumber],
    ['studentCode', f.studentCode],
    ['gender', f.gender],
    ['admissionDate', f.admissionDate],
    ['parentEmail', f.parentEmail],
  ];
  for (const [k, v] of optional) {
    const t = orNothing(v);
    if (t !== undefined) body[k] = t;
  }
  if (f.confirmDuplicate) body.confirmDuplicate = true;
  return body;
}

/** The request body for a preview or bulk admit: one entry per selected registration. */
export function buildBatchBody(entries: { registrationId: string; form: AdmitForm }[]): { items: Record<string, unknown>[] } {
  return { items: entries.map((e) => ({ registrationId: e.registrationId, ...buildAdmitBody(e.form) })) };
}

export interface ListQuery {
  state: AdmissionState;
  classId?: string;
  yearId?: string;
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: string;
}

/** The query string for the queue. Empty filters are not sent. */
export function buildListQuery(q: ListQuery): string {
  const p = new URLSearchParams({ state: q.state, page: String(q.page ?? 1), pageSize: String(q.pageSize ?? PAGE_SIZE) });
  if (q.classId) p.set('classId', q.classId);
  if (q.yearId) p.set('yearId', q.yearId);
  if (q.search?.trim()) p.set('q', q.search.trim());
  if (q.sort) p.set('sort', q.sort);
  return p.toString();
}

/** Where the student created by an admission can be found on the Students screen. */
export const studentHref = (code: string): string => `/students?q=${encodeURIComponent(code)}`;

/** Where the Registrations screen sends someone to admit one accepted registration. */
export const admitHref = (registrationId: string): string => `/admissions?registration=${encodeURIComponent(registrationId)}`;

/** Plain words for how a row of a preview or bulk answer turned out. */
export function outcomeLabel(o: BatchOutcome, preview: boolean): string {
  switch (o) {
    case 'would_admit':
      return 'Ready to admit';
    case 'admitted':
      return 'Admitted';
    case 'already_admitted':
      return preview ? 'Already admitted' : 'Already admitted, nothing changed';
    default:
      return 'Needs attention';
  }
}

export function successMessage(r: AdmissionResult): string {
  return r.alreadyAdmitted ? `${r.student.fullName} was already admitted as ${r.student.registrationCode}. Nothing was changed.` : `${r.student.fullName} is admitted as ${r.student.registrationCode}.`;
}

/** The calls the admissions screen makes. Every call goes through the signed-in session. */
export function createAdmissionsApi(session: Session) {
  const call = async <T>(method: string, path: string, body?: unknown): Promise<{ status: number; data: T }> => {
    let res: Response;
    try {
      res = await session.fetch(`${API_BASE}${path}`, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new AdmissionsError(0, 'network', {}, 'Cannot reach the server. Check your connection.');
    }
    if (!res.ok) throw await readFailure(res);
    return { status: res.status, data: (await res.json()) as T };
  };
  return {
    list: async (q: ListQuery) => (await call<{ items: Admission[]; page: { total: number } }>('GET', `/admissions?${buildListQuery(q)}`)).data,
    get: async (id: string) => (await call<Admission>('GET', `/admissions/${encodeURIComponent(id)}`)).data,
    admit: async (id: string, form: AdmitForm) => (await call<AdmissionResult>('POST', `/admissions/${encodeURIComponent(id)}/admit`, buildAdmitBody(form))).data,
    preview: async (entries: { registrationId: string; form: AdmitForm }[]) => (await call<BatchResult>('POST', '/admissions/preview', buildBatchBody(entries))).data,
    bulk: async (entries: { registrationId: string; form: AdmitForm }[]) => (await call<BatchResult>('POST', '/admissions/bulk', buildBatchBody(entries))).data,
    /** Sections that belong to a class in an academic year: the only valid choices for a registration. */
    sections: async (classId: string, yearId: string): Promise<ClassSectionChoice[]> => {
      const p = new URLSearchParams({ classId, yearId, page: '1', pageSize: '200', sort: 'sectionName' });
      const r = await call<{ items: { classId: string; yearId: string; sectionId: string; sectionName: string }[] }>('GET', `/class-section-mappings?${p.toString()}`);
      return r.data.items.filter((m) => m.classId === classId && m.yearId === yearId).map((m) => ({ sectionId: m.sectionId, sectionName: m.sectionName }));
    },
    options: async (endpoint: '/classes' | '/academic-years') => (await call<{ items: { id: string; name: string }[] }>('GET', `${endpoint}?page=1&pageSize=200`)).data.items,
  };
}

export type AdmissionsApi = ReturnType<typeof createAdmissionsApi>;
