import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NotificationBell } from './NotificationBell';
import { badgeText, relativeTime, safeLink, unreadSentence } from './logic';
import { createNotificationsApi, type AppNotification } from './notificationsApi';
import { POLL_MS } from './useNotifications';

const note = (id: string, o: Partial<AppNotification> = {}): AppNotification => ({
  id,
  kind: 'user.password_reset',
  title: `Title ${id}`,
  body: `Body ${id}`,
  link: null,
  createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
  readAt: null,
  ...o,
});

/** A fake server holding the user's notifications; records every call. */
function server(initial: AppNotification[], opts: { forbidden?: boolean } = {}) {
  const items = [...initial];
  const calls: string[] = [];
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fetchFn = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://x');
    const path = url.pathname.replace('/api/v1', '');
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${path}${url.search}`);
    if (opts.forbidden) return json(403, { code: 'read_only_visit', detail: 'Read-only visit.' });
    if (path === '/me/notifications/read-all') {
      items.forEach((n) => (n.readAt ??= new Date().toISOString()));
      return new Response(null, { status: 204 });
    }
    const m = /^\/me\/notifications\/(.+)\/read$/.exec(path);
    if (m) {
      const n = items.find((i) => i.id === m[1]);
      if (n) n.readAt ??= new Date().toISOString();
      return new Response(null, { status: 204 });
    }
    return json(200, { items, page: { number: 1, size: 10, total: items.length }, unreadCount: items.filter((i) => !i.readAt).length });
  });
  return { items, calls, session: { fetch: fetchFn as unknown as typeof fetch } };
}

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

function mount(s: ReturnType<typeof server>, enabled = true) {
  const api = createNotificationsApi(s.session, '/api/v1');
  const view = render(
    <MemoryRouter>
      <Routes>
        <Route path="*" element={<><NotificationBell api={api} enabled={enabled} /><Where /></>} />
      </Routes>
    </MemoryRouter>,
  );
  return view;
}

afterEach(() => vi.useRealTimers());

describe('notification logic', () => {
  it('follows only paths inside the app', () => {
    expect(safeLink('/users')).toBe('/users');
    expect(safeLink('/students?x=1#top')).toBe('/students?x=1#top');
    expect(safeLink('https://evil.example/x')).toBeNull();
    expect(safeLink('//evil.example/x')).toBeNull();
    expect(safeLink('/\\evil.example')).toBeNull();
    expect(safeLink('javascript:alert(1)')).toBeNull();
    expect(safeLink('users')).toBeNull();
    expect(safeLink(null)).toBeNull();
  });
  it('writes times and counts for people', () => {
    const now = new Date('2026-11-22T12:00:00Z');
    expect(relativeTime('2026-11-22T11:59:40Z', now)).toBe('Just now');
    expect(relativeTime('2026-11-22T11:55:00Z', now)).toBe('5 min ago');
    expect(relativeTime('2026-11-22T09:00:00Z', now)).toBe('3 h ago');
    expect(relativeTime('2026-11-21T09:00:00Z', now)).toBe('Yesterday');
    expect(relativeTime('2026-11-18T09:00:00Z', now)).toBe('4 d ago');
    expect(badgeText(0)).toBe('');
    expect(badgeText(7)).toBe('7');
    expect(badgeText(250)).toBe('99+');
    expect(unreadSentence(1)).toBe('1 unread notification');
    expect(unreadSentence(3)).toBe('3 unread notifications');
  });
});

describe('notifications bell', () => {
  it('shows the unread count on the bell and announces it', async () => {
    const s = server([note('a'), note('b'), note('c', { readAt: '2026-11-01T00:00:00Z' })]);
    mount(s);
    expect(await screen.findByText('2')).toBeInTheDocument();
    expect(screen.getByTestId('unread-live')).toHaveTextContent('2 unread notifications');
  });

  it('marks a notification read when clicked and lowers the count', async () => {
    const s = server([note('a'), note('b')]);
    mount(s);
    await screen.findByText('2');
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    await userEvent.click(await screen.findByRole('button', { name: /Title a/ }));
    await waitFor(() => expect(s.calls).toContain('POST /me/notifications/a/read'));
    expect(await screen.findByText('1')).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/');
  });

  it('marks everything read with "Mark all as read"', async () => {
    const s = server([note('a'), note('b'), note('c')]);
    mount(s);
    await screen.findByText('3');
    await userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Mark all as read' }));
    await waitFor(() => expect(s.calls).toContain('POST /me/notifications/read-all'));
    await waitFor(() => expect(screen.getByTestId('unread-live')).toHaveTextContent('No unread notifications'));
    expect(screen.getByRole('button', { name: 'Mark all as read' })).toBeDisabled();
  });

  it('goes to a relative link and ignores any other kind of link', async () => {
    const s = server([note('a', { link: '/users' }), note('b', { link: 'https://evil.example/phish' }), note('c', { link: '//evil.example' })]);
    mount(s);
    await screen.findByText('3');
    const open = async () => userEvent.click(screen.getByRole('button', { name: 'Notifications' }));
    await open();
    await userEvent.click(await screen.findByRole('button', { name: /Title b/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/');
    await open();
    await userEvent.click(await screen.findByRole('button', { name: /Title c/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/');
    await open();
    await userEvent.click(await screen.findByRole('button', { name: /Title a/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/users');
    await waitFor(() => expect(s.calls).toContain('POST /me/notifications/b/read'));
  });

  it('shows an empty state and an error state with a retry', async () => {
    const empty = server([]);
    const { unmount } = mount(empty);
    await userEvent.click(await screen.findByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText('You are all caught up')).toBeInTheDocument();
    unmount();

    let fail = true;
    const s = server([note('a')]);
    const real = s.session.fetch;
    s.session.fetch = (async (...a: Parameters<typeof fetch>) => (fail ? new Response('{}', { status: 500 }) : real(...a))) as typeof fetch;
    mount(s);
    await userEvent.click(await screen.findByRole('button', { name: 'Notifications' }));
    expect(await screen.findByText('We could not load your notifications.')).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: /Title a/ })).toBeInTheDocument();
  });

  it('is hidden and asks nothing when disabled (a support visit)', () => {
    const s = server([note('a')]);
    mount(s, false);
    expect(screen.queryByRole('button', { name: 'Notifications' })).not.toBeInTheDocument();
    expect(s.session.fetch).not.toHaveBeenCalled();
  });

  it('disappears when the server refuses it as a read-only visit', async () => {
    const s = server([note('a')], { forbidden: true });
    mount(s);
    await waitFor(() => expect(s.session.fetch).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Notifications' })).not.toBeInTheDocument());
  });

  it('polls every minute and on focus, and stops when unmounted', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: false });
    const s = server([note('a')]);
    const { unmount } = mount(s);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    const lists = () => s.calls.filter((c) => c.startsWith('GET')).length;
    expect(lists()).toBe(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS);
    });
    expect(lists()).toBe(2);
    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(lists()).toBe(3);
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(POLL_MS * 3);
      window.dispatchEvent(new Event('focus'));
    });
    expect(lists()).toBe(3);
  });
});

