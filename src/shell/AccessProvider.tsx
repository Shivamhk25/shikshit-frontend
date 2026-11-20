import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createAccess, type Access, type AccessPayload } from '@shikshit/shared/access';
import { useAuth } from './AuthProvider';
import { API_BASE } from './web-session';

export type AccessState =
  | { phase: 'loading' }
  | { phase: 'error'; retry: () => void }
  | { phase: 'ready'; payload: AccessPayload; access: Access };

const AccessContext = createContext<AccessState | null>(null);

/**
 * Loads GET /me/access once signed in and again whenever the server reports a newer X-Access-Version, so what the
 * user sees follows role, grant and module changes without a manual reload.
 */
export function AccessProvider({ children }: { children: ReactNode }) {
  const { session, status } = useAuth();
  const [state, setState] = useState<AccessState>({ phase: 'loading' });
  const version = useRef(0);

  const load = useCallback(async () => {
    try {
      const res = await session.fetch(`${API_BASE}/me/access`);
      if (!res.ok) throw new Error(String(res.status));
      const payload = (await res.json()) as AccessPayload;
      version.current = payload.version;
      setState({ phase: 'ready', payload, access: createAccess(payload) });
    } catch {
      setState({ phase: 'error', retry: () => void load() });
    }
  }, [session]);

  useEffect(() => {
    if (status !== 'signedIn') {
      setState({ phase: 'loading' });
      return;
    }
    void load();
    return session.onAccessVersion((v) => {
      if (v !== version.current) void load();
    });
  }, [status, session, load]);

  const value = useMemo(() => state, [state]);
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAccessState(): AccessState {
  const v = useContext(AccessContext);
  if (!v) throw new Error('useAccessState must be used inside <AccessProvider>');
  return v;
}
