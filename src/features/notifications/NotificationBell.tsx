import { useState } from 'react';
import * as D from '@radix-ui/react-dialog';
import { Bell, BellOff, CheckCheck, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button, cx } from '../../design-system';
import { badgeText, relativeTime, safeLink, unreadSentence } from './logic';
import type { NotificationsApi } from './notificationsApi';
import { useNotifications } from './useNotifications';

const phoneQuery = '(max-width: 639px)';
const onPhone = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(phoneQuery).matches;

/**
 * The bell in the app header: an unread badge, and a panel with the latest notifications (a popover beside the bell on
 * wider screens, a full sheet on a phone). Picking one marks it read and, when it has an in-app link, goes there.
 * Renders nothing when `enabled` is false (signed out, or a read-only support visit, which the server refuses).
 */
export function NotificationBell({ api, enabled = true }: { api: NotificationsApi; enabled?: boolean }) {
  const n = useNotifications(api, enabled);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(false);
  if (!enabled || n.blocked) return null;

  const badge = badgeText(n.unreadCount);
  const choose = (id: string, link: string | null) => {
    void n.markRead(id);
    const to = link === null ? null : safeLink(link);
    setOpen(false);
    if (to) navigate(to);
  };

  return (
    <D.Root
      open={open}
      modal={phone}
      onOpenChange={(o) => {
        if (o) setPhone(onPhone());
        setOpen(o);
        if (o) void n.refresh();
      }}
    >
      <D.Trigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex size-9 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-subtle hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Bell aria-hidden="true" className="size-5" />
          {badge ? (
            <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white ring-2 ring-canvas">
              {badge}
            </span>
          ) : null}
        </button>
      </D.Trigger>
      {/* Spoken whenever the count changes, so a screen-reader user hears new notifications arrive. */}
      <span aria-live="polite" aria-atomic="true" data-testid="unread-live" className="sr-only">
        {n.phase === 'ready' ? unreadSentence(n.unreadCount) : ''}
      </span>
      <D.Portal>
        {phone ? <D.Overlay className="fixed inset-0 z-40 bg-overlay" /> : null}
        <D.Content
          aria-label="Notifications"
          aria-describedby={undefined}
          className={cx(
            'fixed z-50 flex flex-col bg-surface text-fg outline-none',
            'inset-0 sm:inset-auto sm:right-8 sm:top-14 sm:max-h-[min(34rem,calc(100vh-4.5rem))] sm:w-[26rem] sm:rounded-lg sm:border sm:border-line-subtle sm:shadow-float',
          )}
        >
          <div className="flex items-center gap-2 border-b border-line-subtle px-4 py-3">
            <D.Title className="flex-1 font-display text-lg font-semibold">Notifications</D.Title>
            <Button size="sm" variant="ghost" disabled={n.unreadCount === 0} onClick={() => void n.markAllRead()}>
              <CheckCheck aria-hidden="true" className="size-4" />
              Mark all as read
            </Button>
            <D.Close aria-label="Close" className="flex size-8 items-center justify-center rounded-md text-fg-subtle hover:bg-subtle hover:text-fg">
              <X aria-hidden="true" className="size-4" />
            </D.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {n.phase === 'loading' ? (
              <p role="status" className="px-4 py-10 text-center text-sm text-fg-muted">
                Loading…
              </p>
            ) : n.phase === 'error' ? (
              <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
                <p className="text-sm text-fg">We could not load your notifications.</p>
                <Button size="sm" variant="secondary" onClick={() => void n.refresh()}>
                  Try again
                </Button>
              </div>
            ) : n.items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                <span aria-hidden="true" className="flex size-11 items-center justify-center rounded-full bg-subtle text-fg-subtle">
                  <BellOff className="size-5" />
                </span>
                <p className="font-medium text-fg">You are all caught up</p>
                <p className="text-sm text-fg-muted">New notifications about your account and your school appear here.</p>
              </div>
            ) : (
              <ul>
                {n.items.map((item) => {
                  const unread = item.readAt === null;
                  return (
                    <li key={item.id} className="border-b border-line-subtle last:border-b-0">
                      <button
                        type="button"
                        onClick={() => choose(item.id, item.link)}
                        className={cx(
                          'flex w-full gap-3 px-4 py-3.5 text-left transition-colors hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                          unread && 'bg-accent-subtle/40',
                        )}
                      >
                        <span aria-hidden="true" className={cx('mt-1.5 size-2 shrink-0 rounded-full', unread ? 'bg-accent' : 'bg-transparent')} />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-3">
                            <span className={cx('truncate text-sm', unread ? 'font-semibold text-fg' : 'font-medium text-fg-muted')}>
                              {unread ? <span className="sr-only">Unread: </span> : null}
                              {item.title}
                            </span>
                            <time dateTime={item.createdAt} className="shrink-0 text-xs text-fg-subtle">
                              {relativeTime(item.createdAt)}
                            </time>
                          </span>
                          <span className="mt-0.5 line-clamp-2 block text-sm text-fg-muted">{item.body}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
