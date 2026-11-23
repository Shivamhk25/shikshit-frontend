import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { createWebSession } from '../../shell/web-session';
import { ShellApp } from '../../shell/ShellApp';
import { formatDateTime, fromLocalInput, toLocalInput } from './dates';
import { discussionsDescriptor, LANGUAGES, type Discussion } from './discussions';
import type { Enquiry } from './enquiries';

const VIEW = ['adm.enquiry_discussions.view'];
const ALL = [...VIEW, 'adm.enquiry_discussions.create', 'adm.enquiry_discussions.edit', 'adm.enquiry_discussions.delete'];
const ENQ = ['adm.enquiry.view', 'adm.enquiry.edit'];

const enquiry: Enquiry = {
  id: 'e1', code: 'ENQ-000007', enquirerName: 'Sunil Kumar', phone: '9810012345', email: null, childName: 'Anaya Kumar', dateOfBirth: null, classId: null, classCode: null,
  className: null, yearId: null, yearName: null, source: 'walk_in', status: 'new', followUpDate: '2026-12-01', followUpDue: false, notes: null, assignedToId: null,
  assignedToName: null, createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z',
};

function note(n: number, over: Partial<Discussion> = {}): Discussion {
  return {
    id: `d${n}`, enquiryId: 'e1', enquiryCode: 'ENQ-000007', enquiryChildName: 'Anaya Kumar', contactedAt: `2026-11-${10 + n}T09:00:00Z`, channel: 'call', summary: `Spoke about fees ${n}`,
    notes: null, outcome: 'interested', nextFollowUpDate: null, language: 'hi', loggedById: 'u1', loggedByName: 'Asha Verma', createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', ...over,
  };
}

function fakeServer(permissions: string[], initial: Discussion[], opts: { failCreate?: boolean } = {}) {
  const rows = [...initial];
  const calls: { method: string; path: string; body?: Record<string, unknown> }[] = [];
  const json = (status: number, body: unknown, h: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...h } });
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
        tenant: { id: 't1', name: 'School', brand: { primary: '#2F5BFF' }, modules: ['adm'] },
        permissions, scopes: {}, fieldMasks: {},
        workspace: { home: 'x', navigation: [{ screenId: 'home', label: 'Home', order: 1 }, { screenId: 'enquiries', label: 'Enquiries', order: 35 }, { screenId: 'enquiry_discussions', label: 'Enquiry discussions', order: 36 }] },
        mobile: { tabs: [], features: [] }, approvals: { canApprove: [] }, version: 1,
      }, { 'X-Access-Version': '1' });
    }
    if (path === '/enquiries' && method === 'GET') return json(200, { items: [enquiry], page: { number: 1, size: 20, total: 1 } });
    if (path === '/enquiries/e1' && method === 'GET') return json(200, enquiry);
    if (path === '/enquiries/e1' && method === 'PUT') return json(200, { ...enquiry, ...body });
    if (path === '/enquiry-discussions' && method === 'GET') {
      const f = (k: string) => url.searchParams.get(k);
      const items = rows.filter((r) => (!f('enquiryId') || r.enquiryId === f('enquiryId')) && (!f('channel') || r.channel === f('channel')) && (!f('outcome') || r.outcome === f('outcome')))
        .sort((a, b) => b.contactedAt.localeCompare(a.contactedAt));
      return json(200, { items, page: { number: 1, size: 25, total: items.length } });
    }
    if (path === '/enquiry-discussions' && method === 'POST') {
      if (opts.failCreate || !String(body?.summary ?? '').trim()) return json(400, { code: 'validation_failed', status: 400, errors: [{ field: 'summary', code: 'required', message: 'Enter a one-line summary of what was discussed.' }] });
      const d = { ...note(0), ...(body as Partial<Discussion>), id: `d${rows.length + 10}` } as Discussion;
      rows.push(d);
      return json(201, d);
    }
    return json(404, {});
  }) as typeof fetch;
  return { fetchFn, calls, rows };
}

function mount(path: string, permissions: string[], initial: Discussion[], opts?: { failCreate?: boolean }) {
  const server = fakeServer(permissions, initial, opts);
  render(
    <MemoryRouter initialEntries={[path]}>
      <ShellApp session={createWebSession(server.fetchFn)} />
    </MemoryRouter>,
  );
  return server;
}

describe('enquiry discussions page', () => {
  it('lists notes with their enquiry, channel, outcome and language; a view-only user sees no write controls', async () => {
    mount('/enquiry-discussions', VIEW, [note(1, { channel: 'whatsapp', language: 'mr', outcome: 'call_back_later', nextFollowUpDate: '2026-12-05' })]);
    expect(await screen.findByText('Spoke about fees 1')).toBeInTheDocument();
    const table = screen.getByRole('table');
    for (const text of ['ENQ-000007 · Anaya Kumar', 'WhatsApp', 'Call back later', '5 Dec 2026', 'Asha Verma', '11 Nov 2026, 2:30 pm']) expect(within(table).getByText(text)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Add discussion/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Edit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Delete/ })).not.toBeInTheDocument();
  });

  it('is not available without the view permission', async () => {
    mount('/enquiry-discussions', ['adm.enquiry.view'], [note(1)]);
    expect(await screen.findByRole('alert')).toHaveTextContent('Not available');
  });

  it('sends the channel filter to the server', async () => {
    const server = mount('/enquiry-discussions', ALL, [note(1), note(2, { channel: 'visit', summary: 'Came to see the school' })]);
    await screen.findByText('Spoke about fees 1');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Channels' }), 'visit');
    await waitFor(() => expect(server.calls.some((c) => c.path.includes('channel=visit'))).toBe(true));
    expect(await screen.findByText('Came to see the school')).toBeInTheDocument();
    expect(screen.queryByText('Spoke about fees 1')).not.toBeInTheDocument();
  });

  it('adds a note for an enquiry found by search, reading the time as India time', async () => {
    const server = mount('/enquiry-discussions', ALL, []);
    await userEvent.click(await screen.findByRole('button', { name: 'Add discussion' }));
    const sheet = await screen.findByRole('dialog', { name: 'Add discussion' });
    await userEvent.selectOptions(await within(sheet).findByRole('combobox', { name: 'Enquiry results' }), await within(sheet).findByRole('option', { name: 'Anaya Kumar (ENQ-000007)' }));
    const when = within(sheet).getByLabelText('Contacted on *');
    await userEvent.clear(when);
    await userEvent.type(when, '2026-11-23T14:30');
    await userEvent.type(within(sheet).getByLabelText('What was discussed *'), '  Asked about the fee for Nursery ');
    await userEvent.selectOptions(within(sheet).getByLabelText('How it ended *'), 'visit_scheduled');
    await userEvent.selectOptions(within(sheet).getByLabelText('Language spoken *'), 'ta');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Asked about the fee for Nursery')).toBeInTheDocument();
    const post = server.calls.find((c) => c.method === 'POST' && c.path === '/enquiry-discussions')!;
    expect(post.body).toMatchObject({ enquiryId: 'e1', contactedAt: '2026-11-23T09:00:00.000Z', channel: 'call', language: 'ta', outcome: 'visit_scheduled', notes: null, nextFollowUpDate: null, updateEnquiryFollowUp: false });
  });

  it('shows field errors from the server on the field', async () => {
    mount('/enquiry-discussions', ALL, []);
    await userEvent.click(await screen.findByRole('button', { name: 'Add discussion' }));
    const sheet = await screen.findByRole('dialog');
    await userEvent.click(within(sheet).getByRole('button', { name: 'Save' }));
    expect(await within(sheet).findByText('Enter a one-line summary of what was discussed.')).toBeInTheDocument();
    expect(within(sheet).getByLabelText('What was discussed *')).toHaveAttribute('aria-invalid', 'true');
  });
});

describe('follow-up notes inside an enquiry', () => {
  const openEnquiry = async () => {
    await userEvent.click(await screen.findByRole('button', { name: 'Edit ENQ-000007 · Anaya Kumar' }));
    return screen.findByRole('dialog', { name: 'Edit enquiry' });
  };

  it('shows the enquiry number and its notes, newest first', async () => {
    mount('/enquiries', [...ENQ, ...VIEW], [note(1), note(2, { summary: 'Second call', notes: 'Father will visit', nextFollowUpDate: '2026-12-02' })]);
    const sheet = await openEnquiry();
    expect(within(sheet).getByText('ENQ-000007')).toBeInTheDocument();
    const items = await within(sheet).findAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent('Second call');
    expect(items[0]).toHaveTextContent('Father will visit');
    expect(items[0]).toHaveTextContent('Contact again on 2 Dec 2026');
    expect(items[1]).toHaveTextContent('Spoke about fees 1');
    expect(within(sheet).queryByRole('button', { name: 'Log a contact' })).not.toBeInTheDocument();
  });

  it('shows nothing about notes to a user who may not view them', async () => {
    mount('/enquiries', ENQ, [note(1)]);
    const sheet = await openEnquiry();
    expect(within(sheet).queryByText('Follow-up notes')).not.toBeInTheDocument();
  });

  it('logs a contact without saving the enquiry, and moves the form’s follow-up date when asked', async () => {
    const server = mount('/enquiries', [...ENQ, ...ALL], [note(1)]);
    const sheet = await openEnquiry();
    expect(within(sheet).getByLabelText('Follow-up date')).toHaveValue('2026-12-01');
    await userEvent.click(await within(sheet).findByRole('button', { name: 'Log a contact' }));
    const form = await screen.findByRole('dialog', { name: 'Log a contact' });
    expect(within(form).queryByLabelText(/^Enquiry/)).not.toBeInTheDocument(); // the note is for this enquiry
    await userEvent.type(within(form).getByLabelText('What was discussed *'), 'Confirmed the visit');
    await userEvent.selectOptions(within(form).getByLabelText('How it ended *'), 'visit_scheduled');
    await userEvent.type(within(form).getByLabelText('Contact again on'), '2026-12-09');
    await userEvent.click(within(form).getByRole('checkbox', { name: /follow-up date/ }));
    await userEvent.click(within(form).getByRole('button', { name: 'Save contact' }));
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Log a contact' })).not.toBeInTheDocument());
    const post = server.calls.find((c) => c.method === 'POST' && c.path === '/enquiry-discussions')!;
    expect(post.body).toMatchObject({ enquiryId: 'e1', summary: 'Confirmed the visit', nextFollowUpDate: '2026-12-09', updateEnquiryFollowUp: true });
    expect(server.calls.some((c) => c.method === 'PUT')).toBe(false); // saving the note did not save the enquiry
    expect(within(sheet).getByLabelText('Follow-up date')).toHaveValue('2026-12-09'); // the open form follows, so saving it later keeps the new date
    expect(await within(sheet).findByText('Confirmed the visit')).toBeInTheDocument();
  });

  it('keeps the form open and shows the error when a note cannot be saved', async () => {
    mount('/enquiries', [...ENQ, ...ALL], [], { failCreate: true });
    const sheet = await openEnquiry();
    await userEvent.click(await within(sheet).findByRole('button', { name: 'Log a contact' }));
    const form = await screen.findByRole('dialog', { name: 'Log a contact' });
    await userEvent.click(within(form).getByRole('button', { name: 'Save contact' }));
    expect(await within(form).findByText('Enter a one-line summary of what was discussed.')).toBeInTheDocument();
  });
});

describe('dates and languages', () => {
  it('reads and writes date-times as India time, whatever the viewer’s zone', () => {
    expect(fromLocalInput('2026-11-23T14:30')).toBe('2026-11-23T09:00:00.000Z');
    expect(toLocalInput('2026-11-23T09:00:00Z')).toBe('2026-11-23T14:30');
    expect(toLocalInput('2026-11-23T20:00:00Z')).toBe('2026-11-24T01:30'); // past midnight in India
    expect(formatDateTime('2026-11-23T09:00:00Z')).toBe('23 Nov 2026, 2:30 pm');
    expect(formatDateTime('2026-11-23T18:35:00Z')).toBe('24 Nov 2026, 12:05 am');
    expect(formatDateTime('2026-11-23T06:30:00Z')).toBe('23 Nov 2026, 12:00 pm');
    expect(fromLocalInput('')).toBeNull();
    expect(fromLocalInput('tomorrow')).toBeNull();
    expect(formatDateTime(null)).toBe('—');
  });
  it('offers the same languages as the server, English and "other" included', () => {
    expect(LANGUAGES.map((l) => l.value)).toEqual(['en', 'hi', 'bn', 'mr', 'te', 'ta', 'gu', 'ur', 'kn', 'ml', 'or', 'pa', 'as', 'other']);
  });
  it('sends the tick box as asked, so the server can say a date is needed', () => {
    expect(discussionsDescriptor.toInput({ enquiryId: 'e1', contactedAt: '', channel: 'call', summary: ' x ', outcome: 'other', language: 'en', nextFollowUpDate: '', notes: '', updateEnquiryFollowUp: true }))
      .toMatchObject({ contactedAt: null, summary: 'x', notes: null, nextFollowUpDate: null, updateEnquiryFollowUp: true });
  });
});
