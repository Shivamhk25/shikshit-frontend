import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, SessionStatus, SignInResult } from '@shikshit/shared/session';

interface AuthState {
  session: Session;
  status: SessionStatus;
  signIn: (username: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ session, children }: { session: Session; children: ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>(session.status);

  useEffect(() => {
    const off = session.onStatus(setStatus);
    void session.restore().then(setStatus);
    return off;
  }, [session]);

  const signIn = useCallback((u: string, p: string) => session.signIn(u.trim(), p), [session]);
  const signOut = useCallback(() => session.signOut(), [session]);
  const value = useMemo(() => ({ session, status, signIn, signOut }), [session, status, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}
