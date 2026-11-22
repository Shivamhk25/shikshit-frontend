import type { Session } from '@shikshit/shared/session';
import type { Appearance, ThemeMode } from '@shikshit/shared/tokens';
import { ApiError } from '../../crud/client';

/** FND-11 appearance (backend api/openapi/modules/iam-appearance.yaml): the institute's look and the user's mode. */

/** The last mode this browser used, so the page does not flash light before /me/preferences answers. */
export const MODE_STORAGE_KEY = 'shikshit.themeMode';

type Problem = { code?: string; detail?: string; errors?: { field: string; message: string }[] };

async function send<T>(session: Pick<Session, 'fetch'>, url: string, method: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await session.fetch(url, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'network', {}, 'Cannot reach the server. Check your connection.');
  }
  if (!res.ok) {
    let p: Problem = {};
    try {
      p = (await res.json()) as Problem;
    } catch {
      /* not JSON */
    }
    const fields: Record<string, string> = {};
    for (const e of p.errors ?? []) fields[e.field] ??= e.message;
    throw new ApiError(res.status, p.code ?? 'error', fields, p.detail ?? 'Something went wrong. Please try again.');
  }
  return (await res.json()) as T;
}

export function createAppearanceApi(session: Pick<Session, 'fetch'>, base: string) {
  return {
    get: () => send<Appearance>(session, `${base}/institute/appearance`, 'GET'),
    set: (a: Appearance) => send<Appearance>(session, `${base}/institute/appearance`, 'PUT', a),
    getPreferences: () => send<{ themeMode: ThemeMode }>(session, `${base}/me/preferences`, 'GET'),
    setPreferences: (themeMode: ThemeMode) => send<{ themeMode: ThemeMode }>(session, `${base}/me/preferences`, 'PUT', { themeMode }),
  };
}

export function storedMode(): ThemeMode {
  try {
    const v = window.localStorage.getItem(MODE_STORAGE_KEY);
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function storeMode(mode: ThemeMode) {
  try {
    window.localStorage.setItem(MODE_STORAGE_KEY, mode);
  } catch {
    /* private mode */
  }
}
