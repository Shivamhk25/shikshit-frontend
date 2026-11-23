import type { Approval, ApprovalEvent, ApprovalStatus } from './approvalsApi';

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
