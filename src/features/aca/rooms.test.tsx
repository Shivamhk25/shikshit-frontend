import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { createWebSession } from '../../shell/web-session';
import { ShellApp } from '../../shell/ShellApp';
import type { Room } from './rooms';

const ALL = ['aca.rooms.view', 'aca.rooms.create', 'aca.rooms.edit', 'aca.rooms.delete'];

function room(n: number, over: Partial<Room> = {}): Room {
  return { id: `id-${n}`, code: `R${n}`, name: `Room ${n}`, type: 'classroom', capacity: 30, building: 'Main', floor: null, availableForTimetable: true, displayOrder: n, description: null, status: 'active', ...over };
}

/** A fake of the real contract: cookie session, /me/access, and the rooms endpoints with server-side validation. */
function fakeServer(permissions: string[], initial: Room[], opts: { failList?: boolean } = {}) {
  const rooms = [...initial];
  const calls: { method: string; path: string; body?: Record<string, unknown> }[] = [];
  let seq = 100;
  const json = (status: number, body: unknown, h: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...h } });
  const problem = (status: number, code: string, errors?: { field: string; code: string; message: string }[]) => json(status, { code, status, errors });

  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input), 'http://x');
    const path = url.pathname.replace('/api/v1', '');
    const method = init?.method ?? 'GET';
    const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : undefined;
    calls.push({ method, path: path + url.search, body });

    if (path === '/auth/refresh') return json(200, { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 9e5).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 9e8).toISOString(), mustChangePassword: false });
    if (path === '/me/access') {
      return json(200, {
        user: { id: 'u1', name: 'Asha', tier: 'tenant' },
        tenant: { id: 't1', name: 'School', brand: { primary: '#2F5BFF' }, modules: ['aca'] },
        permissions,
        scopes: {},
        fieldMasks: {},
        workspace: { home: 'x', navigation: [{ screenId: 'home', label: 'Home', order: 1 }, { screenId: 'rooms', label: 'Rooms', order: 2 }] },
        mobile: { tabs: [], features: [] },
        approvals: { canApprove: [] },
        version: 1,
      }, { 'X-Access-Version': '1' });
    }
    if (path === '/rooms' && method === 'GET') {
      if (opts.failList) return problem(500, 'internal_error');
      const q = (url.searchParams.get('q') ?? '').toLowerCase();
      const sort = url.searchParams.get('sort') ?? 'displayOrder';
      let items = rooms.filter((r) => !q || r.name.toLowerCase().includes(q));
      const key = sort.replace(/^-/, '') as keyof Room;
      items = [...items].sort((a, b) => (String(a[key]) < String(b[key]) ? -1 : 1) * (sort.startsWith('-') ? -1 : 1));
      return json(200, { items, page: { number: 1, size: 25, total: items.length } });
    }
    if (path === '/rooms' && method === 'POST') {
      if (!permissions.includes('aca.rooms.create')) return problem(403, 'permission_denied');
      const errs = [];
      if (!String(body?.name ?? '').trim()) errs.push({ field: 'name', code: 'required', message: 'Enter a name.' });
      if (body?.code && rooms.some((r) => r.code === body.code)) errs.push({ field: 'code', code: 'duplicate', message: 'Another room already uses this code.' });
      if (errs.length) return problem(400, 'validation_failed', errs);
      const r = { ...room(0), ...(body as Partial<Room>), id: `id-${++seq}` } as Room;
      rooms.push(r);
      return json(201, r);
    }
    const m = /^\/rooms\/(.+)$/.exec(path);
    if (m) {
      const i = rooms.findIndex((r) => r.id === m[1]);
      if (i < 0) return problem(404, 'not_found');
      if (method === 'PUT') {
        rooms[i] = { ...rooms[i]!, ...(body as Partial<Room>) };
        return json(200, rooms[i]);
      }
      if (method === 'DELETE') {
        rooms.splice(i, 1);
        return new Response(null, { status: 204 });
      }
    }
    return json(404, {});
  }) as typeof fetch;
  return { fetchFn, calls, rooms };
}

function mount(permissions: string[], initial: Room[], opts?: { failList?: boolean }) {
  const server = fakeServer(permissions, initial, opts);
  render(
    <MemoryRouter initialEntries={['/rooms']}>
      <ShellApp session={createWebSession(server.fetchFn)} />
    </MemoryRouter>,
  );
  return server;
}

describe('rooms page', () => {
  it('lists rooms for a view-only user and shows no write controls', async () => {
    mount(['aca.rooms.view'], [room(1), room(2)]);
    expect(await screen.findByText('Room 1')).toBeInTheDocument();
    expect(screen.getByText('Room 2')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Add room/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Edit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('columnheader', { name: 'Actions' })).not.toBeInTheDocument();
  });

  it('is not available at all without the view permission', async () => {
    mount([], [room(1)]);
    expect(await screen.findByRole('alert')).toHaveTextContent('Not available');
  });

  it('shows the empty state, with a hint to add one when the user can', async () => {
    mount(ALL, []);
    expect(await screen.findByText(/No rooms yet/)).toHaveTextContent('Add room');
  });

  it('shows a retry when loading fails', async () => {
    mount(ALL, [], { failList: true });
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('adds a room and lists it', async () => {
    const server = mount(ALL, [room(1)]);
    await userEvent.click(await screen.findByRole('button', { name: 'Add room' }));
    const sheet = await screen.findByRole('dialog', { name: 'Add room' });
    await userEvent.type(within(sheet).getByLabelText('Name *'), 'Science Lab');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Science Lab')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Room added.');
    const post = server.calls.find((c) => c.method === 'POST' && c.path === '/rooms')!;
    expect(post.body).toMatchObject({ name: 'Science Lab', capacity: 30, code: null, availableForTimetable: true, status: 'active' });
  });

  it('shows the server validation message beside the field and keeps the form open', async () => {
    mount(ALL, [room(1)]);
    await userEvent.click(await screen.findByRole('button', { name: 'Add room' }));
    const sheet = await screen.findByRole('dialog');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(await within(sheet).findByText('Enter a name.')).toBeInTheDocument();
    expect(within(sheet).getByLabelText('Name *')).toHaveAttribute('aria-invalid', 'true');

    await userEvent.type(within(sheet).getByLabelText('Name *'), 'Dup');
    await userEvent.type(within(sheet).getByLabelText('Code'), 'R1');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(await within(sheet).findByText('Another room already uses this code.')).toBeInTheDocument();
  });

  it('edits a room with its values prefilled', async () => {
    const server = mount(ALL, [room(1)]);
    await userEvent.click(await screen.findByRole('button', { name: 'Edit Room 1' }));
    const sheet = await screen.findByRole('dialog', { name: 'Edit room' });
    expect(within(sheet).getByLabelText('Name *')).toHaveValue('Room 1');
    expect(within(sheet).getByLabelText('Code')).toHaveValue('R1');
    await userEvent.clear(within(sheet).getByLabelText('Name *'));
    await userEvent.type(within(sheet).getByLabelText('Name *'), 'Renamed');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Renamed')).toBeInTheDocument();
    expect(server.calls.some((c) => c.method === 'PUT' && c.path === '/rooms/id-1')).toBe(true);
  });

  it('asks before deleting, and removes the room when confirmed', async () => {
    const server = mount(ALL, [room(1), room(2)]);
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Room 1' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Room 1');
    expect(server.calls.some((c) => c.method === 'DELETE')).toBe(false);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('Room 1')).not.toBeInTheDocument());
    expect(screen.getByText('Room 2')).toBeInTheDocument();
  });

  it('cancelling the delete dialog deletes nothing', async () => {
    const server = mount(ALL, [room(1)]);
    await userEvent.click(await screen.findByRole('button', { name: 'Delete Room 1' }));
    await userEvent.click(within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }));
    expect(server.calls.some((c) => c.method === 'DELETE')).toBe(false);
    expect(screen.getByText('Room 1')).toBeInTheDocument();
  });

  it('searches on the server after a pause and tells the user when nothing matches', async () => {
    const server = mount(ALL, [room(1), room(2)]);
    await screen.findByText('Room 1');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Search rooms' }), 'zzz');
    expect(await screen.findByText(/No rooms match/)).toBeInTheDocument();
    expect(server.calls.some((c) => c.path.includes('q=zzz'))).toBe(true);
  });

  it('sorts by a column on click and flips the direction on the second click', async () => {
    const server = mount(ALL, [room(1), room(2)]);
    await screen.findByText('Room 1');
    await userEvent.click(screen.getByRole('button', { name: 'Capacity' }));
    await waitFor(() => expect(server.calls.some((c) => c.path.includes('sort=capacity'))).toBe(true));
    await userEvent.click(screen.getByRole('button', { name: /Capacity/ }));
    await waitFor(() => expect(server.calls.some((c) => c.path.includes('sort=-capacity'))).toBe(true));
    expect(screen.getByRole('columnheader', { name: /Capacity/ })).toHaveAttribute('aria-sort', 'descending');
  });
});
