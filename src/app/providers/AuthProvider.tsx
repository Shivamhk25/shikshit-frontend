import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { AppDispatch, RootState } from '@/app/store';
import { loginSuccess, logout, setAccessToken, loginFailure } from '@/features/auth/authSlice';
import { authApi } from '@/services/authApi';
import { apiClient } from '@/services/api';
import type { User } from '@/types/auth';

interface AuthContextType {
  login: (username: string, password: string, turnstileToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
  isAuthenticated: boolean;
  accessToken: string | null;
  user: User | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const dispatch = useDispatch<AppDispatch>();
  const { isAuthenticated, isLoading, accessToken, user } = useSelector((state: RootState) => state.auth);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('accessToken');
      if (storedToken) {
        apiClient.setAccessToken(storedToken);
        dispatch(setAccessToken(storedToken));
        try {
          const userData = await authApi.getCurrentUser() as User;
          dispatch(loginSuccess({ user: userData, accessToken: storedToken }));
        } catch {
          localStorage.removeItem('accessToken');
          dispatch(logout());
        }
      }
      setHydrated(true);
    };
    initAuth();
  }, [dispatch]);

  const login = async (username: string, password: string, turnstileToken: string) => {
    dispatch({ type: 'auth/loginStart' });
    try {
      const response = await authApi.login({ username, password, turnstileToken });
      localStorage.setItem('accessToken', response.accessToken);
      apiClient.setAccessToken(response.accessToken);
      dispatch(loginSuccess(response));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Login failed';
      dispatch(loginFailure(message));
      throw error;
    }
  };

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore logout API errors
    } finally {
      localStorage.removeItem('accessToken');
      apiClient.setAccessToken(null);
      dispatch(logout());
    }
  };

  const refreshUser = async () => {
    if (!accessToken) return;
    try {
      const userData = await authApi.getCurrentUser() as User;
      dispatch(setAccessToken(accessToken));
      dispatch(loginSuccess({ user: userData, accessToken }));
    } catch {
      // Token might be expired, logout will be handled by interceptors
    }
  };

  if (!hydrated) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ login, logout: handleLogout, refreshUser, isLoading, isAuthenticated, accessToken, user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useAuthState() {
  const { user, isAuthenticated, isLoading, accessToken } = useSelector((state: RootState) => state.auth);
  return { user, isAuthenticated, isLoading, accessToken };
}

export function usePermissions() {
  const { user } = useSelector((state: RootState) => state.auth);
  const hasPermission = (permission: string) => user?.permissions?.includes(permission as any) ?? false;
  const hasRole = (role: string) => user?.role === role;
  const hasAnyRole = (roles: string[]) => user ? roles.includes(user.role) : false;
  return { hasPermission, hasRole, hasAnyRole, permissions: user?.permissions ?? [] };
}

export { useNavigation } from '@/hooks/useNavigation';