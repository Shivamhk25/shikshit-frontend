import type { Session } from '@shikshit/shared/session';
import { API_BASE } from '../../shell/web-session';

/**
 * ONB-01 Control tower (backend api/openapi/modules/onb-control-tower.yaml). Readiness of each data domain, computed by
 * the server from the data. People only set an owner, a due date and the review and ready marks. Hand-typed to match
 * the contract.
 */

export type DomainStatus = 'not_started' | 'in_progress' | 'needs_review' | 'ready';
export type DomainMark = 'open' | 'review' | 'ready';

export interface ReadinessCheck {
  key: string;
  label: string;
  done: number;
  total: number;
}

export interface TowerDomain {
  id: string;
  title: string;
  module: string;
  status: DomainStatus;
  percent: number;
  hasSource: boolean;
  note?: string;
  checks: ReadinessCheck[];
  blockers: { id: string; title: string }[];
  ownerId?: string | null;
  ownerName?: string | null;
  dueDate?: string | null;
  overdue: boolean;
  state: DomainMark;
  openImports: number;
  reviewRequestedAt?: string | null;
  readyAt?: string | null;
}

export interface ControlTower {
  domains: TowerDomain[];
  total: number;
  ready: number;
  percent: number;
}

/** The board's columns, in the order work moves through them. */
export const COLUMNS: { status: DomainStatus; label: string; hint: string }[] = [
  { status: 'not_started', label: 'Not started', hint: 'No data loaded yet.' },
  { status: 'in_progress', label: 'In progress', hint: 'Data is being loaded.' },
  { status: 'needs_review', label: 'Needs review', hint: 'Waiting for someone to confirm.' },
  { status: 'ready', label: 'Ready', hint: 'Confirmed at 100 %.' },
];

export const STATUS_LABEL: Record<DomainStatus, string> = { not_started: 'Not started', in_progress: 'In progress', needs_review: 'Needs review', ready: 'Ready' };

/** Why a domain cannot be sent for review, or null when it can. The server enforces the same rules; this only explains. */
export function reviewBlock(d: TowerDomain): string | null {
  if (!d.hasSource) return d.note || 'No data source yet.';
  if (d.percent < 100) return `Every readiness rule must be met first (${d.percent} % so far).`;
  return null;
}

/** Why a domain cannot be confirmed ready, or null when it can. */
export function readyBlock(d: TowerDomain): string | null {
  if (!d.hasSource) return d.note || 'No data source yet.';
  if (d.blockers.length > 0) return blockedText(d);
  if (d.percent < 100) return `Every readiness rule must be met first (${d.percent} % so far).`;
  return null;
}

/** "Blocked because Academic structure is not ready yet." or '' when nothing is in the way. */
export function blockedText(d: Pick<TowerDomain, 'blockers'>): string {
  const names = d.blockers.map((b) => b.title);
  if (names.length === 0) return '';
  const list = names.length === 1 ? names[0] : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return `Blocked because ${list} ${names.length === 1 ? 'is' : 'are'} not ready yet.`;
}

/** The one thing to do next in a domain. */
export function nextAction(d: TowerDomain, canEdit: boolean): string {
  if (!d.hasSource) return 'Nothing to do yet: this part is not built.';
  if (d.status === 'ready') return 'Done. Nothing more to do.';
  if (d.blockers.length > 0 && d.percent >= 100 && d.state === 'review') return `Wait for ${d.blockers.map((b) => b.title).join(', ')}.`;
  if (d.openImports > 0) return `Finish ${d.openImports} open ${d.openImports === 1 ? 'import' : 'imports'}.`;
  const unmet = d.checks.find((c) => c.done < c.total);
  if (unmet) return `${unmet.label}: ${unmet.total - unmet.done} left.`;
  if (d.state === 'review') return canEdit ? 'Confirm it as ready.' : 'Waiting for someone to confirm it.';
  return canEdit ? 'Mark it for review.' : 'Ask an owner to mark it for review.';
}

export class TowerError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** The calls the control tower makes. Every call goes through the signed-in session. */
export function createTowerApi(session: Pick<Session, 'fetch'>) {
  const call = async <T>(path: string, method = 'GET', body?: unknown): Promise<T> => {
    let res: Response;
    try {
      res = await session.fetch(`${API_BASE}${path}`, body === undefined ? { method } : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } catch {
      throw new TowerError(0, 'Cannot reach the server. Check your connection.');
    }
    if (!res.ok) {
      const b = (await res.json().catch(() => ({}))) as { detail?: string };
      throw new TowerError(res.status, b.detail || (res.status === 403 ? 'You do not have permission to do this.' : 'Something went wrong. Please try again.'));
    }
    return (await res.json()) as T;
  };
  return {
    get: () => call<ControlTower>('/onboarding/control-tower'),
    assign: (id: string, a: { ownerId: string | null; dueDate: string | null }) => call<TowerDomain>(`/onboarding/control-tower/domains/${id}`, 'PUT', a),
    move: (id: string, to: DomainMark) => call<TowerDomain>(`/onboarding/control-tower/domains/${id}/state`, 'POST', { to }),
    colleagues: async (q: string) => (await call<{ items: { id: string; displayName: string; label: string }[] }>(`/colleagues?page=1&pageSize=25${q ? `&q=${encodeURIComponent(q)}` : ''}`)).items,
  };
}
export type TowerApi = ReturnType<typeof createTowerApi>;
