import { Route, Routes, useLocation } from 'react-router-dom';
import type { Session } from '@shikshit/shared/session';
import { AccessProvider } from './AccessProvider';
import { AppShell } from './AppShell';
import { AuthProvider, useAuth } from './AuthProvider';
import { HomePage, NotAvailablePage, OnboardingPage, ProfilePage, RequirePermission } from './pages';
import { SignInPage } from './SignInPage';
import { AcceptInvitePage } from './AcceptInvitePage';
import { RecoveryCodesDialog } from './mfa';
import { UsersPage } from '../features/iam/UsersPage';
import { RolesPage } from '../features/iam/RolesPage';
import { AssignmentsPage } from '../features/iam/AssignmentsPage';
import { ParentLinksPage } from '../features/iam/ParentLinksPage';
import { AppearancePage } from '../features/iam/AppearancePage';
import { RoomsPage } from '../features/aca/RoomsPage';
import { ResourcePage } from '../features/aca/ResourcePage';
import { addressesDescriptor, enrollmentsDescriptor, guardiansDescriptor, studentGuardiansDescriptor, studentsDescriptor } from '../features/stu/students';
import { chaptersDescriptor, classSectionsDescriptor, subjectClassesDescriptor, textbooksDescriptor } from '../features/aca/mappings';
import { campusesDescriptor, divisionsDescriptor, electivesDescriptor, eventsDescriptor, holidaysDescriptor } from '../features/aca/masters';
import { classesDescriptor, sectionsDescriptor, subjectsDescriptor, termsDescriptor, yearsDescriptor } from '../features/aca/structure';

function Gate() {
  const { status } = useAuth();
  const { pathname } = useLocation();
  // Invite and reset links work whether or not someone is signed in on this browser.
  if (pathname === '/accept-invite') return <AcceptInvitePage />;
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
      <RecoveryCodesDialog />
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
          <Route
            path="school-divisions"
            element={
              <RequirePermission path="/school-divisions">
                <ResourcePage descriptor={divisionsDescriptor} />
              </RequirePermission>
            }
          />
          <Route
            path="campuses"
            element={
              <RequirePermission path="/campuses">
                <ResourcePage descriptor={campusesDescriptor} />
              </RequirePermission>
            }
          />
          <Route
            path="holidays"
            element={
              <RequirePermission path="/holidays">
                <ResourcePage descriptor={holidaysDescriptor} />
              </RequirePermission>
            }
          />
          <Route
            path="calendar-events"
            element={
              <RequirePermission path="/calendar-events">
                <ResourcePage descriptor={eventsDescriptor} />
              </RequirePermission>
            }
          />
          <Route
            path="elective-groups"
            element={
              <RequirePermission path="/elective-groups">
                <ResourcePage descriptor={electivesDescriptor} />
              </RequirePermission>
            }
          />
          <Route
            path="class-section-mappings"
            element={
              <RequirePermission path="/class-section-mappings">
                <ResourcePage descriptor={classSectionsDescriptor} />
              </RequirePermission>
            }
          />
          <Route
            path="subject-class-mappings"
            element={
              <RequirePermission path="/subject-class-mappings">
                <ResourcePage descriptor={subjectClassesDescriptor} />
              </RequirePermission>
            }
          />
          <Route
            path="textbooks"
            element={
              <RequirePermission path="/textbooks">
                <ResourcePage descriptor={textbooksDescriptor} />
              </RequirePermission>
            }
          />
          <Route
            path="textbook-chapters"
            element={
              <RequirePermission path="/textbook-chapters">
                <ResourcePage descriptor={chaptersDescriptor} />
              </RequirePermission>
            }
          />
          <Route
            path="students"
            element={
              <RequirePermission path="/students">
                <ResourcePage descriptor={studentsDescriptor} />
              </RequirePermission>
            }
          />
          <Route
            path="student-enrollments"
            element={
              <RequirePermission path="/student-enrollments">
                <ResourcePage descriptor={enrollmentsDescriptor} />
              </RequirePermission>
            }
          />
          <Route
            path="guardians"
            element={
              <RequirePermission path="/guardians">
                <ResourcePage descriptor={guardiansDescriptor} />
              </RequirePermission>
            }
          />
          <Route
            path="student-guardians"
            element={
              <RequirePermission path="/student-guardians">
                <ResourcePage descriptor={studentGuardiansDescriptor} />
              </RequirePermission>
            }
          />
          <Route
            path="student-addresses"
            element={
              <RequirePermission path="/student-addresses">
                <ResourcePage descriptor={addressesDescriptor} />
              </RequirePermission>
            }
          />
          <Route
            path="users"
            element={
              <RequirePermission path="/users">
                <UsersPage />
              </RequirePermission>
            }
          />
          <Route
            path="roles"
            element={
              <RequirePermission path="/roles">
                <RolesPage />
              </RequirePermission>
            }
          />
          <Route
            path="class-assignments"
            element={
              <RequirePermission path="/class-assignments">
                <AssignmentsPage />
              </RequirePermission>
            }
          />
          <Route
            path="parent-accounts"
            element={
              <RequirePermission path="/parent-accounts">
                <ParentLinksPage />
              </RequirePermission>
            }
          />
          <Route
            path="appearance"
            element={
              <RequirePermission path="/appearance">
                <AppearancePage />
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
