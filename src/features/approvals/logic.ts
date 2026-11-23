import type { Approval, ApprovalEvent, ApprovalStatus, Delegation, DelegationStatus } from './approvalsApi';

export const STATUS_LABEL: Record<ApprovalStatus, string> = { pending: 'Waiting', approved: 'Approved', rejected: 'Rejected', cancelled: 'Withdrawn' };

export const STATUS_TONE: Record<ApprovalStatus, string> = {
  pending: 'border-warning-line bg-warning-bg text-warning',
  approved: 'border-success-line bg-success-bg text-success',
  rejected: 'border-danger-line bg-danger-bg text-danger',
  cancelled: 'border-line bg-subtle text-fg-muted',
};

export const EVENT_LABEL: Record<ApprovalEvent['action'], string> = { submitted: 'sent this for approval', approved: 'approved', rejected: 'rejected', cancelled: 'withdrew this request' };

/** "2 of 3". */
export function stepText(a: Pick<Approval, 'currentStep' | 'stepCount'>): string {
  return `${a.currentStep} of ${a.stepCount}`;
}

/** How long a request has been open: "Just now", "35 min", "5 h", "1 day", "6 days", "3 weeks". */
export function waitingTime(iso: string, now = new Date()): string {
  const mins = Math.floor((now.getTime() - new Date(iso).getTime()) / 60_000);
  if (Number.isNaN(mins) || mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 14) return days === 1 ? '1 day' : `${days} days`;
  return `${Math.floor(days / 7)} weeks`;
}

/** The time line under a row: open requests say how long they have waited, closed ones when they were decided. */
export function rowTiming(a: Approval, now = new Date()): string {
  if (a.status === 'pending' || !a.decidedAt) return `Waiting ${waitingTime(a.createdAt, now)}`;
  return `${STATUS_LABEL[a.status]} ${new Date(a.decidedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export function money(amount: number | null): string | null {
  return amount === null ? null : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(amount);
}

export function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** The most a handover may last, counted from its start (decision 0022; the server enforces the same). */
export const MAX_HANDOVER_DAYS = 90;
export const REASON_MAX = 300;
/** The server accepts a start this far in the past, so a form filled in slowly still works. */
const START_TOLERANCE_MS = 60_000;

export interface HandoverForm {
  delegateId: string;
  /** 'now' starts straight away; 'later' uses `startsAt`. */
  startMode: 'now' | 'later';
  /** Local date and time from a datetime-local field: "2026-11-24T09:30". */
  startsAt: string;
  endsAt: string;
  reason: string;
}

export type HandoverErrors = Partial<Record<'delegateId' | 'startsAt' | 'endsAt' | 'reason', string>>;

/** Reads a datetime-local value as local time; null when empty or not a date. */
export function parseLocal(v: string): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "2026-11-24T09:30" for a datetime-local field, in local time. */
export function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** The latest end allowed for a start: 90 calendar days later (the same count the server uses). */
export function latestEnd(start: Date): Date {
  const d = new Date(start);
  d.setDate(d.getDate() + MAX_HANDOVER_DAYS);
  return d;
}

/** Checks a handover before it is sent, with the messages the person sees. The server checks again. */
export function validateHandover(f: HandoverForm, now = new Date()): HandoverErrors {
  const e: HandoverErrors = {};
  if (!f.delegateId) e.delegateId = 'Choose the colleague who will decide for you.';
  if (f.reason.length > REASON_MAX) e.reason = `The reason is at most ${REASON_MAX} characters.`;
  let start = now;
  if (f.startMode === 'later') {
    const s = parseLocal(f.startsAt);
    if (!s) e.startsAt = 'Say when the handover starts.';
    else if (s.getTime() < now.getTime() - START_TOLERANCE_MS) e.startsAt = 'The start cannot be in the past.';
    else start = s;
  }
  const end = parseLocal(f.endsAt);
  if (!end) e.endsAt = 'Say when the handover ends.';
  else if (!e.startsAt) {
    if (end.getTime() <= start.getTime()) e.endsAt = 'The end must be after the start.';
    else if (end.getTime() > latestEnd(start).getTime()) e.endsAt = `A handover lasts at most ${MAX_HANDOVER_DAYS} days.`;
  }
  return e;
}

export const DELEGATION_LABEL: Record<DelegationStatus, string> = { scheduled: 'Starts later', active: 'Active', ended: 'Ended early', expired: 'Finished' };
export const DELEGATION_TONE: Record<DelegationStatus, string> = {
  scheduled: 'border-line bg-subtle text-fg-muted',
  active: 'border-success-line bg-success-bg text-success',
  ended: 'border-line bg-subtle text-fg-muted',
  expired: 'border-line bg-subtle text-fg-muted',
};

/** A handover still counts while it is active or waiting to start; the rest are history. */
export const isCurrent = (d: Pick<Delegation, 'status'>) => d.status === 'active' || d.status === 'scheduled';

/** "Which requests": every type, or the keys the delegator limited it to. */
export function scopeText(d: Pick<Delegation, 'typeKeys'>): string {
  return d.typeKeys && d.typeKeys.length > 0 ? `Only ${d.typeKeys.join(', ')}` : 'All requests';
}

/** The line shown on an inbox row that I may decide only through a handover. */
export const forText = (a: Pick<Approval, 'delegatedFromName'>): string | null => (a.delegatedFromName ? `For ${a.delegatedFromName}` : null);
