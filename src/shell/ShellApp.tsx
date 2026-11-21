import { Route, Routes } from 'react-router-dom';
import type { Session } from '@shikshit/shared/session';
import { AccessProvider } from './AccessProvider';
import { AppShell } from './AppShell';
import { AuthProvider, useAuth } from './AuthProvider';
import { HomePage, NotAvailablePage, OnboardingPage, ProfilePage, RequirePermission } from './pages';
import { SignInPage } from './SignInPage';
import { RoomsPage } from '../features/aca/RoomsPage';
import { ResourcePage } from '../features/aca/ResourcePage';
import { classesDescriptor, sectionsDescriptor, subjectsDescriptor, termsDescriptor, yearsDescriptor } from '../features/aca/structure';

function Gate() {
  const { status } = useAuth();
  if (status === 'unknown') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas text-fg-muted" role="status">
        Loading…
      </div>
    );
  }
  if (status === 'signedOut') return <SignInPage />;
  return (
    <AccessProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route
            path="onboarding"
            element={
              <RequirePermission path="/onboarding">
                <OnboardingPage />
              </RequirePermission>
            }
          />
          <Route
            path="rooms"
            element={
              <RequirePermission path="/rooms">
                <RoomsPage />
              </RequirePermission>
            }
          />
          <Route
            path="academic-years"
            element={
              <RequirePermission path="/academic-years">
                <ResourcePage descriptor={yearsDescriptor} />
              </RequirePermission>
            }
          />
          <Route
            path="academic-terms"
            element={
              <RequirePermission path="/academic-terms">
                <ResourcePage descriptor={termsDescriptor} />
              </RequirePermission>
            }
          />
          <Route
            path="classes"
            element={
              <RequirePermission path="/classes">
                <ResourcePage descriptor={classesDescriptor} />
              </RequirePermission>
            }
          />
          <Route
            path="sections"
            element={
              <RequirePermission path="/sections">
                <ResourcePage descriptor={sectionsDescriptor} />
              </RequirePermission>
            }
          />
          <Route
            path="subjects"
            element={
              <RequirePermission path="/subjects">
                <ResourcePage descriptor={subjectsDescriptor} />
              </RequirePermission>
            }
          />
          <Route path="*" element={<NotAvailablePage />} />
        </Route>
      </Routes>
    </AccessProvider>
  );
}

/** Mount inside a router. `session` is injectable so tests can run the whole app against a fake server. */
export function ShellApp({ session }: { session: Session }) {
  return (
    <AuthProvider session={session}>
      <Gate />
    </AuthProvider>
  );
}
