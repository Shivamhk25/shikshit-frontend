import { defineRegistry } from '@shikshit/shared/access';

/**
 * Screens the web app can render. Ids and permissions match the server's screen list
 * (backend internal/platform/authz/screens.go) and the mobile registry. A screen the server offers that is not
 * listed here is skipped, so a newer server never breaks an older web build.
 */
export const registry = defineRegistry([
  { screenId: 'home', title: 'Home', parity: 'Both', web: { path: '/' }, mobile: { route: '/home' } },
  { screenId: 'onboarding', title: 'Onboarding', permission: 'onb.workspace.view', module: 'onb', parity: 'Web-only', web: { path: '/onboarding' } },
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
  { screenId: 'profile', title: 'Profile', parity: 'Both', web: { path: '/profile' }, mobile: { route: '/profile' } },
]);

/** Permission needed for a web path, from the registry, so route guards and navigation can never disagree. */
export function permissionForPath(path: string): string | undefined {
  return Object.values(registry).find((d) => d.web?.path === path)?.permission;
}
