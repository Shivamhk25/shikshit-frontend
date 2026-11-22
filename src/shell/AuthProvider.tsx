import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { MfaConfirmResult, MfaSetupResult, Session, SessionStatus, SignInResult } from '@shikshit/shared/session';

interface AuthState {
  session: Session;
  status: SessionStatus;
  signIn: (username: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
  /** Two-step sign-in (FND-05): the steps after a correct password. */
  verifyMfa: (challengeToken: string, code: string) => Promise<SignInResult>;
  startMfaSetup: (challengeToken: string) => Promise<MfaSetupResult>;
  confirmMfaSetup: (challengeToken: string, code: string) => Promise<MfaConfirmResult>;
  /** Recovery codes from a setup at sign-in, shown once inside the app until acknowledged. */
  recoveryCodes: string[] | null;
  dismissRecoveryCodes: () => void;
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
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const verifyMfa = useCallback((t: string, c: string) => session.verifyMfa(t, c.trim()), [session]);
  const startMfaSetup = useCallback((t: string) => session.startMfaSetup(t), [session]);
  const confirmMfaSetup = useCallback(
    async (t: string, c: string) => {
      const r = await session.confirmMfaSetup(t, c.trim());
      if (r.ok) setRecoveryCodes(r.recoveryCodes);
      return r;
    },
    [session],
  );
  const dismissRecoveryCodes = useCallback(() => setRecoveryCodes(null), []);
  const value = useMemo(
    () => ({ session, status, signIn, signOut, verifyMfa, startMfaSetup, confirmMfaSetup, recoveryCodes, dismissRecoveryCodes }),
    [session, status, signIn, signOut, verifyMfa, startMfaSetup, confirmMfaSetup, recoveryCodes, dismissRecoveryCodes],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const v = useContext(AuthContext);
  if (!v) throw new Error('useAuth must be used inside <AuthProvider>');
  return v;
}
