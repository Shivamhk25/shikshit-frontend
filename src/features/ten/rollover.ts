import type { Session } from '@shikshit/shared/session';
import { API_BASE } from '../../shell/web-session';

/** TEN-01 Year rollover (backend api/openapi/modules/ten-year-rollover.yaml): the answer shapes, the calls, and the
 * small rules the wizard needs. The wizard has three parts: choose the two years, work through a checklist of steps
 * (each with a preview), then read what each step did. */

export type StepId = 'terms' | 'class_sections' | 'subject_classes' | 'holidays' | 'calendar_events' | 'make_current';
export type ItemStatus = 'create' | 'exists' | 'conflict' | 'skipped';

export const PAGE_SIZE = 25;
export const MAKE_CURRENT: StepId = 'make_current';

export interface YearOption {
  id: string;
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  status: 'active' | 'inactive';
}

export interface Shift {
  mode: 'years' | 'days';
  years: number;
  days: number;
}

export interface LastRun {
  id: string;
  ranAt: string;
  runByName: string | null;
  createdCount: number;
  existingCount: number;
  skippedCount: number;
  conflictCount: number;
  reviewCount: number;
}

export interface ChecklistStep {
  id: StepId;
  title: string;
  description: string;
  defaultOn: boolean;
  irreversible: boolean;
  sourceCount: number;
  targetCount: number;
  lastRun?: LastRun;
}

export interface Checklist {
  from: YearOption;
  to: YearOption;
  shift: Shift;
  steps: ChecklistStep[];
  promotions: { sections: number; promoted: number };
  notes: string[];
}

export interface Item {
  label: string;
  status: ItemStatus;
  reason: string;
  message: string;
  detail: string;
  review: boolean;
}

export interface StepResult {
  step: StepId;
  dryRun: boolean;
  fromYearId: string;
  toYearId: string;
  createdCount: number;
  existingCount: number;
  skippedCount: number;
  conflictCount: number;
  reviewCount: number;
  items: Item[];
  itemsTruncated: boolean;
  warnings: string[];
  blockers: string[];
  shift: Shift;
  runId: string | null;
  ranAt: string | null;
}

export interface Run {
  id: string;
  fromYearId: string;
  fromYearName: string;
  toYearId: string;
  toYearName: string;
  step: StepId;
  status: 'completed' | 'failed';
  createdCount: number;
  existingCount: number;
  skippedCount: number;
  conflictCount: number;
  reviewCount: number;
  warnings: string[];
  error: string | null;
  runByName: string | null;
  ranAt: string;
}

export interface NewYear {
  code: string;
  name: string;
  startDate: string;
  endDate: string;
}

export interface Problem {
  field: string;
  code: string;
  message: string;
}

/** An error from the rollover API: the status, the problem code, the message, and the reasons the server listed. */
export class RolloverError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly reasons: Problem[],
    message: string,
  ) {
    super(message);
  }

  /** The first message the server gave for a field, if any. */
  fieldMessage(field: string): string | undefined {
    return this.reasons.find((r) => r.field === field)?.message;
  }
}

type ProblemBody = { code?: string; detail?: string; errors?: Problem[] };

const KNOWN: Record<string, string> = {
  blocked: 'This step cannot run yet. Nothing was changed.',
  permission_denied: 'You do not have permission to do this.',
};

/** Reads a failed answer into a RolloverError. */
export async function readFailure(res: Response): Promise<RolloverError> {
  let p: ProblemBody = {};
  try {
    p = (await res.json()) as ProblemBody;
  } catch {
    /* not JSON */
  }
  const code = p.code ?? 'error';
  return new RolloverError(res.status, code, p.errors ?? [], p.detail ?? KNOWN[code] ?? 'Something went wrong. Please try again.');
}

/** How the dates move, in words. */
export function shiftText(s: Shift): string {
  if (s.mode === 'years') return s.years === 1 ? 'Dates move forward by 1 year.' : `Dates move forward by ${s.years} years.`;
  return `Dates move forward by ${s.days} ${s.days === 1 ? 'day' : 'days'}, because the two years start on different days.`;
}

/** "1 term", "3 terms". */
export function count(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** The parts of a result that are not zero: "2 to copy · 1 already there · 1 cannot be copied". */
export function resultText(r: Pick<StepResult, 'createdCount' | 'existingCount' | 'skippedCount' | 'conflictCount' | 'reviewCount' | 'dryRun'>): string {
  const parts: string[] = [];
  if (r.createdCount) parts.push(`${r.createdCount} ${r.dryRun ? 'to copy' : 'copied'}`);
  if (r.existingCount) parts.push(`${r.existingCount} already there`);
  if (r.skippedCount) parts.push(`${r.skippedCount} skipped`);
  if (r.conflictCount) parts.push(`${r.conflictCount} cannot be copied`);
  return parts.length ? parts.join(' · ') : 'Nothing to copy';
}

export const ITEM_WORDS: Record<ItemStatus, string> = { create: 'Copy', exists: 'Already there', conflict: 'Cannot copy', skipped: 'Skipped' };

/** Short wording for the stable reason codes the server gives for a conflict or a skip. */
export function reasonText(code: string): string {
  const words: Record<string, string> = {
    outside_year: 'Falls outside the new year',
    overlaps_term: 'Overlaps another term',
    class_deleted: 'Class no longer exists',
    section_deleted: 'Section no longer exists',
    subject_deleted: 'Subject no longer exists',
    section_not_mapped: 'Section not mapped yet',
    recurring_annual: 'Repeats every year',
  };
  return words[code] ?? code;
}

/** Adds one year to a year's name: "2026-27" becomes "2027-28", "2026-2027" becomes "2027-2028", "2026" becomes "2027". */
export function nextYearName(name: string): string {
  const full = /(\d{4})-(\d{4})/.exec(name);
  if (full) return name.replace(full[0], `${Number(full[1]) + 1}-${Number(full[2]) + 1}`);
  const short = /(\d{4})-(\d{2})\b/.exec(name);
  if (short) return name.replace(short[0], `${Number(short[1]) + 1}-${String((Number(short[2]) + 1) % 100).padStart(2, '0')}`);
  const one = /\b(\d{4})\b/.exec(name);
  return one ? name.replace(one[0], String(Number(one[1]) + 1)) : '';
}

/** "2026-04-01" plus one year, as text; 29 February becomes 28 February. */
export function plusYear(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) return '';
  const y = Number(m[1]) + 1;
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const day = m[2] === '02' && m[3] === '29' && !leap ? '28' : m[3];
  return `${y}-${m[2]}-${day}`;
}

/** What the wizard pre-fills for the year after `from`. */
export function suggestNewYear(from: Pick<YearOption, 'code' | 'name' | 'startDate' | 'endDate'>): NewYear {
  return { code: nextYearName(from.code) || nextYearName(from.name), name: nextYearName(from.name), startDate: plusYear(from.startDate), endDate: plusYear(from.endDate) };
}

/** The year the wizard proposes to roll over from: the current one, else the latest. */
export function defaultFrom(years: YearOption[]): string {
  return (years.find((y) => y.isCurrent) ?? [...years].sort((a, b) => b.startDate.localeCompare(a.startDate))[0])?.id ?? '';
}

/** Years that start after `from`, oldest first, so the first is the natural next year. */
export function yearsAfter(years: YearOption[], fromId: string): YearOption[] {
  const from = years.find((y) => y.id === fromId);
  if (!from) return [];
  return years.filter((y) => y.startDate > from.startDate).sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/** The steps ticked when the checklist opens: the ones the server turns on by default, none that cannot run. */
export function defaultSelection(steps: ChecklistStep[], canRun: boolean): StepId[] {
  return canRun ? steps.filter((s) => s.defaultOn && !s.irreversible).map((s) => s.id) : [];
}

/** The ticked steps in the order of the checklist, which is the order to run them in. */
export function inChecklistOrder(steps: ChecklistStep[], picked: Iterable<StepId>): StepId[] {
  const set = new Set(picked);
  return steps.filter((s) => set.has(s.id)).map((s) => s.id);
}

export interface Pair {
  fromYearId: string;
  toYearId: string;
}

/** The calls the wizard makes. Every call goes through the signed-in session. */
export function createRolloverApi(session: Session) {
  const call = async <T>(method: string, path: string, body?: unknown): Promise<T> => {
    let res: Response;
    try {
      res = await session.fetch(`${API_BASE}${path}`, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new RolloverError(0, 'network', [], 'Cannot reach the server. Check your connection.');
    }
    if (!res.ok) throw await readFailure(res);
    return (await res.json()) as T;
  };
  const q = (p: Pair) => new URLSearchParams({ fromYearId: p.fromYearId, toYearId: p.toYearId }).toString();
  return {
    years: async (): Promise<YearOption[]> => (await call<{ items: YearOption[] }>('GET', '/academic-years?page=1&pageSize=200&sort=startDate')).items,
    checklist: (p: Pair) => call<Checklist>('GET', `/year-rollover/checklist?${q(p)}`),
    createYear: (fromYearId: string, y: NewYear) => call<YearOption>('POST', '/year-rollover/years', { fromYearId, code: y.code.trim(), name: y.name.trim(), startDate: y.startDate, endDate: y.endDate }),
    preview: (step: StepId, p: Pair) => call<StepResult>('POST', `/year-rollover/steps/${encodeURIComponent(step)}/preview`, p),
    run: (step: StepId, p: Pair, confirm: boolean) => call<StepResult>('POST', `/year-rollover/steps/${encodeURIComponent(step)}/run`, { ...p, confirm }),
    history: (page: number) => call<{ items: Run[]; page: { total: number } }>('GET', `/year-rollover/history?page=${page}&pageSize=${PAGE_SIZE}`),
  };
}

export type RolloverApi = ReturnType<typeof createRolloverApi>;
