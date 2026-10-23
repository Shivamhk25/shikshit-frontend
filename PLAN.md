# PIE360 Unified Plan — Frontend + Backend

**Strategy:** S5 (Test & Debug Existing Code) | **Stack:** B (OpenCode) | **Phase:** TEST

---

## Phase Gates (S5)
1. MAP → 2. TEST → 3. FIX → 4. FINALIZE

---

## Micro-Tasks (T01-T20, each ≤3 files, 1 acceptance test)

### Infrastructure & Auth (Week 1-2)

| Task | Goal | Files | Status | Acceptance |
|------|------|-------|--------|------------|
| T01 | Apply migrations + seed data | `backend/migrations/*.sql`, `backend/scripts/seed.go` | ⬜ | `make migrate-status` shows all applied, seed data queryable |
| T02 | Real login handler (backend) | `backend/cmd/api/routes/routes.go` | ⬜ | POST `/auth/login` returns real user + tokens |
| T03 | Token refresh (backend) | `backend/cmd/api/routes/routes.go` | ⬜ | POST `/auth/refresh` rotates tokens |
| T04 | Turnstile CAPTCHA (frontend) | `src/components/auth/Turnstile.tsx`, `LoginForm.tsx` | ⬜ | Login blocked without valid token |
| T05 | Forgot/Reset password flow | `backend/cmd/api/routes/routes.go`, `src/features/auth/*` | ⬜ | Email sent, token validated, password changed |
| T06 | Teacher sub-routes | `src/app/routes/routes.tsx`, new pages | ⬜ | `/teacher/classes` renders class list |
| T07 | Student sub-routes | `src/app/routes/routes.tsx`, new pages | ⬜ | `/student/timetable` renders timetable |

### Dashboards & Real-time (Week 2-3)

| Task | Goal | Files | Status | Acceptance |
|------|------|-------|--------|------------|
| T08 | Dashboard API endpoints | `backend/cmd/api/routes/routes.go`, `src/services/dashboardApi.ts` | ⬜ | GET `/dashboard/stats` returns role data |
| T09 | SuperAdmin dashboard widgets | `src/features/dashboard/dashboards/SuperAdminDashboard.tsx` | ⬜ | Stats cards + chart render real data |
| T10 | Teacher dashboard widgets | `src/features/dashboard/dashboards/TeacherDashboard.tsx` | ⬜ | Classes, assignments, attendance show data |
| T11 | Student dashboard widgets | `src/features/dashboard/dashboards/StudentDashboard.tsx` | ⬜ | Timetable, due assignments, grades show |
| T12 | SignalR connection + notifications | `src/app/providers/SignalRProvider.tsx`, `backend/internal/hub/hub.go` | ⬜ | Connect on auth, receive notification toast |

### Domain Modules (Week 3-6)

| Task | Goal | Files | Status | Acceptance |
|------|------|-------|--------|------------|
| T13 | Students CRUD | `src/features/students/StudentsPage.tsx`, backend handlers | ⬜ | List/create/edit/delete students |
| T14 | Academics CRUD | `src/features/academics/AcademicsPage.tsx`, backend handlers | ⬜ | Manage years, terms, subjects, classes |
| T15 | Finance CRUD | `src/features/finance/FinancePage.tsx`, backend handlers | ⬜ | Fee structures, invoices, payments |
| T16 | HR CRUD | `src/features/hr/HRPage.tsx`, backend handlers | ⬜ | Staff, leave, payroll, contracts |
| T17 | Reports module | `src/features/reports/ReportsPage.tsx`, backend handlers | ⬜ | Generate/view scheduled reports |
| T18 | Settings module | `src/features/settings/SettingsPage.tsx`, backend handlers | ⬜ | Institute config, user mgmt, integrations |

### Quality & Deploy (Week 6-7)

| Task | Goal | Files | Status | Acceptance |
|------|------|-------|--------|------------|
| T19 | E2E test suite | `src/integration/*.test.tsx`, Playwright config | ⬜ | 10 critical paths pass in CI |
| T20 | Production build + K8s deploy | `Dockerfile`, `docker-compose.yml`, K8s manifests | ⬜ | `docker build` succeeds, K8s deploys |

---

## Backend Phase Status (from original 12-phase plan)

### ✅ Phase 0 — Project Bootstrap (DONE)
- Directory structure, `go.mod`, config files exist

### ✅ Phase 1 — Configuration & Core Shared Packages (DONE)
- `config.yaml` complete
- `internal/shared/{config,logger,errors,db}` implemented

### ✅ Phase 2 — Database Migrations (MIGRATIONS EXIST, NOT APPLIED)
- 9 migration files created (`000001`–`000009`)
- `sqlc.yaml` configured
- `config/rbac_model.conf` & `config/rbac_policy.csv` exist
- ⬜ **Pending**: `make migrate-up`, `make sqlc`, seed data

### ⬜ Phase 3 — Auth Package (HANDLERS NEED IMPLEMENTATION)
- `internal/auth/{auth,session,casbin}.go` exist with interfaces
- ⬜ **Pending**: Real token generation, session management, Casbin enforcement

### ✅ Phase 4 — WebSocket Hub (DONE)
- `internal/hub/hub.go` with Hub, Client, rate limiting, broadcast methods

### ✅ Phase 5 — Multi-Tenancy Middleware (DONE)
- `internal/tenant/tenant.go` with context extraction, RLS helpers, middleware chain

### ⬜ Phase 6 — API Routes & Handlers (PLACEHOLDERS ONLY)
- `cmd/api/routes/routes.go` has all handler signatures
- ⬜ **Pending**: Replace stubs with real implementations (login, refresh, logout, me, forgot, reset, verify-email, MFA, sessions, CRUD for all modules)

### ✅ Phase 7 — Main Entry Point & Wiring (DONE)
- `cmd/api/main.go` wires config, DB, Redis, Auth, Hub, Echo, middleware, routes, WS, graceful shutdown

### ⬜ Phase 8 — Docker & Dev Environment (PARTIAL)
- `Dockerfile`, `docker-compose.yml`, `Makefile` exist
- ⬜ **Pending**: `.air.toml` for live reload

### ⬜ Phase 9 — Local Integration Test (NOT STARTED)
### ⬜ Phase 10 — Unit & Integration Tests (NOT STARTED)
### ⬜ Phase 11 — Production Hardening (NOT STARTED)
### ⬜ Phase 12 — Documentation & Handoff (PARTIAL - ARCHITECTURE.md exists)

---

## Frontend Status (from TESTPLAN.md)

### ✅ Completed
- LoginPage, LoginForm, ForgotPasswordPage, ResetPasswordPage
- Navbar with dynamic injection per role (8 roles in navConfig.ts)
- ProtectedRoute, RoleRoute, lazy route loading (routes.tsx)
- 8 dashboard components (stubs)
- AuthProvider with token management, refresh, hydration
- SignalRProvider skeleton
- navConfig.ts complete with all roles/items

### ⬜ Pending
- Turnstile CAPTCHA integration
- Header component (separate from Navbar)
- User menu (avatar, profile, settings, logout)
- Footer component
- Sub-routes for teacher/student/parent/registrar/hr
- Dashboard widgets with real data
- SignalR connection + notification toast/badge
- Domain pages: Students, Academics, Finance, HR, Reports, Settings (exist but empty)
- E2E tests (Playwright)
- Build/Docker production

---

## Execution Rules
1. **One task at a time** — complete T01 before T02
2. **Tests with every task** — acceptance test must pass
3. **Stop on red** — if verify fails, fix before proceeding
4. **Mark status** — update ⬜ → ✅ in this file after each task
5. **Session handoff** — append to bottom after each session

---

## Quick Reference Commands

```bash
# Backend
cd backend
make dev-db          # start infra (postgres, redis, minio, mailhog)
make migrate-up      # apply migrations
make sqlc            # regenerate SQLC
make run-dev         # live reload (air)

# Frontend
cd ..
npm run dev          # Vite dev server
npm run test         # Vitest
npm run build        # Production build

# Quality
make check           # fmt + vet + lint + test (backend)
npm run lint         # ESLint (frontend)
```

---

## Session Handoff

```
Session: S5/B | Phase: TEST | Next: T01 (migrations + seed) | Gotchas: DB not running, keys not generated
```

---

## Mobile App (React Native Expo) — Week 1-8

| Task | Goal | Files | Status | Acceptance |
|------|------|-------|--------|------------|
| M0.1 | Monorepo + workspaces setup | `package.json`, `packages/*/package.json` | ⬜ | `npm install` at root works |
| M0.2 | Extract shared package | `packages/shared/src/**` | ⬜ | Types build, web + mobile compile |
| M0.3 | Expo init + NativeWind | `packages/mobile/` | ⬜ | `npx expo start` shows app |
| M1.1 | Shared types + API client | `packages/shared/src/api/` | ⬜ | `useQuery` works on both |
| M1.2 | Shared auth + storage | `packages/shared/src/auth/` | ⬜ | Login persists on RN |
| M1.3 | Shared SignalR | `packages/shared/src/realtime/` | ⬜ | WS connects on mobile |
| M1.4 | Design tokens | `packages/shared/src/design/` | ⬜ | Colors match web exactly |
| M2.1 | Auth screens (login/forgot/reset) | `packages/mobile/app/(auth)/` | ⬜ | Full auth flow works |
| M2.2 | App shell + role navigation | `packages/mobile/app/(app)/_layout.tsx` | ⬜ | Tabs/drawer per role |
| M2.3 | Dashboard screens (8 roles) | `packages/mobile/app/(app)/index.tsx` | ⬜ | Real data renders |
| M3.1 | Teacher screens | `packages/mobile/app/(app)/students\|academics\|grades/` | ⬜ | CRUD works offline |
| M3.2 | Student screens | `packages/mobile/app/(app)/timetable\|assignments\|grades/` | ⬜ | Timetable week view |
| M3.3 | Parent screens | `packages/mobile/app/(app)/children\|progress\|fees/` | ⬜ | Multi-child selector |
| M3.4 | Admin screens | `packages/mobile/app/(app)/users\|settings\|reports/` | ⬜ | User management |
| M4.1 | Push notifications (Expo) | `packages/mobile/hooks/usePush.ts` | ⬜ | Test notification received |
| M4.2 | Biometric auth | `packages/mobile/hooks/useBiometric.ts` | ⬜ | FaceID/TouchID unlock |
| M4.3 | Offline + sync | `packages/mobile/services/storage.ts` | ⬜ | Offline queue syncs |
| M4.4 | Deep links | `packages/mobile/app/_layout.tsx` | ⬜ | `pie360://` navigates |
| M5.1 | EAS Build config | `packages/mobile/eas.json` | ⬜ | `eas build` succeeds |
| M5.2 | Android AAB + iOS IPA | `eas build --platform all` | ⬜ | Artifacts uploaded |
| M6.1 | Play Console submit | Store listing, screenshots | ⬜ | "In Review" |
| M6.2 | TestFlight submit | Store listing, screenshots | ⬜ | "In Review" |

---

## Mobile Backend Additions Required

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/v1/auth/push-token` | POST | Register Expo push token per user+device |
| `/api/v1/auth/push-token` | DELETE | Revoke token on logout |
| `/api/v1/auth/device` | POST | Register device info (platform, model, OS) |
| `/api/v1/auth/sessions` | GET | List active sessions (mobile + web) |
| `/api/v1/auth/sessions/{id}` | DELETE | Revoke specific session |

---

## Resource Requirements (Mobile)

| Resource | Cost | Timeline |
|----------|------|----------|
| Apple Developer Program | $99/yr | Need before Week 6 |
| Google Play Console | $25 one-time | Need before Week 6 |
| Expo EAS Build | Free tier (30 builds/mo) | Immediate |
| Firebase Project | Free (FCM) | Week 4 |
| Mac (for iOS) | Required | Week 5+ |

---

## Risk Mitigation (Mobile)

| Risk | Probability | Mitigation |
|------|-------------|------------|
| SignalR on RN unstable | Medium | Test early; fallback to polling if needed |
| NativeWind v4 bugs | Low | Pin version; test on both platforms |
| Expo SDK upgrade breaking | Low | Stay on SDK 51 (current LTS) |
| App Store rejection (web-like) | Low | Use native navigation, bottom sheets, haptics |
| Bundle size > limits | Medium | Code-split by route, Hermes bytecode |
| Shared package version drift | Medium | Single monorepo, atomic commits |

---

*End of Plan — Execute T01 now.*