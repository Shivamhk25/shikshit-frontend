import type { Session } from '@shikshit/shared/session';
import { API_BASE } from '../../shell/web-session';

/** ONB-23 Go-live gate (backend api/openapi/modules/onb-golive.yaml). Hand-typed to match the contract. */

export interface GoLiveDomain {
  id: string;
  title: string;
  status: 'not_started' | 'in_progress' | 'needs_review' | 'ready';
  percent: number;
  assessable: boolean;
  ready: boolean;
}

export interface GoLiveSignoff {
  id: string;
  signedBy: string;
  signedByName?: string | null;
  signedAt: string;
  notes: string;
  snapshot: GoLiveDomain[];
  revokedAt?: string | null;
  revokedBy?: string | null;
  revokeReason?: string | null;
}

export interface GoLiveGate {
  tenantStatus: 'onboarding' | 'live' | 'suspended' | 'archived';
  open: boolean;
  domains: GoLiveDomain[];
  reasons: string[];
  active?: GoLiveSignoff | null;
  history: GoLiveSignoff[];
}

export class GoLiveError extends Error {
  constructor(public status: number, message: string, public reasons: string[] = []) {
    super(message);
  }
}

/** One line for each domain: why it does or does not pass the gate. */
export function domainVerdict(d: GoLiveDomain): string {
  if (!d.assessable) return 'No data source yet, so it cannot be checked. This blocks go-live.';
  if (d.ready) return 'Ready';
  return `Not ready (${d.percent} %)`;
}

export function createGoLiveApi(session: Pick<Session, 'fetch'>) {
  const call = async <T>(path: string, method = 'GET', body?: unknown): Promise<T> => {
    let res: Response;
    try {
      res = await session.fetch(`${API_BASE}${path}`, body === undefined ? { method } : { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    } catch {
      throw new GoLiveError(0, 'Cannot reach the server. Check your connection.');
    }
    if (!res.ok) {
      const b = (await res.json().catch(() => ({}))) as { detail?: string; errors?: { message?: string }[] };
      throw new GoLiveError(res.status, b.detail || (res.status === 403 ? 'You do not have permission to do this.' : 'Something went wrong. Please try again.'), (b.errors ?? []).map((e) => e.message ?? '').filter(Boolean));
    }
    return (await res.json()) as T;
  };
  return {
    get: () => call<GoLiveGate>('/onboarding/go-live'),
    signOff: (notes: string) => call<GoLiveSignoff>('/onboarding/go-live/sign-off', 'POST', { notes }),
    revoke: (reason: string) => call<GoLiveSignoff>('/onboarding/go-live/revoke', 'POST', { reason }),
  };
}
