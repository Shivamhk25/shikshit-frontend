import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../../crud/client';
import type { AppNotification, NotificationsApi } from './notificationsApi';

export const POLL_MS = 60_000;

export interface NotificationsState {
  phase: 'loading' | 'ready' | 'error';
  items: AppNotification[];
  unreadCount: number;
  /** The server refuses notifications in this session (a read-only support visit): show nothing. */
  blocked: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
}

/**
 * The latest notifications and the unread count. Refreshes every minute and when the window gets focus or the tab
 * becomes visible; stops when `enabled` goes false or the component unmounts. A change the user makes shows at once and
 * is put back if the server refuses it.
 */
export function useNotifications(api: NotificationsApi, enabled: boolean): NotificationsState {
  const [phase, setPhase] = useState<NotificationsState['phase']>('loading');
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [blocked, setBlocked] = useState(false);
  const live = useRef(true);
  /** Bumped by every local change, so a slower list response that started before it cannot undo it. */
  const version = useRef(0);

  const refresh = useCallback(async () => {
    const started = version.current;
    try {
      const page = await api.list({ page: 1, pageSize: 10 });
      if (!live.current || started !== version.current) return;
      setItems(page.items);
      setUnreadCount(page.unreadCount);
      setPhase('ready');
    } catch (e) {
      if (!live.current) return;
      if (e instanceof ApiError && e.status === 403) {
        setBlocked(true);
        return;
      }
      // keep what is shown if we already have it; the next poll tries again
      setPhase((p) => (p === 'ready' ? p : 'error'));
    }
  }, [api]);

  useEffect(() => {
    live.current = true;
    if (!enabled || blocked) return () => void (live.current = false);
    void refresh();
    const timer = setInterval(() => void refresh(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    const onFocus = () => void refresh();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      live.current = false;
      clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, blocked, refresh]);

  const markRead = useCallback(
    async (id: string) => {
      const target = items.find((n) => n.id === id);
      if (!target || target.readAt) return;
      version.current += 1;
      const stamp = new Date().toISOString();
      setItems((cur) => cur.map((n) => (n.id === id ? { ...n, readAt: stamp } : n)));
      setUnreadCount((c) => Math.max(0, c - 1));
      try {
        await api.markRead(id);
      } catch {
        void refresh();
      }
    },
    [api, items, refresh],
  );

  const markAllRead = useCallback(async () => {
    version.current += 1;
    const stamp = new Date().toISOString();
    setItems((cur) => cur.map((n) => (n.readAt ? n : { ...n, readAt: stamp })));
    setUnreadCount(0);
    try {
      await api.markAllRead();
    } catch {
      void refresh();
    }
  }, [api, refresh]);

  return { phase, items, unreadCount, blocked, refresh, markRead, markAllRead };
}
