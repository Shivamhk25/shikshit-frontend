# TESTPLAN.md — Unified Frontend + Backend

## Legend
- ✅ = Done / Verified
- ⬜ = Pending
- 🔄 = In Progress
- (auto) = Automated test
- (manual) = Manual verification

---

## Authentication & Authorization

### Frontend (React/Vitest/Playwright)

- [ ] **T4-T7: Login Flow** (auto)
  - ⬜ Valid credentials → redirects to returnUrl or /dashboard
  - ⬜ Invalid credentials → shows error, stays on login
  - ⬜ Empty fields → shows validation errors
  - ⬜ CAPTCHA required → blocks submit until solved
  - ⬜ Token refresh before expiry → seamless
  - ⬜ Logout → clears cookies, redirects to /login
  - ⬜ Refresh page → auth persists (HttpOnly cookie)

- [ ] **T6: Route Guards** (auto)
  - ⬜ Unauthenticated → /protected → redirects to /login?returnUrl=...
  - ⬜ Authenticated, wrong role → /admin → redirects to own dashboard
  - ⬜ Authenticated, correct role → /admin → renders
  - ⬜ Deep link with returnUrl → post-login redirects correctly

- [ ] **T17: Forgot/Reset Password** (manual)
  - ⬜ Forgot page → submits email → shows success
  - ⬜ Reset link with valid token → allows password change
  - ⬜ Reset link with expired token → shows error
  - ⬜ New password → login works

### Backend (Go/testify)

- [ ] **Auth API** (auto)
  - ⬜ POST `/api/v1/auth/login` — valid creds → 200 + tokens + user
  - ⬜ POST `/api/v1/auth/login` — invalid creds → 401
  - ⬜ POST `/api/v1/auth/login` — missing captcha → 400
  - ⬜ POST `/api/v1/auth/refresh` — valid refresh → 200 + new tokens
  - ⬜ POST `/api/v1/auth/refresh` — expired/revoked → 401
  - ⬜ POST `/api/v1/auth/logout` — clears cookies → 204
  - ⬜ GET `/api/v1/auth/me` — valid access → 200 + user
  - ⬜ GET `/api/v1/auth/me` — no token → 401

- [ ] **Password Reset** (auto)
  - ⬜ POST `/api/v1/auth/forgot-password` — existing email → 202 (token stored)
  - ⬜ POST `/api/v1/auth/reset-password` — valid token → 200
  - ⬜ POST `/api/v1/auth/reset-password` — expired token → 400
  - ⬜ POST `/api/v1/auth/reset-password` — invalid token → 400

- [ ] **Email Verification** (auto)
  - ⬜ POST `/api/v1/auth/verify-email` — valid token → 200
  - ⬜ POST `/api/v1/auth/verify-email` — invalid/expired → 400

- [ ] **MFA (TOTP)** (auto)
  - ⬜ POST `/api/v1/auth/mfa/enable` — returns QR + secret
  - ⬜ POST `/api/v1/auth/mfa/verify` — valid code → 200
  - ⬜ POST `/api/v1/auth/mfa/disable` — verified → 200

- [ ] **Session Management** (auto)
  - ⬜ GET `/api/v1/auth/sessions` — lists active sessions
  - ⬜ DELETE `/api/v1/auth/sessions/{id}` — revokes one
  - ⬜ DELETE `/api/v1/auth/sessions` — revokes all

---

## Layout & Navigation

### Frontend

- [ ] **T8: Header** (auto)
  - ⬜ Fixed top, 70px height
  - ⬜ White background, subtle shadow
  - ⬜ Logo (30px) links to /home
  - ⬜ `data-discover="true"` on brand link
  - ⬜ Mobile: hamburger at <992px

- [✅] **T9-T10: Navbar Dynamic Injection** (auto)
  - ✅ Unauthenticated → both `.navbar-nav` containers empty
  - ✅ Authenticated (teacher) → left nav shows: Dashboard, Classes, Grades, Attendance
  - ✅ Authenticated (student) → left nav shows: Dashboard, Timetable, Assignments, Grades
  - ✅ Authenticated (admin) → left nav shows all admin sections
  - ✅ Right nav → user menu with avatar, name, logout
  - ✅ Mobile toggle → expands/collapses correctly

- [✅] **T10: Nav Config Completeness** (auto)
  - ✅ All 8 roles defined in navConfig
  - ✅ Each nav item has: label, href, icon, roles[], permissions[]
  - ✅ All hrefs exist in route config
  - ✅ No duplicate hrefs per role

- [ ] **T11: Footer** (manual)
  - ⬜ 4 sections: brand/contact, quick links, resources, social
  - ⬜ Newsletter input + Turnstile CAPTCHA
  - ⬜ Copyright bar: © year, Privacy, Terms, Support links
  - ⬜ Dark background (#0f1214)

- [✅] **T12: Main Layout** (auto)
  - ✅ min-vh-100 flex column
  - ✅ Header fixed, main flex-grow-1, footer mt-auto
  - ✅ Main padding-top: 90px (clears header)
  - ✅ Gradient background on auth pages
  - ✅ Sticky footer on short content

---

## Dashboards & Routing

### Frontend

- [✅] **T13: Route Config** (auto)
  - ✅ All feature routes lazy-loaded (code-split)
  - ✅ ProtectedRoute wraps all auth-required routes
  - ✅ RoleRoute wraps role-specific routes
  - ✅ 404 page for unknown routes
  - ✅ Nested routes work (e.g., /students/:id)

- [🔄] **T14: Role-Based Dashboards** (manual)
  - ✅ 8 dashboard components registered
  - ⬜ Teacher dashboard: classes widget, upcoming assignments, attendance summary
  - ⬜ Student dashboard: timetable, due assignments, grade summary
  - ⬜ Admin dashboard: stats cards, recent activity, quick actions
  - ⬜ Wrong role access → redirect to own dashboard

- [ ] **T15: User Menu** (auto)
  - ⬜ Avatar + name in right navbar
  - ⬜ Dropdown: Profile, Settings, Role Switcher (if applicable), Logout
  - ⬜ Logout → clears auth, redirects to /login
  - ⬜ Keyboard accessible (Esc to close, Tab navigation)

- [ ] **T16: SignalR** (manual)
  - ⬜ Connects on auth
  - ⬜ Reconnects on network interrupt
  - ⬜ Receives `NotificationReceived` → shows toast
  - ⬜ Notification badge increments in navbar
  - ⬜ Disconnects on logout

### Backend

- [ ] **Dashboard API** (auto)
  - ⬜ GET `/api/v1/dashboard/stats` — super_admin → institute count, users, revenue
  - ⬜ GET `/api/v1/dashboard/stats` — institute_admin → enrollment, fees, staff
  - ⬜ GET `/api/v1/dashboard/stats` — principal → academic, teachers, students
  - ⬜ GET `/api/v1/dashboard/stats` — teacher → my classes, assignments, attendance
  - ⬜ GET `/api/v1/dashboard/stats` — student → timetable, due, grades, fees
  - ⬜ GET `/api/v1/dashboard/stats` — parent → children, progress, fees
  - ⬜ GET `/api/v1/dashboard/stats` — accountant → collections, invoices, expenses
  - ⬜ GET `/api/v1/dashboard/stats` — registrar → admissions, enrollment, docs
  - ⬜ GET `/api/v1/dashboard/stats` — hr → staff, leave, payroll

---

## Domain Modules (Frontend + Backend)

### Students

| Frontend | Backend |
|----------|---------|
| ⬜ List with search/filter/sort | ⬜ GET `/api/v1/students` (paginated, filtered) |
| ⬜ Create modal with validation | ⬜ POST `/api/v1/students` |
| ⬜ View profile (academic, fees, attendance, docs) | ⬜ GET `/api/v1/students/{id}` |
| ⬜ Edit inline | ⬜ PATCH `/api/v1/students/{id}` |
| ⬜ Delete with confirmation | ⬜ DELETE `/api/v1/students/{id}` |
| ⬜ Bulk import (CSV/Excel) | ⬜ POST `/api/v1/students/import` |
| ⬜ Class enrollment management | ⬜ POST/DELETE `/api/v1/students/{id}/enrollments` |
| ⬜ Export (CSV/PDF), ID card | ⬜ GET `/api/v1/students/{id}/id-card` |

### Academics

| Frontend | Backend |
|----------|---------|
| ⬜ Academic years/terms CRUD | ⬜ CRUD `/api/v1/academic/years`, `/terms` |
| ⬜ Departments, subjects, classes | ⬜ CRUD `/api/v1/academic/departments`, `/subjects`, `/classes` |
| ⬜ Timetable builder (drag-drop) | ⬜ GET/POST `/api/v1/academic/timetable` |
| ⬜ Assignments: create, distribute, collect, grade | ⬜ CRUD `/api/v1/academic/assignments`, `/submissions`, `/grades` |
| ⬜ Attendance: daily marking, reports | ⬜ POST `/api/v1/academic/attendance`, GET reports |

### Finance

| Frontend | Backend |
|----------|---------|
| ⬜ Fee structures & components | ⬜ CRUD `/api/v1/finance/fee-structures`, `/components` |
| ⬜ Student fee assignment & invoicing | ⬜ POST `/api/v1/finance/invoices` |
| ⬜ Payment collection (cash, card, UPI) | ⬜ POST `/api/v1/finance/payments` |
| ⬜ Receipts, refunds, concessions | ⬜ GET/POST `/api/v1/finance/receipts`, `/refunds` |
| ⬜ Financial reports | ⬜ GET `/api/v1/finance/reports/collection`, `/outstanding` |

### HR

| Frontend | Backend |
|----------|---------|
| ⬜ Staff profiles | ⬜ CRUD `/api/v1/hr/staff` |
| ⬜ Leave types, balances, requests | ⬜ CRUD `/api/v1/hr/leave-types`, `/balances`, `/requests` |
| ⬜ Contracts & performance | ⬜ CRUD `/api/v1/hr/contracts`, `/reviews` |
| ⬜ Payroll runs, payslips | ⬜ POST `/api/v1/hr/payroll`, GET `/payslips` |

### Communication

| Frontend | Backend |
|----------|---------|
| ⬜ Announcements (targeted) | ⬜ CRUD `/api/v1/comm/announcements` |
| ⬜ Conversations & messages | ⬜ CRUD `/api/v1/comm/conversations`, `/messages` |
| ⬜ Notifications (in-app, email) | ⬜ GET `/api/v1/comm/notifications` |
| ⬜ Calendar events | ⬜ CRUD `/api/v1/comm/events` |

### Reports & Analytics

| Frontend | Backend |
|----------|---------|
| ⬜ Pre-built reports per role | ⬜ GET `/api/v1/analytics/reports` |
| ⬜ Custom report builder | ⬜ POST `/api/v1/analytics/reports/custom` |
| ⬜ Scheduled delivery | ⬜ POST `/api/v1/analytics/reports/schedule` |

### Settings

| Frontend | Backend |
|----------|---------|
| ⬜ Institute profile & branding | ⬜ GET/PATCH `/api/v1/settings/institute` |
| ⬜ User management & roles | ⬜ CRUD `/api/v1/settings/users`, `/roles` |
| ⬜ Academic configuration | ⬜ CRUD `/api/v1/settings/academic` |
| ⬜ Fee & finance settings | ⬜ CRUD `/api/v1/settings/finance` |
| ⬜ Notification templates | ⬜ CRUD `/api/v1/settings/templates` |
| ⬜ Integrations (SMS, Email, Payments) | ⬜ CRUD `/api/v1/settings/integrations` |

---

## Real-Time / WebSocket

### Frontend + Backend Integration

- [ ] **WS Connection** (auto)
  - ⬜ Connect to `/hubs/notifications` with Bearer token
  - ⬜ Server registers client by user_id + institute_id
  - ⬜ Ping/pong every 30s

- [ ] **Broadcast Methods** (auto)
  - ⬜ `SendToUser(user_id, payload)` → only that user
  - ⬜ `SendToInstitute(institute_id, payload)` → all in institute
  - ⬜ `SendToRole(role, payload)` → all with role
  - ⬜ `SendToGroup(group, payload)` → group members
  - ⬜ `SendNotification(user_id, notification)` → creates notification + pushes

- [ ] **Frontend Handling** (auto)
  - ⬜ `NotificationReceived` event → toast + badge++
  - ⬜ Navbar badge updates in real-time
  - ⬜ Notification center shows history

---

## Responsive & Accessibility

- [ ] **T18: Responsive** (manual)
  - ⬜ Mobile (<576px): stacked cards, full-width buttons
  - ⬜ Tablet (576-991px): 2-col cards, condensed nav
  - ⬜ Desktop (≥992px): side-by-side cards, full nav
  - ⬜ Touch targets ≥44px
  - ⬜ No horizontal scroll

- [ ] **T18: Accessibility** (auto + manual)
  - ⬜ Semantic HTML (nav, main, footer, header)
  - ⬜ ARIA labels on icon-only buttons
  - ⬜ Focus visible on all interactive elements
  - ⬜ Color contrast ≥4.5:1 (AA)
  - ⬜ Keyboard navigation: Tab order logical, Esc closes modals/dropdowns
  - ⬜ Screen reader: form labels, error announcements

---

## Integration & E2E

- [ ] **T19: E2E Critical Paths** (auto - Playwright)
  - ⬜ Login → Dashboard → Navigate → Logout → Login (persists)
  - ⬜ Role guard: teacher cannot access /admin
  - ⬜ Refresh on dashboard → stays authenticated
  - ⬜ Mobile: hamburger → nav → select → navigates
  - ⬜ Forgot password → reset → login with new password
  - ⬜ Teacher: create assignment → student sees notification
  - ⬜ Student: submit assignment → teacher sees submission
  - ⬜ Parent: view child grades → real-time update
  - ⬜ Admin: create user → appears in user list
  - ⬜ WebSocket: disconnect/reconnect → notifications sync

---

## Build & Production

### Frontend

- [ ] **T20: Build** (auto)
  - ⬜ `npm run build` exits 0
  - ⬜ Output: hashed assets, source maps
  - ⬜ Total JS gzipped <500KB
  - ⬜ CSS gzipped <100KB
  - ⬜ No TypeScript errors
  - ⬜ No ESLint warnings

- [ ] **T20: Docker** (manual)
  - ⬜ `docker build` succeeds
  - ⬜ Image <200MB
  - ⬜ Container starts, serves on port 80
  - ⬜ Health check endpoint returns 200

### Backend

- [ ] **Production Build** (auto)
  - ⬜ `make build-prod` → binary <20MB
  - ⬜ `docker build` → image <100MB
  - ⬜ Security scan (gosec) — no HIGH/CRITICAL
  - ⬜ Benchmarks within budget

---

## Bug Tracking (BUGS.md format)

```
B1 | <symptom> | <repro steps> | sev: high/med/low | status: open/fixed/deferred
```

---

## Test Execution Commands

```bash
# Frontend
npm run test           # Vitest unit tests
npm run test:coverage  # Coverage report
npm run test:e2e       # Playwright E2E

# Backend
cd backend
go test ./...          # All unit tests
go test ./internal/... -v  # Verbose
go test ./cmd/api -v       # Integration
make test-coverage         # HTML coverage

# Mobile
cd packages/mobile
npm run test           # Jest unit tests
npm run test:e2e       # Detox E2E
npm run test:coverage  # Coverage report

# Combined
make check             # fmt + vet + lint + test (backend)
npm run lint           # ESLint (frontend)
npm run lint:mobile    # ESLint (mobile)
```

---

## Mobile App (React Native)

### Authentication
- [ ] Login with email/password → dashboard
- [ ] Biometric enable → logout → biometric unlock
- [ ] Forgot password → email → reset link → new password
- [ ] Token refresh → seamless
- [ ] Push token registered → backend

### Navigation
- [ ] Teacher: bottom tabs (Dashboard, Students, Academics, Grades)
- [ ] Student: bottom tabs (Dashboard, Timetable, Assignments, Grades)
- [ ] Parent: bottom tabs (Dashboard, Children, Progress, Fees)
- [ ] Admin: drawer navigation
- [ ] Deep link `pie360://students/123` → opens student detail
- [ ] Deep link `pie360://assignments/456` → opens assignment

### Offline
- [ ] Create assignment offline → syncs on reconnect
- [ ] Mark attendance offline → syncs on reconnect
- [ ] Offline banner shows when disconnected
- [ ] Background sync on app background

### Push Notifications
- [ ] Permission granted → token sent to backend
- [ ] Grade posted → notification received → tap navigates
- [ ] Fee due → notification received
- [ ] Badge count updates

### Biometric
- [ ] Enable in settings → FaceID/TouchID prompt
- [ ] App background → foreground → biometric unlock
- [ ] Failed biometric → fallback PIN

### Performance
- [ ] 60fps navigation transitions
- [ ] List scrolling (100+ items) smooth
- [ ] App cold start <3s
- [ ] Bundle size <50MB (Android), <100MB (iOS)

### Device Matrix (Firebase Test Lab)
- [ ] iOS: iPhone 15, 14, 13, SE, iPad Pro
- [ ] Android: Pixel 8, 7, Samsung S24, S23, Tablet
- [ ] OS: iOS 17, 16 | Android 14, 13

### Shared Package Tests
- [ ] Types compile on web + mobile
- [ ] API client works on both platforms
- [ ] Auth storage works (localStorage vs SecureStore)
- [ ] SignalR connects on both platforms
- [ ] Design tokens match exactly
- [ ] Zod schemas validate on both