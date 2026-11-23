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
  let p: { code?: string; detail?: string } = {};
  try {
    p = (await res.json()) as typeof p;
  } catch {
    /* not JSON */
  }
  return new ApiError(res.status, p.code ?? 'error', {}, p.detail ?? 'Something went wrong. Please try again.');
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

/** The client for the approvals endpoints. Delegation (a later section) adds its own calls beside these. */
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
  };
}
export type ApprovalsApi = ReturnType<typeof createApprovalsApi>;
