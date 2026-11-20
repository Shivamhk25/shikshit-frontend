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
  { screenId: 'profile', title: 'Profile', parity: 'Both', web: { path: '/profile' }, mobile: { route: '/profile' } },
]);

/** Permission needed for a web path, from the registry, so route guards and navigation can never disagree. */
export function permissionForPath(path: string): string | undefined {
  return Object.values(registry).find((d) => d.web?.path === path)?.permission;
}
