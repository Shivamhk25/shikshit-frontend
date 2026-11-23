import type { Session } from '@shikshit/shared/session';
import { API_BASE } from '../../shell/web-session';

/** STU-07 Student promotions (backend api/openapi/modules/stu-promotions.yaml): the answer shapes, the calls, and the
 * small rules the wizard needs. The wizard is two steps: decide who moves, repeats or graduates; then choose sections
 * and roll numbers, preview, and commit. */

export type Decision = 'promote' | 'repeat' | 'graduate' | 'leave_out';
export type RollMode = 'keep' | 'alphabetical' | 'blank';
export type BatchStatus = 'draft' | 'committed' | 'undone';

export const DECISIONS: { value: Decision; label: string }[] = [
  { value: 'promote', label: 'Promote' },
  { value: 'repeat', label: 'Repeat the class' },
  { value: 'graduate', label: 'Graduate' },
  { value: 'leave_out', label: 'Leave out' },
];

export const ROLL_MODES: { value: RollMode; label: string; hint: string }[] = [
  { value: 'alphabetical', label: 'Renumber alphabetically', hint: 'In name order, continuing after the highest number the section already has.' },
  { value: 'keep', label: 'Keep each roll number', hint: 'A roll number that is already taken in the new section is flagged.' },
  { value: 'blank', label: 'Leave blank', hint: 'Fill them in later on the Enrollments screen.' },
];

export const MAX_ROWS = 300;
export const PAGE_SIZE = 25;
export const UNDO_DAYS = 7;

export interface Batch {
  id: string;
  fromYearId: string;
  fromYearName: string;
  toYearId: string;
  toYearName: string;
  fromClassId: string;
  fromClassName: string;
  fromSectionId: string;
  fromSectionName: string;
  rollMode: RollMode;
  note: string | null;
  status: BatchStatus;
  studentCount: number;
  promoteCount: number;
  repeatCount: number;
  graduateCount: number;
  leaveOutCount: number;
  committedAt: string | null;
  committedByName: string | null;
  undoUntil: string | null;
  canUndo: boolean;
  duesOverrideReason: string | null;
  undoneAt: string | null;
  undoneByName: string | null;
  undoReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BatchRow {
  studentId: string;
  registrationCode: string;
  studentName: string;
  studentStatus: 'active' | 'paused' | 'transferred' | 'alumni';
  enrollmentId: string;
  rollNumber: string | null;
  decision: Decision;
  toClassId: string | null;
  toClassName: string | null;
  toSectionId: string | null;
  toSectionName: string | null;
  newRollNumber: string | null;
  newEnrollmentId: string | null;
  enrolledClassName: string | null;
  enrolledSectionName: string | null;
  enrolledRollNumber: string | null;
}

export interface Detail {
  batch: Batch;
  rows: BatchRow[];
}

export interface Candidate {
  studentId: string;
  registrationCode: string;
  studentName: string;
  studentStatus: BatchRow['studentStatus'];
  enrollmentId: string;
  rollNumber: string | null;
  decision: Decision;
  toClassId: string | null;
  toClassName: string | null;
}

export interface Proposal {
  fromYearId: string;
  fromYearName: string;
  toYearId: string;
  toYearName: string;
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string;
  nextClassId: string | null;
  nextClassName: string | null;
  isLastClass: boolean;
  existingBatchId: string | null;
  existingBatchStatus: 'draft' | 'committed' | null;
  candidates: Candidate[];
}

export interface Problem {
  field: string;
  code: string;
  message: string;
}

export interface OutcomeRow {
  studentId: string;
  registrationCode: string;
  studentName: string;
  decision: Decision;
  outcome: 'enrol' | 'graduate' | 'leave_out' | 'problem';
  toClassId: string | null;
  toClassName: string | null;
  toSectionId: string | null;
  toSectionName: string | null;
  rollNumber: string | null;
  enrollmentId: string | null;
  problems: Problem[];
}

export interface Outcome {
  batch: Batch;
  rows: OutcomeRow[];
  committed: boolean;
  alreadyCommitted: boolean;
  undone: boolean;
  alreadyUndone: boolean;
  enrolledCount: number;
  graduatedCount: number;
  leftOutCount: number;
  problemCount: number;
  warnings: string[];
  duesOverridden: boolean;
}

/** One student's decision as the wizard holds it. Empty strings mean "not chosen / default". */
export interface RowForm {
  studentId: string;
  decision: Decision;
  toClassId: string;
  toSectionId: string;
  rollNumber: string;
}

export interface Source {
  fromYearId: string;
  toYearId: string;
  classId: string;
  sectionId: string;
}

export interface Choice {
  id: string;
  name: string;
}

export interface ClassSectionMap {
  classId: string;
  sectionId: string;
  sectionName: string;
}

/** An error from the promotions API: the status, the problem code, the message, and the reasons the server listed. */
export class PromotionsError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly reasons: Problem[],
    message: string,
  ) {
    super(message);
  }
}

type ProblemBody = { code?: string; detail?: string; errors?: Problem[] };

const KNOWN: Record<string, string> = {
  not_draft: 'This promotion is already committed, so it cannot be changed. Undo it if it was a mistake.',
  undone: 'This promotion was undone. Start a new one for the class section.',
  not_committed: 'This promotion has not been committed yet.',
  has_problems: 'Some students have problems. Nothing was changed. Preview the promotion and fix them.',
  cannot_undo: 'This promotion can no longer be undone. Nothing was changed.',
  permission_denied: 'You do not have permission to do this.',
};

/** Reads a failed answer into a PromotionsError. */
export async function readFailure(res: Response): Promise<PromotionsError> {
  let p: ProblemBody = {};
  try {
    p = (await res.json()) as ProblemBody;
  } catch {
    /* not JSON */
  }
  const code = p.code ?? 'error';
  return new PromotionsError(res.status, code, p.errors ?? [], p.detail ?? KNOWN[code] ?? 'Something went wrong. Please try again.');
}

/** The first message the server gave for a field of a row ("rows[2].toClassId"), if any. */
export function rowError(err: PromotionsError | null, index: number): string | undefined {
  return err?.reasons.find((r) => r.field.startsWith(`rows[${index}].`))?.message;
}

const orNothing = (v: string) => (v.trim() ? v.trim() : null);

/** The rows as the server takes them: a class only for promote, a section and roll number only for promote and repeat. */
export function buildRows(rows: RowForm[]): Record<string, unknown>[] {
  return rows.map((r) => {
    const moves = r.decision === 'promote' || r.decision === 'repeat';
    return {
      studentId: r.studentId,
      decision: r.decision,
      toClassId: r.decision === 'promote' ? orNothing(r.toClassId) : null,
      toSectionId: moves ? orNothing(r.toSectionId) : null,
      rollNumber: moves ? orNothing(r.rollNumber) : null,
    };
  });
}

/** The wizard's rows from a proposal (the server's defaults) or from a saved draft. */
export function formsFromProposal(p: Proposal): RowForm[] {
  return p.candidates.map((c) => ({ studentId: c.studentId, decision: c.decision, toClassId: c.toClassId ?? '', toSectionId: '', rollNumber: '' }));
}
export function formsFromDetail(d: Detail): RowForm[] {
  return d.rows.map((r) => ({ studentId: r.studentId, decision: r.decision, toClassId: r.decision === 'promote' ? (r.toClassId ?? '') : '', toSectionId: r.toSectionId ?? '', rollNumber: r.newRollNumber ?? '' }));
}

/** Counts of each decision, for the summary line. */
export function tally(rows: RowForm[]): Record<Decision, number> {
  const t: Record<Decision, number> = { promote: 0, repeat: 0, graduate: 0, leave_out: 0 };
  for (const r of rows) t[r.decision] += 1;
  return t;
}

/** "3 promoted, 1 repeating, 2 graduating, 1 left out" (only the parts that are not zero). */
export function tallyText(t: Record<Decision, number>): string {
  const parts: [number, string][] = [
    [t.promote, 'to promote'],
    [t.repeat, 'repeating'],
    [t.graduate, 'graduating'],
    [t.leave_out, 'left out'],
  ];
  const shown = parts.filter(([n]) => n > 0).map(([n, w]) => `${n} ${w}`);
  return shown.length ? shown.join(', ') : 'No students';
}

/** Sections a class has in the new year, in the order the server sent them. */
export function sectionsOf(maps: ClassSectionMap[], classId: string): Choice[] {
  return maps.filter((m) => m.classId === classId).map((m) => ({ id: m.sectionId, name: m.sectionName }));
}

/** The class a row is moving to, as the wizard shows it: the chosen class, the source class when repeating. */
export function targetClassId(r: RowForm, sourceClassId: string): string {
  if (r.decision === 'repeat') return sourceClassId;
  if (r.decision === 'promote') return r.toClassId;
  return '';
}

/** Words for a decision when it is already made (the result screen). */
export function decisionLabel(d: Decision): string {
  return DECISIONS.find((x) => x.value === d)?.label ?? d;
}

/** What the server did (or would do) for a row, in plain words. */
export function outcomeText(r: OutcomeRow): string {
  switch (r.outcome) {
    case 'enrol':
      return `${r.toClassName ?? ''} · ${r.toSectionName ?? ''}${r.rollNumber ? ` · roll ${r.rollNumber}` : ' · no roll number'}`;
    case 'graduate':
      return 'Graduates (marked alumni)';
    case 'leave_out':
      return 'Left out: nothing changes';
    default:
      return 'Needs attention';
  }
}

export function undoReasonText(code: string): string {
  const words: Record<string, string> = {
    window_closed: 'The undo window has closed.',
    enrolment_changed: 'A new enrolment was edited.',
    enrolment_removed: 'A new enrolment was removed.',
    promoted_onward: 'The student was promoted again.',
    status_changed: 'The student status changed.',
    student_removed: 'The student was removed.',
  };
  return words[code] ?? code;
}

export interface ListQuery {
  status?: BatchStatus | '';
  page?: number;
  pageSize?: number;
}

/** The query string for the history list. Empty filters are not sent. */
export function buildListQuery(q: ListQuery): string {
  const p = new URLSearchParams({ page: String(q.page ?? 1), pageSize: String(q.pageSize ?? PAGE_SIZE) });
  if (q.status) p.set('status', q.status);
  return p.toString();
}

export function proposalQuery(s: Source): string {
  return new URLSearchParams({ fromYearId: s.fromYearId, toYearId: s.toYearId, classId: s.classId, sectionId: s.sectionId }).toString();
}

/** The calls the wizard makes. Every call goes through the signed-in session. */
export function createPromotionsApi(session: Session) {
  const call = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    let res: Response;
    try {
      res = await session.fetch(`${API_BASE}${path}`, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new PromotionsError(0, 'network', [], 'Cannot reach the server. Check your connection.');
    }
    if (!res.ok) throw await readFailure(res);
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  };
  const id = encodeURIComponent;
  return {
    list: (q: ListQuery) => call<{ items: Batch[]; page: { total: number } }>('GET', `/promotions?${buildListQuery(q)}`),
    proposal: (s: Source) => call<Proposal>('GET', `/promotions/proposal?${proposalQuery(s)}`),
    get: (batchId: string) => call<Detail>('GET', `/promotions/${id(batchId)}`),
    create: (s: Source, rollMode: RollMode, rows: RowForm[]) =>
      call<Detail>('POST', '/promotions', { fromYearId: s.fromYearId, toYearId: s.toYearId, fromClassId: s.classId, fromSectionId: s.sectionId, rollMode, rows: buildRows(rows) }),
    save: (batchId: string, rollMode: RollMode, rows: RowForm[]) => call<Detail>('PUT', `/promotions/${id(batchId)}`, { rollMode, rows: buildRows(rows) }),
    discard: (batchId: string) => call<void>('DELETE', `/promotions/${id(batchId)}`),
    preview: (batchId: string) => call<Outcome>('POST', `/promotions/${id(batchId)}/preview`),
    commit: (batchId: string) => call<Outcome>('POST', `/promotions/${id(batchId)}/commit`),
    undo: (batchId: string, reason: string) => call<Outcome>('POST', `/promotions/${id(batchId)}/undo`, { reason: reason.trim() }),
    options: async (endpoint: '/classes' | '/academic-years'): Promise<Choice[]> => (await call<{ items: Choice[] }>('GET', `${endpoint}?page=1&pageSize=200&sort=${endpoint === '/classes' ? 'displayOrder' : 'startDate'}`)).items,
    /** The sections each class has in one academic year. */
    classSections: async (yearId: string): Promise<ClassSectionMap[]> => {
      const p = new URLSearchParams({ yearId, page: '1', pageSize: '200', sort: 'sectionName' });
      const r = await call<{ items: { classId: string; yearId: string; sectionId: string; sectionName: string }[] }>('GET', `/class-section-mappings?${p.toString()}`);
      return r.items.filter((m) => m.yearId === yearId).map((m) => ({ classId: m.classId, sectionId: m.sectionId, sectionName: m.sectionName }));
    },
  };
}

export type PromotionsApi = ReturnType<typeof createPromotionsApi>;
