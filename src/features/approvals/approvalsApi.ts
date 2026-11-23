import type { Session } from '@shikshit/shared/session';
import { ApiError } from '../../crud/client';

/** FND-20 approvals (backend api/openapi/modules/wfl-approvals.yaml): requests waiting on me, and the ones I made. */

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

export interface Approval {
  id: string;
  typeKey: string;
  typeTitle: string;
  subjectId: string;
  summary: string;
  amount: number | null;
  requesterId: string;
  requesterName: string;
  status: ApprovalStatus;
  currentStep: number;
  stepCount: number;
  stepName: string;
  createdAt: string;
  decidedAt: string | null;
  /** Set when I may decide this only because this person handed their approvals to me. */
  delegatedFromId?: string | null;
  delegatedFromName?: string | null;
}

export interface ApprovalStep {
  step: number;
  name: string;
  status: 'pending' | 'approved' | 'rejected';
  decidedBy: string | null;
  decidedAt: string | null;
}

export interface ApprovalEvent {
  step: number | null;
  actorId: string;
  actorName: string;
  action: 'submitted' | 'approved' | 'rejected' | 'cancelled';
  comment: string;
  createdAt: string;
  /** Set when the actor decided through a handover, on behalf of this person. */
  onBehalfOfId?: string | null;
  onBehalfOfName?: string | null;
}

export type DelegationStatus = 'scheduled' | 'active' | 'ended' | 'expired';

export interface Delegation {
  id: string;
  delegatorId: string;
  delegatorName: string;
  delegateId: string;
  delegateName: string;
  startsAt: string;
  endsAt: string;
  reason: string;
  /** Null means every workflow type. */
  typeKeys: string[] | null;
  endedAt: string | null;
  createdAt: string;
  status: DelegationStatus;
}

export interface DelegationInput {
  delegateId: string;
  /** Left out to start now. */
  startsAt?: string;
  endsAt: string;
  reason?: string;
  typeKeys?: string[];
}

export interface DelegationList {
  given: Delegation[];
  received: Delegation[];
}

export interface ApprovalDetail extends Approval {
  steps: ApprovalStep[];
  events: ApprovalEvent[];
  canDecide: boolean;
  canCancel: boolean;
}

export interface ApprovalPage {
  items: Approval[];
  page: { number: number; size: number; total: number };
}

async function failure(res: Response): Promise<ApiError> {
  let p: { code?: string; detail?: string; errors?: { field: string; message: string }[] } = {};
  try {
    p = (await res.json()) as typeof p;
  } catch {
    /* not JSON */
  }
  const fields: Record<string, string> = {};
  for (const e of p.errors ?? []) fields[e.field] ??= e.message;
  return new ApiError(res.status, p.code ?? 'error', fields, p.detail ?? 'Something went wrong. Please try again.');
}

async function send<T>(session: Pick<Session, 'fetch'>, url: string, method: 'GET' | 'POST', body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await session.fetch(url, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'network', {}, 'Cannot reach the server. Check your connection.');
  }
  if (!res.ok) throw await failure(res);
  return (await res.json()) as T;
}

/** The client for the approvals endpoints, including handovers (delegations). */
export function createApprovalsApi(session: Pick<Session, 'fetch'>, base: string) {
  const one = (id: string) => `${base}/approvals/${encodeURIComponent(id)}`;
  return {
    inbox: (p: { page?: number; pageSize?: number } = {}): Promise<ApprovalPage> =>
      send(session, `${base}/approvals?${new URLSearchParams({ page: String(p.page ?? 1), pageSize: String(p.pageSize ?? 20) }).toString()}`, 'GET'),
    mine: (p: { page?: number; pageSize?: number; status?: ApprovalStatus } = {}): Promise<ApprovalPage> => {
      const q = new URLSearchParams({ page: String(p.page ?? 1), pageSize: String(p.pageSize ?? 20) });
      if (p.status) q.set('status', p.status);
      return send(session, `${base}/approvals/mine?${q.toString()}`, 'GET');
    },
    get: (id: string): Promise<ApprovalDetail> => send(session, one(id), 'GET'),
    /** `step` is the step the person was looking at; the server refuses (409) when the request has moved on. */
    approve: (id: string, d: { comment?: string; step?: number }): Promise<ApprovalDetail> => send(session, `${one(id)}/approve`, 'POST', d),
    reject: (id: string, d: { comment: string; step?: number }): Promise<ApprovalDetail> => send(session, `${one(id)}/reject`, 'POST', d),
    cancel: (id: string, d: { comment?: string } = {}): Promise<ApprovalDetail> => send(session, `${one(id)}/cancel`, 'POST', d),
    delegations: (): Promise<DelegationList> => send(session, `${base}/approvals/delegations`, 'GET'),
    /** 400 carries field errors; 403 means the caller has no approvals to hand over. */
    delegate: (d: DelegationInput): Promise<Delegation> => send(session, `${base}/approvals/delegations`, 'POST', d),
    endDelegation: (id: string): Promise<Delegation> => send(session, `${base}/approvals/delegations/${encodeURIComponent(id)}/end`, 'POST'),
  };
}
export type ApprovalsApi = ReturnType<typeof createApprovalsApi>;
