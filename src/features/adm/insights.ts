import type { Session } from '@shikshit/shared/session';
import { ApiError } from '../../crud/client';
import { SOURCES, STATUSES, type EnquirySource, type EnquiryStatus } from './enquiries';
import { REGISTRATION_STATUSES, type RegistrationStatus } from './registrations';

/** ADM-02 Admission insights (backend api/openapi/modules/adm-insights.yaml). One read-only call returns every figure. */

export interface Conversion {
  of: number;
  converted: number;
  /** 0 to 1, or null when there is nothing to divide by. */
  rate: number | null;
}

export interface TrendPoint {
  /** YYYY-MM */
  month: string;
  enquiries: number;
  registrations: number;
}

export interface AdmissionInsights {
  asOf: string;
  trendFrom: string;
  trendTo: string;
  enquiries: { total: number; byStatus: Record<EnquiryStatus, number>; bySource: Record<EnquirySource, number> };
  followUps: { due: number; dueToday: number; overdue: number };
  /**
   * `byStatus.accepted` means accepted ever, so it includes the admitted. `admitted` is the part that has been admitted
   * (the same registrations as the admissions list with state=admitted).
   */
  registrations: { total: number; admitted: number; byStatus: Record<RegistrationStatus, number> };
  conversion: {
    enquiryToRegistration: Conversion;
    registrationToAccepted: Conversion;
    /** Admitted out of accepted (admitted ones included). The server always sends it; null only from an older server. */
    acceptedToAdmitted: Conversion | null;
  };
  trend: TrendPoint[];
}

export interface InsightsFilters {
  yearId: string;
  classId: string;
  from: string;
  to: string;
}

export const NO_FILTERS: InsightsFilters = { yearId: '', classId: '', from: '', to: '' };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The query string for the filters; blank and malformed values are left out so the server never sees them. */
export function insightsQuery(f: InsightsFilters): string {
  const q = new URLSearchParams();
  if (f.yearId) q.set('yearId', f.yearId);
  if (f.classId) q.set('classId', f.classId);
  if (DATE.test(f.from)) q.set('from', f.from);
  if (DATE.test(f.to)) q.set('to', f.to);
  return q.toString();
}

/** A message when the date range cannot be asked for, otherwise ''. */
export function rangeProblem(f: InsightsFilters): string {
  return DATE.test(f.from) && DATE.test(f.to) && f.to < f.from ? 'The end date is before the start date.' : '';
}

async function failure(res: Response): Promise<ApiError> {
  let p: { code?: string; detail?: string } = {};
  try {
    p = (await res.json()) as typeof p;
  } catch {
    /* not JSON */
  }
  return new ApiError(res.status, p.code ?? 'error', {}, p.detail ?? 'Something went wrong. Please try again.');
}

export function createInsightsApi(session: Pick<Session, 'fetch'>, base: string) {
  return {
    async get(f: InsightsFilters): Promise<AdmissionInsights> {
      const q = insightsQuery(f);
      let res: Response;
      try {
        res = await session.fetch(`${base}/admission-insights${q ? `?${q}` : ''}`, { method: 'GET' });
      } catch {
        throw new ApiError(0, 'network', {}, 'Cannot reach the server. Check your connection.');
      }
      if (!res.ok) throw await failure(res);
      return (await res.json()) as AdmissionInsights;
    },
  };
}
export type InsightsApi = ReturnType<typeof createInsightsApi>;

const NUMBER = new Intl.NumberFormat('en-IN');
/** 1234567 as "12,34,567", the way people in India read it. */
export const formatCount = (n: number): string => NUMBER.format(n);

/** 0.4 as "40%", 0.4567 as "45.7%", and a missing rate as a dash. */
export function formatRate(rate: number | null | undefined): string {
  if (rate === null || rate === undefined || Number.isNaN(rate)) return '—';
  const pct = Math.round(rate * 1000) / 10;
  return `${Number.isInteger(pct) ? pct : pct.toFixed(1)}%`;
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "2026-11" as "Nov 2026". */
export function monthLabel(ym: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  return m ? `${MONTH_NAMES[Number(m[2]) - 1] ?? ''} ${m[1]}` : ym;
}
/** "2026-11" as "Nov". */
export const monthShort = (ym: string): string => monthLabel(ym).split(' ')[0] ?? ym;

export const enquiryStatusLabel = (v: string) => STATUSES.find((s) => s.value === v)?.label ?? v;
export const sourceLabel = (v: string) => SOURCES.find((s) => s.value === v)?.label ?? v;
export const registrationStatusLabel = (v: string) => REGISTRATION_STATUSES.find((s) => s.value === v)?.label ?? v;

/**
 * Link to the enquiries, registrations or admissions list for one figure. The lists read `status`, `classId`,
 * `source`, `followUpDue` (and `yearId` for registrations and admissions, with `state` on admissions) from the
 * address; the date range is not a list filter, so it is not passed on.
 */
export function drillHref(list: 'enquiries' | 'registrations' | 'admissions', f: InsightsFilters, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams();
  Object.entries(extra).forEach(([k, v]) => v && q.set(k, v));
  if (f.classId) q.set('classId', f.classId);
  if (list !== 'enquiries' && f.yearId) q.set('yearId', f.yearId);
  const s = q.toString();
  return `/${list}${s ? `?${s}` : ''}`;
}

const csvCell = (v: string | number | null): string => {
  const s = v === null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** The figures as CSV text: one "Section, Measure, Value" row each, then the monthly trend. */
export function insightsCsv(d: AdmissionInsights, f: InsightsFilters, labels: { year?: string; className?: string } = {}): string {
  const rows: (string | number | null)[][] = [
    ['Section', 'Measure', 'Value'],
    ['Report', 'As of', d.asOf],
    ['Report', 'Academic year', labels.year || 'All'],
    ['Report', 'Class', labels.className || 'All'],
    ['Report', 'From', f.from || 'All time'],
    ['Report', 'To', f.to || 'All time'],
    ['Enquiries', 'Total', d.enquiries.total],
    ...STATUSES.map((s): (string | number)[] => ['Enquiries by status', s.label, d.enquiries.byStatus[s.value] ?? 0]),
    ...SOURCES.map((s): (string | number)[] => ['Enquiries by source', s.label, d.enquiries.bySource[s.value] ?? 0]),
    ['Follow-ups', 'Due', d.followUps.due],
    ['Follow-ups', 'Due today', d.followUps.dueToday],
    ['Follow-ups', 'Overdue', d.followUps.overdue],
    ['Registrations', 'Total', d.registrations.total],
    ...REGISTRATION_STATUSES.map((s): (string | number)[] => ['Registrations by status', s.label, d.registrations.byStatus[s.value] ?? 0]),
    ['Registrations', 'Admitted', d.registrations.admitted ?? 0],
    ['Conversion', 'Enquiries with a registration', d.conversion.enquiryToRegistration.converted],
    ['Conversion', 'Enquiries counted', d.conversion.enquiryToRegistration.of],
    ['Conversion', 'Enquiry to registration', d.conversion.enquiryToRegistration.rate === null ? null : formatRate(d.conversion.enquiryToRegistration.rate)],
    ['Conversion', 'Registrations accepted', d.conversion.registrationToAccepted.converted],
    ['Conversion', 'Registrations counted', d.conversion.registrationToAccepted.of],
    ['Conversion', 'Registration to accepted', d.conversion.registrationToAccepted.rate === null ? null : formatRate(d.conversion.registrationToAccepted.rate)],
    ...(d.conversion.acceptedToAdmitted
      ? [
          ['Conversion', 'Registrations admitted', d.conversion.acceptedToAdmitted.converted],
          ['Conversion', 'Accepted registrations counted for admission', d.conversion.acceptedToAdmitted.of],
          ['Conversion', 'Accepted to admitted', d.conversion.acceptedToAdmitted.rate === null ? null : formatRate(d.conversion.acceptedToAdmitted.rate)],
        ]
      : []),
    ...d.trend.map((t): (string | number)[] => ['Monthly trend', `${monthLabel(t.month)}: enquiries`, t.enquiries]),
    ...d.trend.map((t): (string | number)[] => ['Monthly trend', `${monthLabel(t.month)}: registrations`, t.registrations]),
  ];
  return `${rows.map((r) => r.map(csvCell).join(',')).join('\n')}\n`;
}
