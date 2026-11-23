/** Pure helpers for the inbox. */

/**
 * The in-app path to open for a notification, or null. Only a path that stays on this site is followed: it must start
 * with a single "/", so an absolute address, a protocol-relative one ("//host"), a backslash trick or a script URL
 * is never navigated to.
 */
export function safeLink(link: string | null | undefined): string | null {
  if (typeof link !== 'string' || !link.startsWith('/') || link.startsWith('//') || link.includes('\\')) return null;
  try {
    const u = new URL(link, 'http://app.invalid');
    if (u.origin !== 'http://app.invalid') return null;
    return u.pathname + u.search + u.hash;
  } catch {
    return null;
  }
}

/** "Just now", "5 min ago", "3 h ago", "Yesterday", "4 d ago", then the date. */
export function relativeTime(iso: string, now = new Date()): string {
  const then = new Date(iso);
  const secs = Math.round((now.getTime() - then.getTime()) / 1000);
  if (Number.isNaN(secs) || secs < 60) return 'Just now';
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} d ago`;
  return then.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: then.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

/** The badge text: nothing for zero, "99+" past 99. */
export function badgeText(count: number): string {
  return count <= 0 ? '' : count > 99 ? '99+' : String(count);
}

/** The spoken form of the count, for the live region. */
export function unreadSentence(count: number): string {
  return count === 0 ? 'No unread notifications' : count === 1 ? '1 unread notification' : `${count} unread notifications`;
}
