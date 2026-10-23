# Architecture: shikshit

## Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Bootstrap 5.3 + Custom CSS (Inter font, brand colors)
- **Routing**: React Router v6 (with route guards)
- **Real-time**: SignalR (ASP.NET Core compatible)
- **Auth**: JWT + Refresh tokens, HttpOnly cookies
- **Build**: Vite with code-splitting, hashed assets
- **Icons**: Bootstrap Icons 1.11+

## Folder Structure
```
src/
├── app/                    # App-level setup
│   ├── providers/          # Context providers (Auth, Theme, SignalR)
│   ├── routes/             # Route definitions + guards
│   └── App.tsx
├── components/
│   ├── layout/             # Header, Navbar, Footer, Sidebar
│   ├── auth/               # Login, Register, ForgotPassword forms
│   ├── ui/                 # Reusable UI (Button, Card, Input, Modal)
│   └── common/             # Shared (Logo, Avatar, Badge)
├── features/
│   ├── auth/               # Auth slice, API, hooks
│   ├── dashboard/          # Role-based dashboards
│   ├── navigation/         # Nav config per role
│   └── [domain]/           # Future: students, academics, finance, etc.
├── hooks/                  # Shared hooks (useAuth, usePermissions)
├── services/               # API client, SignalR, storage
├── types/                  # Global TypeScript types
├── utils/                  # Helpers (cn, format, validation)
└── styles/                 # Global CSS, variables
```

## Modules

| Module | Responsibility | Public Interface |
|--------|----------------|------------------|
| `auth` | Login, register, token refresh, logout, permissions | `useAuth()`, `usePermissions()`, `login()`, `logout()` |
| `layout` | Header (brand, user menu), Navbar (role-based), Footer | `<Header />`, `<Navbar />`, `<Footer />` |
| `routing` | Route config, guards, lazy-loaded feature routes | `routes`, `<ProtectedRoute />`, `<RoleRoute />` |
| `ui` | Design system components | `Button`, `Card`, `Input`, `Modal`, `Dropdown` |
| `dashboard` | Role-specific dashboard pages | `DashboardRegistry`, `useDashboard()` |
| `navigation` | Nav structure per role, permissions | `navConfig`, `useNavigation()` |
| `realtime` | SignalR connection, hubs, events | `useSignalR()`, `hubConnection` |

## Data Model (Auth & Navigation)

```typescript
// types/auth.ts
interface User {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: Role;
  institutionId?: string;
  permissions: Permission[];
  avatarUrl?: string;
}

type Role = 
  | 'super_admin' 
  | 'institute_admin' 
  | 'principal' 
  | 'teacher' 
  | 'student' 
  | 'parent' 
  | 'accountant' 
  | 'registrar';

type Permission = 
  | 'dashboard:view'
  | 'students:manage'
  | 'academics:manage'
  | 'finance:manage'
  | 'hr:manage'
  | 'reports:view'
  | 'settings:manage'
  | 'users:manage';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
```

```typescript
// types/navigation.ts
interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles?: Role[];
  permissions?: Permission[];
  children?: NavItem[];
  badge?: string;
}

interface NavConfig {
  left: NavItem[];    // Main navigation
  right: NavItem[];   // User menu, notifications
}
```

## Key Decisions

| Decision | Rationale |
|----------|-----------|
| **React 18 + Vite** | Fast HMR, small bundle, modern React patterns |
| **TypeScript strict** | Catch auth/nav bugs at compile time |
| **Bootstrap 5 + custom CSS** | Matches target exactly; minimal custom CSS |
| **JWT in HttpOnly cookies** | Secure against XSS; CSRF via SameSite=Strict |
| **Role-based nav injection** | Mirrors target's empty `.navbar-nav` containers populated by React |
| **Route guards + lazy loading** | Code-split per role; protect routes at router level |
| **SignalR for real-time** | Target uses SignalR; enables notifications, live updates |
| **Feature-based folders** | Scales to many modules (S3 requirement) |
| **Centralized nav config** | Single source of truth for role-based menus |
| **Turnstile CAPTCHA on auth forms** | Matches target's Cloudflare Turnstile integration |

## Out of Scope (v1)
- Multi-tenancy / institution onboarding
- Full domain modules (students, academics, finance, HR)
- Mobile app / PWA
- Advanced analytics / BI
- SSO / SAML / OAuth providers
- Internationalization (i18n)
- Dark mode
- Automated testing beyond unit/integration