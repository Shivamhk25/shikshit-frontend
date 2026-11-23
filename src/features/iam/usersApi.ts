import type { Session } from '@shikshit/shared/session';
import { ApiError, createCrudClient, type ListParams, type PageResult } from '../../crud/client';

/** IAM-01 Users (backend api/openapi/modules/iam-users.yaml). The list and detail use the shared CRUD client; the
 * lifecycle actions and PATCH are specific to users. */

export type UserStatus = 'invited' | 'active' | 'locked' | 'disabled';
export type UserAction = 'deactivate' | 'reactivate' | 'lock' | 'unlock' | 'reset-password' | 'reset-mfa';

export interface User {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  phone: string | null;
  status: UserStatus;
  personType: 'student' | 'guardian' | 'staff' | null;
  personId: string | null;
  mustChangePassword: boolean;
  mfaEnabled: boolean;
  failedLoginCount: number;
  lockedUntil: string | null;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface UserInput {
  username?: string;
  displayName?: string;
  email?: string | null;
  phone?: string | null;
}

/** Each action is offered only for the statuses where the server accepts it (users.go transitions). */
export const ACTIONS_BY_STATUS: Record<UserStatus, UserAction[]> = {
  invited: ['reset-password', 'deactivate'],
  active: ['reset-password', 'lock', 'deactivate'],
  locked: ['unlock', 'deactivate'],
  disabled: ['reactivate'],
};

/** A temporary lock after too many wrong passwords leaves the status active; unlock clears it early. */
export function isTemporarilyLocked(u: User, now = new Date()): boolean {
  return u.status === 'active' && u.lockedUntil !== null && new Date(u.lockedUntil) > now;
}

async function failure(res: Response): Promise<ApiError> {
  type Problem = { code?: string; detail?: string; errors?: { field: string; message: string }[] };
  let p: Problem = {};
  try {
    p = (await res.json()) as Problem;
  } catch {
    /* not JSON */
  }
  const fields: Record<string, string> = {};
  for (const e of p.errors ?? []) fields[e.field] ??= e.message;
  return new ApiError(res.status, p.code ?? 'error', fields, p.detail ?? 'Something went wrong. Please try again.');
}

async function send<T>(doFetch: typeof fetch, url: string, method: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await doFetch(url, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'network', {}, 'Cannot reach the server. Check your connection.');
  }
  if (!res.ok) throw await failure(res);
  return (await res.json()) as T;
}

export function createUsersApi(session: Pick<Session, 'fetch'>, base: string) {
  const crud = createCrudClient<User, never>(session, base, '/users');
  const doFetch: typeof fetch = (...a) => session.fetch(...a);
  return {
    list: (p: ListParams): Promise<PageResult<User>> => crud.list(p),
    create: (input: UserInput) => send<User & { inviteLink: string; emailQueued?: boolean }>(doFetch, `${base}/users`, 'POST', input),
    update: (id: string, input: UserInput) => send<User>(doFetch, `${base}/users/${id}`, 'PATCH', input),
    act: (id: string, action: UserAction) => send<User & { resetLink?: string; emailQueued?: boolean }>(doFetch, `${base}/users/${id}/${action}`, 'POST'),
  };
}
export type UsersApi = ReturnType<typeof createUsersApi>;

/** Public: sets the password from an invite or reset link. No session; the institute comes from the host. */
export async function acceptInvite(base: string, token: string, password: string, fetchFn: typeof fetch = (...a) => fetch(...a)): Promise<void> {
  await send<{ message: string }>(fetchFn, `${base}/auth/invite/accept`, 'POST', { token, password });
}

/** Turns the path the server returns into a full link the admin can share. */
export function absoluteLink(path: string, origin = window.location.origin): string {
  return new URL(path, origin).toString();
}
