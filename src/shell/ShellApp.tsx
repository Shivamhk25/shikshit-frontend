import { Route, Routes, useLocation } from 'react-router-dom';
import type { Session } from '@shikshit/shared/session';
import { AccessProvider } from './AccessProvider';
import { AppShell } from './AppShell';
import { AuthProvider, useAuth } from './AuthProvider';
import { HomePage, NotAvailablePage, OnboardingPage, ProfilePage, RequirePermission } from './pages';
import { SignInPage } from './SignInPage';
import { AcceptInvitePage } from './AcceptInvitePage';
import { RecoveryCodesDialog } from './mfa';
import { ApprovalsPage } from '../features/approvals/ApprovalsPage';
import { UsersPage } from '../features/iam/UsersPage';
import { RolesPage } from '../features/iam/RolesPage';
import { AssignmentsPage } from '../features/iam/AssignmentsPage';
import { ParentLinksPage } from '../features/iam/ParentLinksPage';
import { AppearancePage } from '../features/iam/AppearancePage';
import { RoomsPage } from '../features/aca/RoomsPage';
import { DevicesPage } from '../features/dev/DevicesPage';
import { FeeCategoriesPage } from '../features/fee/FeeCategoriesPage';
import { FeeTypesPage } from '../features/fee/FeeTypesPage';
import { ConcessionTypesPage } from '../features/fee/ConcessionTypesPage';
import { FeeSchedulesPage } from '../features/fee/FeeSchedulesPage';
import { LateFeeRulesPage } from '../features/fee/LateFeeRulesPage';
import { PaymentsPage } from '../features/fee/PaymentsPage';
import { PaymentRefundsPage } from '../features/fee/PaymentRefundsPage';
import { StudentFeeCollectionRegistersPage } from '../features/fee/StudentFeeCollectionRegistersPage';
import { StudentConcessionsPage } from '../features/fee/StudentConcessionsPage';
import { StudentFeeElectionsPage } from '../features/fee/StudentFeeElectionsPage';
import { FeeCollectionsPage } from '../features/fee/FeeCollectionsPage';
import { StudentAbsencesPage } from '../features/att/StudentAbsencesPage';
import { AttendanceStatusesPage } from '../features/att/AttendanceStatusesPage';
import { AttendanceRegistersPage } from '../features/att/AttendanceRegistersPage';
import { ResourcePage } from '../features/aca/ResourcePage';
import { discussionsDescriptor } from '../features/adm/discussions';
import { InsightsPage } from '../features/adm/InsightsPage';
import { enquiriesDescriptor } from '../features/adm/enquiries';
import { AdmissionsPage } from '../features/adm/AdmissionsPage';
import { PromotionsPage } from '../features/stu/PromotionsPage';
import { enquiriesWithRegister, registrationsDescriptor } from '../features/adm/registrations';
import { TransferCertificatePage } from '../features/stu/TransferCertificatePage';
import { TransfersPage } from '../features/stu/TransfersPage';
import { ElectivesPage } from '../features/stu/ElectivesPage';
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
            path="enquiries"
            element={
              <RequirePermission path="/enquiries">
                <ResourcePage descriptor={enquiriesWithRegister(enquiriesDescriptor)} />
              </RequirePermission>
            }
          />
          <Route
            path="registrations"
            element={
              <RequirePermission path="/registrations">
                <ResourcePage descriptor={registrationsDescriptor} />
              </RequirePermission>
            }
          />
          <Route
            path="admission-insights"
            element={
              <RequirePermission path="/admission-insights">
                <InsightsPage />
              </RequirePermission>
            }
          />
          <Route
            path="admissions"
            element={
              <RequirePermission path="/admissions">
                <AdmissionsPage />
              </RequirePermission>
            }
          />
          <Route
            path="promotions"
            element={
              <RequirePermission path="/promotions">
                <PromotionsPage />
              </RequirePermission>
            }
          />
          <Route
            path="enquiry-discussions"
            element={
              <RequirePermission path="/enquiry-discussions">
                <ResourcePage descriptor={discussionsDescriptor} />
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
            path="devices"
            element={
              <RequirePermission path="/devices">
                <DevicesPage />
              </RequirePermission>
            }
          />
          <Route
            path="fee-categories"
            element={
              <RequirePermission path="/fee-categories">
                <FeeCategoriesPage />
              </RequirePermission>
            }
          />
          <Route
            path="fee-types"
            element={
              <RequirePermission path="/fee-types">
                <FeeTypesPage />
              </RequirePermission>
            }
          />
          <Route
            path="concession-types"
            element={
              <RequirePermission path="/concession-types">
                <ConcessionTypesPage />
              </RequirePermission>
            }
          />
          <Route
            path="fee-schedules"
            element={
              <RequirePermission path="/fee-schedules">
                <FeeSchedulesPage />
              </RequirePermission>
            }
          />
          <Route
            path="late-fee-rules"
            element={
              <RequirePermission path="/late-fee-rules">
                <LateFeeRulesPage />
              </RequirePermission>
            }
          />
          <Route
            path="payments"
            element={
              <RequirePermission path="/payments">
                <PaymentsPage />
              </RequirePermission>
            }
          />
          <Route
            path="payment-refunds"
            element={
              <RequirePermission path="/payment-refunds">
                <PaymentRefundsPage />
              </RequirePermission>
            }
          />
          <Route
            path="student-fee-collection-registers"
            element={
              <RequirePermission path="/student-fee-collection-registers">
                <StudentFeeCollectionRegistersPage />
              </RequirePermission>
            }
          />
          <Route
            path="student-concessions"
            element={
              <RequirePermission path="/student-concessions">
                <StudentConcessionsPage />
              </RequirePermission>
            }
          />
          <Route
            path="student-fee-elections"
            element={
              <RequirePermission path="/student-fee-elections">
                <StudentFeeElectionsPage />
              </RequirePermission>
            }
          />
          <Route
            path="student-absences"
            element={
              <RequirePermission path="/student-absences">
                <StudentAbsencesPage />
              </RequirePermission>
            }
          />
          <Route
            path="attendance-statuses"
            element={
              <RequirePermission path="/attendance-statuses">
                <AttendanceStatusesPage />
              </RequirePermission>
            }
          />
          <Route
            path="attendance-registers"
            element={
              <RequirePermission path="/attendance-registers">
                <AttendanceRegistersPage />
              </RequirePermission>
            }
          />
          <Route
            path="fee-collection"
            element={
              <RequirePermission path="/fee-collection">
                <FeeCollectionsPage />
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
            path="transfers"
            element={
              <RequirePermission path="/transfers">
                <TransfersPage />
              </RequirePermission>
            }
          />
          <Route
            path="transfers/:transferId/certificate"
            element={
              <RequirePermission path="/transfers">
                <TransferCertificatePage />
              </RequirePermission>
            }
          />
          <Route
            path="student-electives"
            element={
              <RequirePermission path="/student-electives">
                <ElectivesPage />
              </RequirePermission>
            }
          />
          <Route
            path="student-elective-changes"
            element={
              <RequirePermission path="/student-elective-changes">
                <ElectivesPage />
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
          <Route path="approvals" element={<ApprovalsPage />} />
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
