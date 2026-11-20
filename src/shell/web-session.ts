import { createSession, type Session, type TokenStore } from '@shikshit/shared/session';

/** Web keeps the refresh token in an httpOnly cookie, so there is nothing for scripts to store. */
const noStore: TokenStore = {
  get: () => Promise.resolve(null),
  set: () => Promise.resolve(),
  clear: () => Promise.resolve(),
};

/** Base URL of the contract API. The institute is chosen by the page's host, never by the client. */
export const API_BASE: string = (import.meta.env.VITE_API_V1_BASE as string | undefined) ?? '/api/v1';

export function createWebSession(fetchFn: typeof fetch = (...a) => fetch(...a)): Session {
  return createSession({ baseUrl: API_BASE, fetchFn, store: noStore, client: { name: 'web', version: '0.1.0' }, cookieRefresh: true });
}
