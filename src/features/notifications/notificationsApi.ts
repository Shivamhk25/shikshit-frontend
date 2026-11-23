import type { Session } from '@shikshit/shared/session';
import { ApiError } from '../../crud/client';

/** FND-16 notifications inbox (backend api/openapi/modules/iam-notifications.yaml): the signed-in user's own. */

export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  body: string;
  /** A path inside the app, or null. */
  link: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface NotificationPage {
  items: AppNotification[];
  page: { number: number; size: number; total: number };
  unreadCount: number;
}

async function failure(res: Response): Promise<ApiError> {
  let p: { code?: string; detail?: string } = {};
  try {
    p = (await res.json()) as typeof p;
  } catch {
    /* not JSON */
  }
  return new ApiError(res.status, p.code ?? 'error', {}, p.detail ?? 'Something went wrong. Please try again.');
}

async function send(session: Pick<Session, 'fetch'>, url: string, method: 'GET' | 'POST'): Promise<Response> {
  let res: Response;
  try {
    res = await session.fetch(url, { method });
  } catch {
    throw new ApiError(0, 'network', {}, 'Cannot reach the server. Check your connection.');
  }
  if (!res.ok) throw await failure(res);
  return res;
}

export function createNotificationsApi(session: Pick<Session, 'fetch'>, base: string) {
  return {
    list: async (p: { page?: number; pageSize?: number; unread?: boolean } = {}): Promise<NotificationPage> => {
      const q = new URLSearchParams({ page: String(p.page ?? 1), pageSize: String(p.pageSize ?? 10) });
      if (p.unread) q.set('unread', 'true');
      return (await (await send(session, `${base}/me/notifications?${q.toString()}`, 'GET')).json()) as NotificationPage;
    },
    markRead: async (id: string): Promise<void> => {
      await send(session, `${base}/me/notifications/${encodeURIComponent(id)}/read`, 'POST');
    },
    markAllRead: async (): Promise<void> => {
      await send(session, `${base}/me/notifications/read-all`, 'POST');
    },
  };
}
export type NotificationsApi = ReturnType<typeof createNotificationsApi>;
