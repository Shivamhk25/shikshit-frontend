import { defineRegistry } from '@shikshit/shared/access';

/**
 * Screens the web app can render. Ids and permissions match the server's screen list
 * (backend internal/platform/authz/screens.go) and the mobile registry. A screen the server offers that is not
 * listed here is skipped, so a newer server never breaks an older web build.
 */
export const registry = defineRegistry([
  { screenId: 'home', title: 'Home', parity: 'Both', web: { path: '/' }, mobile: { route: '/home' } },
  { screenId: 'onboarding', title: 'Onboarding', permission: 'onb.workspace.view', module: 'onb', parity: 'Companion', web: { path: '/onboarding' }, mobile: { route: '/imports' } },
  { screenId: 'rooms', title: 'Rooms', permission: 'aca.rooms.view', module: 'aca', parity: 'Companion', web: { path: '/rooms' }, mobile: { route: '/rooms' } },
  { screenId: 'academic_years', title: 'Academic years', permission: 'aca.academic_years.view', module: 'aca', parity: 'Companion', web: { path: '/academic-years' }, mobile: { route: '/academic-years' } },
  { screenId: 'academic_terms', title: 'Terms', permission: 'aca.academic_terms.view', module: 'aca', parity: 'Companion', web: { path: '/academic-terms' }, mobile: { route: '/academic-terms' } },
  { screenId: 'classes', title: 'Classes', permission: 'aca.classes.view', module: 'aca', parity: 'Companion', web: { path: '/classes' }, mobile: { route: '/classes' } },
  { screenId: 'sections', title: 'Sections', permission: 'aca.sections.view', module: 'aca', parity: 'Companion', web: { path: '/sections' }, mobile: { route: '/sections' } },
  { screenId: 'subjects', title: 'Subjects', permission: 'aca.subjects.view', module: 'aca', parity: 'Companion', web: { path: '/subjects' }, mobile: { route: '/subjects' } },
  { screenId: 'school_divisions', title: 'School divisions', permission: 'aca.school_divisions.view', module: 'aca', parity: 'Companion', web: { path: '/school-divisions' }, mobile: { route: '/school-divisions' } },
  { screenId: 'campuses', title: 'Campuses', permission: 'aca.campuses.view', module: 'aca', parity: 'Companion', web: { path: '/campuses' }, mobile: { route: '/campuses' } },
  { screenId: 'holidays', title: 'Holidays', permission: 'aca.holiday_calendars.view', module: 'aca', parity: 'Companion', web: { path: '/holidays' }, mobile: { route: '/holidays' } },
  { screenId: 'calendar_events', title: 'Academic calendar', permission: 'aca.academic_calendars.view', module: 'aca', parity: 'Companion', web: { path: '/calendar-events' }, mobile: { route: '/calendar-events' } },
  { screenId: 'elective_groups', title: 'Elective groups', permission: 'aca.elective_groups.view', module: 'aca', parity: 'Companion', web: { path: '/elective-groups' }, mobile: { route: '/elective-groups' } },
  { screenId: 'class_section_mappings', title: 'Class sections', permission: 'aca.class_section_mappings.view', module: 'aca', parity: 'Companion', web: { path: '/class-section-mappings' }, mobile: { route: '/class-section-mappings' } },
  { screenId: 'subject_class_mappings', title: 'Class subjects', permission: 'aca.subject_class_mappings.view', module: 'aca', parity: 'Companion', web: { path: '/subject-class-mappings' }, mobile: { route: '/subject-class-mappings' } },
  { screenId: 'textbooks', title: 'Textbooks', permission: 'aca.textbooks.view', module: 'aca', parity: 'Companion', web: { path: '/textbooks' }, mobile: { route: '/textbooks' } },
  { screenId: 'textbook_chapters', title: 'Textbook chapters', permission: 'aca.textbook_chapters.view', module: 'aca', parity: 'Companion', web: { path: '/textbook-chapters' }, mobile: { route: '/textbook-chapters' } },
  { screenId: 'students', title: 'Students', permission: 'stu.students.view', module: 'stu', parity: 'Companion', web: { path: '/students' }, mobile: { route: '/students' } },
  { screenId: 'student_enrollments', title: 'Enrollments', permission: 'stu.students.view', module: 'stu', parity: 'Companion', web: { path: '/student-enrollments' }, mobile: { route: '/student-enrollments' } },
  { screenId: 'guardians', title: 'Guardians', permission: 'stu.students.view', module: 'stu', parity: 'Web-only', web: { path: '/guardians' } },
  { screenId: 'student_guardians', title: 'Student guardians', permission: 'stu.students.view', module: 'stu', parity: 'Companion', web: { path: '/student-guardians' }, mobile: { route: '/student-guardians' } },
  { screenId: 'student_addresses', title: 'Student addresses', permission: 'stu.student_addresses.view', module: 'stu', parity: 'Web-only', web: { path: '/student-addresses' } },
  { screenId: 'users', title: 'Users', permission: 'iam.users.view', module: 'iam', parity: 'Companion', web: { path: '/users' }, mobile: { route: '/users' } },
  { screenId: 'profile', title: 'Profile', parity: 'Both', web: { path: '/profile' }, mobile: { route: '/profile' } },
]);

/** Permission needed for a web path, from the registry, so route guards and navigation can never disagree. */
export function permissionForPath(path: string): string | undefined {
  return Object.values(registry).find((d) => d.web?.path === path)?.permission;
}
