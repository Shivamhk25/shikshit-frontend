import { ApiError } from '../crud/client';
import { API_BASE } from '../shell/web-session';

/** Platform (Super Admin) session, decision 0017. The access token lives in memory only; the refresh token is an
 * httpOnly cookie scoped to /api/v1/platform/auth, separate from any school's session. Sign-in is always two steps. */

export type PlatformMe = { id: string; email: string; name: string };
export type Challenge = { kind: 'verify' | 'setup'; token: string };

type Problem = { code?: string; detail?: string; errors?: { field: string; message: string }[] };

async function toError(res: Response): Promise<ApiError> {
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

export interface PlatformSession {
  /** Calls a platform operation with the access token, refreshing once if it has expired. */
  fetch: (path: string, init?: RequestInit) => Promise<Response>;
  restore: () => Promise<boolean>;
  login: (email: string, password: string) => Promise<Challenge>;
  startSetup: (token: string) => Promise<{ secret: string; otpauthUri: string }>;
  finish: (c: Challenge, code: string) => Promise<void>;
  logout: () => Promise<void>;
  signedIn: () => boolean;
}

export function createPlatformSession(fetchFn: typeof fetch = (...a) => fetch(...a)): PlatformSession {
  let access: string | null = null;
  const post = (path: string, body?: unknown, headers: Record<string, string> = {}) =>
    fetchFn(`${API_BASE}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const take = async (res: Response) => {
    if (!res.ok) throw await toError(res);
    access = ((await res.json()) as { accessToken: string }).accessToken;
  };
  const refresh = async (): Promise<boolean> => {
    try {
      const res = await post('/platform/auth/refresh', undefined, { 'X-Client': 'web' });
      if (!res.ok) {
        access = null;
        return false;
      }
      await take(res);
      return true;
    } catch {
      return false;
    }
  };
  const authed = (path: string, init: RequestInit = {}) =>
    fetchFn(`${API_BASE}${path}`, { ...init, credentials: 'include', headers: { ...(init.headers as Record<string, string> | undefined), ...(access ? { Authorization: `Bearer ${access}` } : {}) } });

  return {
    fetch: async (path, init) => {
      let res = await authed(path, init);
      if (res.status === 401 && (await refresh())) res = await authed(path, init);
      return res;
    },
    restore: refresh,
    login: async (email, password) => {
      const res = await post('/platform/auth/login', { email, password });
      if (res.status !== 202) throw await toError(res);
      const b = (await res.json()) as { mfaRequired: 'verify' | 'setup'; challengeToken: string };
      return { kind: b.mfaRequired, token: b.challengeToken };
    },
    startSetup: async (token) => {
      const res = await post('/platform/auth/mfa/setup', { challengeToken: token });
      if (!res.ok) throw await toError(res);
      return (await res.json()) as { secret: string; otpauthUri: string };
    },
    finish: async (c, code) => take(await post(c.kind === 'setup' ? '/platform/auth/mfa/setup/confirm' : '/platform/auth/mfa/verify', { challengeToken: c.token, code })),
    logout: async () => {
      access = null;
      await post('/platform/auth/logout').catch(() => undefined);
    },
    signedIn: () => access !== null,
  };
}

/** Where the console is served: on the console.<domain> host at the root, or (local development only) under /console. */
export function consoleBase(loc: Pick<Location, 'hostname' | 'pathname'>): string | null {
  if (loc.hostname.startsWith('console.')) return '';
  const local = loc.hostname === 'localhost' || loc.hostname === '127.0.0.1';
  if (local && (loc.pathname === '/console' || loc.pathname.startsWith('/console/'))) return '/console';
  return null;
}

/** The institute's own address, for showing a new Admin's invite link in full. */
export function instituteUrl(code: string, path = ''): string | null {
  const domain = import.meta.env.VITE_INSTITUTE_DOMAIN as string | undefined;
  return domain ? `https://${code}.${domain}${path}` : null;
}
