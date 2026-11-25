import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWebSession } from '../../shell/web-session';
import { ShellApp } from '../../shell/ShellApp';
import { NAV_ICONS } from '../../shell/navIcons';
import { registry } from '../../shell/registry';
import { classLabel, contactText, guardianTags, relationLabel, searchPath, searchTerm, type IdentityCard, type IdentityMatch } from './identity';

const VIEW = ['stu.student_identity.view'];

const MATCHES: IdentityMatch[] = [
  { id: 's1', registrationCode: 'R-0001', fullName: 'Asha Rao', status: 'active', className: 'Class 5', sectionName: 'A', hasPhoto: true },
  { id: 's2', registrationCode: 'R-0014', fullName: 'Ashwin Kumar', status: 'paused', className: null, sectionName: null, hasPhoto: false },
];

function card(contactsVisible: boolean): IdentityCard {
  return {
    id: 's1', registrationCode: 'R-0001', fullName: 'Asha Rao', status: 'active', gender: 'female', dateOfBirth: '2015-06-01', hasPhoto: true, contactsVisible,
    enrollment: { academicYear: '2026-27', className: 'Class 5', sectionName: 'A', rollNumber: '12' },
    guardians: [
      { id: 'g1', name: 'Meera Rao', relation: 'mother', isPrimary: true, isLegalCustody: true, canPickup: true, phone: contactsVisible ? '9811122233' : null, email: contactsVisible ? 'meera@example.test' : null },
      { id: 'g2', name: 'Anil Rao', relation: 'father', isPrimary: false, isLegalCustody: false, canPickup: false, phone: contactsVisible ? '9811144455' : null, email: null },
    ],
    idCard: { instituteName: 'Springfield Public School', studentName: 'Asha Rao', registrationCode: 'R-0001', classSection: 'Class 5 - A', rollNumber: '12', dateOfBirth: '2015-06-01', academicYear: '2026-27', validUntil: '2027-03-31', primaryGuardianName: 'Meera Rao', emergencyPhone: contactsVisible ? '9811122233' : null },
  };
}

type Handler = (p: string, url: URL) => { status: number; body?: unknown } | undefined;

function mount(permissions: string[], handler: Handler = () => undefined, contactsVisible = true) {
  const calls: string[] = [];
  const json = (status: number, body?: unknown) => new Response(JSON.stringify(body ?? {}), { status, headers: { 'Content-Type': 'application/json' } });
  const fetchFn = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://x');
    const p = url.pathname.replace('/api/v1', '');
    calls.push(p + url.search);
    if (p === '/auth/refresh') return json(200, { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 9e5).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 9e8).toISOString(), mustChangePassword: false });
    if (p === '/me/access')
      return json(200, {
        user: { id: 'u1', name: 'Asha', tier: 'tenant' }, tenant: { id: 't1', name: 'School', brand: { primary: '#2F5BFF' }, modules: ['stu'] }, permissions, scopes: {}, fieldMasks: {},
        workspace: { home: 'x', navigation: [{ screenId: 'student_identity', label: 'Student identity', order: 44 }] }, mobile: { tabs: [], features: [] }, approvals: { canApprove: [] }, version: 1,
      });
    const custom = handler(p, url);
    if (custom) return json(custom.status, custom.body);
    if (p === '/student-identity') {
      const q = (url.searchParams.get('q') ?? '').toLowerCase();
      return json(200, { items: MATCHES.filter((m) => m.fullName.toLowerCase().includes(q)) });
    }
    if (p === '/student-identity/s1') return json(200, card(contactsVisible));
    if (p === '/students/s1/photo') return json(200, { url: 'https://storage.test/photo.png?sig=2', expiresAt: '' });
    return json(404, {});
  }) as typeof fetch;
  render(
    <MemoryRouter initialEntries={['/student-identity']}>
      <ShellApp session={createWebSession(fetchFn)} />
    </MemoryRouter>,
  );
  return calls;
}

afterEach(() => vi.restoreAllMocks());

const box = () => screen.findByLabelText('Name or registration code');
const searches = (calls: string[]) => calls.filter((c) => c.startsWith('/student-identity?'));

describe('registration', () => {
  it('has a web path, a phone route, an icon and the server permission', () => {
    expect(registry.student_identity).toMatchObject({ module: 'stu', permission: 'stu.student_identity.view', parity: 'Companion', web: { path: '/student-identity' }, mobile: { route: '/student-identity' } });
    expect(NAV_ICONS.student_identity).toBeDefined();
  });
});

describe('the small rules', () => {
  it('sends a search only from 2 characters, trimmed and collapsed, at most 100', () => {
    expect(searchTerm('a')).toBeNull();
    expect(searchTerm('  a  ')).toBeNull();
    expect(searchTerm('  Asha   Rao ')).toBe('Asha Rao');
    expect(searchTerm('x'.repeat(150))).toHaveLength(100);
    expect(searchPath('Asha Rao')).toBe('/student-identity?q=Asha+Rao&limit=10');
  });
  it('never returns a blank contact', () => {
    expect(contactText(null, false)).toBe('Hidden');
    expect(contactText(null, true)).toBe('Not recorded');
    expect(contactText('', false)).toBe('Hidden');
    expect(contactText('9811122233', false)).toBe('9811122233');
  });
  it('words class, relation and guardian tags plainly', () => {
    expect(classLabel('Class 5', 'A')).toBe('Class 5 A');
    expect(classLabel(null, null)).toBe('Not enrolled this year');
    expect(relationLabel('grand_mother')).toBe('Grand mother');
    expect(relationLabel('')).toBe('Guardian');
    expect(guardianTags({ id: 'g', name: 'x', relation: 'mother', isPrimary: true, isLegalCustody: false, canPickup: true, phone: null, email: null })).toEqual(['Primary contact', 'May collect the child']);
  });
});

describe('the student identity screen', () => {
  it('waits for two characters, then searches once after the pause', async () => {
    const calls = mount(VIEW);
    const user = userEvent.setup();
    await user.type(await box(), 'A');
    expect(await screen.findByText(/at least 2 characters/i, { selector: 'div' })).toBeInTheDocument();
    expect(searches(calls)).toHaveLength(0);
    await user.type(await box(), 'sh');
    expect(await screen.findByRole('button', { name: /Asha Rao/ })).toBeInTheDocument();
    expect(searches(calls)).toEqual(['/student-identity?q=Ash&limit=10']);
  });

  it('says so when nothing matches', async () => {
    mount(VIEW);
    await userEvent.setup().type(await box(), 'Zzz');
    expect(await screen.findByText(/No student matches/)).toBeInTheDocument();
  });

  it('shows an error with Try again when the search fails, and recovers', async () => {
    let fail = true;
    mount(VIEW, (p) => (p === '/student-identity' && fail ? { status: 500, body: { detail: 'The search could not be completed.' } } : undefined));
    const user = userEvent.setup();
    await user.type(await box(), 'Ash');
    expect(await screen.findByRole('alert')).toHaveTextContent('The search could not be completed.');
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: /Asha Rao/ })).toBeInTheDocument();
  });

  it('opens the card with codes, class, guardians and the ID card, with contacts visible', async () => {
    const calls = mount(VIEW);
    const user = userEvent.setup();
    await user.type(await box(), 'Ash');
    await user.click(await screen.findByRole('button', { name: /Asha Rao/ }));
    const view = await screen.findByTestId('identity-card');
    expect(within(view).getByRole('heading', { name: 'Asha Rao' })).toBeInTheDocument();
    expect(within(view).getAllByText('R-0001')).toHaveLength(2);
    expect(within(view).getByText('Class 5 A · 2026-27')).toBeInTheDocument();
    expect(within(view).getAllByText('9811122233')).toHaveLength(2);
    expect(within(view).getByText('meera@example.test')).toBeInTheDocument();
    expect(within(view).queryByText('Hidden')).toBeNull();
    expect(within(view).getByText('Not recorded')).toBeInTheDocument();
    const id = within(view).getByTestId('id-card');
    expect(within(id).getByText('Springfield Public School')).toBeInTheDocument();
    expect(within(id).getByText('Valid until')).toBeInTheDocument();
    expect(await screen.findAllByRole('img', { name: 'Photo of Asha Rao' })).not.toHaveLength(0);
    expect(calls).toContain('/students/s1/photo');
  });

  it('writes "Hidden" for every masked contact and never leaves a blank', async () => {
    mount(VIEW, undefined, false);
    const user = userEvent.setup();
    await user.type(await box(), 'Ash');
    await user.click(await screen.findByRole('button', { name: /Asha Rao/ }));
    const view = await screen.findByTestId('identity-card');
    expect(within(view).getByText(/hidden for your role/)).toBeInTheDocument();
    // two guardians x phone and email, plus the card's emergency number
    expect(within(view).getAllByText('Hidden')).toHaveLength(5);
    expect(view.textContent).not.toMatch(/9811122233|meera@example/);
  });

  it('shows a card error and offers Try again for a failure, but not for a missing student', async () => {
    let status = 500;
    mount(VIEW, (p) => (p === '/student-identity/s1' ? { status, body: { detail: 'The card could not be loaded.' } } : undefined));
    const user = userEvent.setup();
    await user.type(await box(), 'Ash');
    await user.click(await screen.findByRole('button', { name: /Asha Rao/ }));
    expect(await screen.findByText('The card could not be loaded.')).toBeInTheDocument();
    status = 404;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/not found, or is not in your classes/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('prints with the browser print dialog', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined);
    mount(VIEW);
    const user = userEvent.setup();
    await user.type(await box(), 'Ash');
    await user.click(await screen.findByRole('button', { name: /Asha Rao/ }));
    await user.click(await screen.findByRole('button', { name: 'Print ID card' }));
    expect(print).toHaveBeenCalledOnce();
  });

  it('explains when the role may not view this screen, and never calls the search', async () => {
    const calls = mount(['stu.students.view']);
    await waitFor(() => expect(screen.queryByText('Student identity')).toBeNull());
    expect(searches(calls)).toHaveLength(0);
  });
});
