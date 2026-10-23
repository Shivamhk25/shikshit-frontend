export type Role =
  | 'super_admin'
  | 'institute_admin'
  | 'principal'
  | 'teacher'
  | 'student'
  | 'parent'
  | 'accountant'
  | 'registrar'
  | 'hr';

export type Permission =
  | 'dashboard:view'
  | 'students:manage'
  | 'academics:manage'
  | 'finance:manage'
  | 'hr:manage'
  | 'reports:view'
  | 'settings:manage'
  | 'users:manage';

export interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: Role;
  institutionId?: string;
  permissions: Permission[];
  avatarUrl?: string;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export interface LoginCredentials {
  username: string;
  password: string;
  turnstileToken: string;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken?: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
}

export interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles?: Role[];
  permissions?: Permission[];
  children?: NavItem[];
  badge?: string;
}

export interface NavConfig {
  left: NavItem[];
  right: NavItem[];
}