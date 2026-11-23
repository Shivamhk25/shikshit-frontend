import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { createWebSession } from '../../shell/web-session';
import { ShellApp } from '../../shell/ShellApp';
import { drillHref, formatCount, formatRate, insightsCsv, insightsQuery, NO_FILTERS, rangeProblem, type AdmissionInsights } from './insights';

const VIEW = 'adm.admission_insights.view';

function fixture(over: Partial<AdmissionInsights> = {}): AdmissionInsights {
  return {
    asOf: '2026-11-23T10:00:00Z',
    trendFrom: '2026-09',
    trendTo: '2026-11',
    enquiries: {
      total: 1250,
      byStatus: { new: 400, contacted: 300, visit_scheduled: 150, converted: 300, closed: 100 },
      bySource: { walk_in: 500, phone: 250, website: 200, referral: 150, social: 100, other: 50 },
    },
    followUps: { due: 12, dueToday: 5, overdue: 7 },
    registrations: { total: 480, byStatus: { submitted: 100, under_review: 80, accepted: 240, rejected: 40, withdrawn: 20 } },
    conversion: {
      enquiryToRegistration: { of: 1250, converted: 400, rate: 0.32 },
      registrationToAccepted: { of: 480, converted: 240, rate: 0.5 },
      acceptedToAdmitted: null,
    },
    trend: [
      { month: '2026-09', enquiries: 100, registrations: 30 },
      { month: '2026-10', enquiries: 150, registrations: 60 },
      { month: '2026-11', enquiries: 0, registrations: 0 },
    ],
    ...over,
  };
}

function mount(path: string, permissions: string[], data: AdmissionInsights | (() => Response) = fixture()) {
  const calls: string[] = [];
  const json = (status: number, body: unknown, h: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...h } });
  const fetchFn = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://x');
    const p = url.pathname.replace('/api/v1', '');
    if (p === '/auth/refresh') return json(200, { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 9e5).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 9e8).toISOString(), mustChangePassword: false });
    if (p === '/me/access')
      return json(200, {
        user: { id: 'u1', name: 'Asha', tier: 'tenant' }, tenant: { id: 't1', name: 'School', brand: { primary: '#2F5BFF' }, modules: ['adm'] },
        permissions, scopes: {}, fieldMasks: {},
        workspace: { home: 'x', navigation: [{ screenId: 'home', label: 'Home', order: 1 }, { screenId: 'admission_insights', label: 'Admission insights', order: 39 }] },
        mobile: { tabs: [], features: [] }, approvals: { canApprove: [] }, version: 1,
      }, { 'X-Access-Version': '1' });
    if (p === '/classes') return json(200, { items: [{ id: 'c1', name: 'Class 5' }, { id: 'c2', name: 'Class 6' }], page: { number: 1, size: 200, total: 2 } });
    if (p === '/academic-years') return json(200, { items: [{ id: 'y1', name: '2027-28' }], page: { number: 1, size: 200, total: 1 } });
    if (p === '/enquiries' || p === '/student-registrations') {
      calls.push(`${p}${url.search}`);
      return json(200, { items: [], page: { number: 1, size: 25, total: 0 } });
    }
    if (p === '/admission-insights') {
      calls.push(url.search);
      return typeof data === 'function' ? data() : json(200, data);
    }
    return json(404, {});
  }) as typeof fetch;
  render(
    <MemoryRouter initialEntries={[path]}>
      <ShellApp session={createWebSession(fetchFn)} />
    </MemoryRouter>,
  );
  return { calls };
}

const PERMS = [VIEW, 'adm.enquiry.view', 'adm.student_registrations.view'];

describe('insights helpers', () => {
  it('formats counts the Indian way and a missing rate as a dash', () => {
    expect(formatCount(1234567)).toBe('12,34,567');
    expect(formatRate(0.32)).toBe('32%');
    expect(formatRate(0.4567)).toBe('45.7%');
    expect(formatRate(0)).toBe('0%');
    expect(formatRate(null)).toBe('—');
  });

  it('builds the query from set filters only, and flags an end date before the start', () => {
    expect(insightsQuery(NO_FILTERS)).toBe('');
    expect(insightsQuery({ yearId: 'y1', classId: '', from: '2026-04-01', to: 'bad' })).toBe('yearId=y1&from=2026-04-01');
    expect(rangeProblem({ ...NO_FILTERS, from: '2026-05-01', to: '2026-04-01' })).toMatch(/before/);
    expect(rangeProblem({ ...NO_FILTERS, from: '2026-04-01', to: '2026-04-01' })).toBe('');
  });

  it('builds list links, passing on only the filters the lists understand', () => {
    expect(drillHref('enquiries', NO_FILTERS, { status: 'new' })).toBe('/enquiries?status=new');
    expect(drillHref('enquiries', { yearId: 'y1', classId: 'c1', from: '2026-01-01', to: '' }, { followUpDue: 'true' })).toBe('/enquiries?followUpDue=true&classId=c1');
    expect(drillHref('registrations', { yearId: 'y1', classId: 'c1', from: '', to: '' }, { status: 'accepted' })).toBe('/registrations?status=accepted&classId=c1&yearId=y1');
    expect(drillHref('registrations', NO_FILTERS)).toBe('/registrations');
  });

  it('writes the figures as CSV, leaving a missing rate empty', () => {
    const csv = insightsCsv(fixture({ conversion: { ...fixture().conversion, registrationToAccepted: { of: 0, converted: 0, rate: null } } }), NO_FILTERS, { year: '2027-28, spring' });
    expect(csv).toContain('Enquiries,Total,1250');
    expect(csv).toContain('Report,Academic year,"2027-28, spring"');
    expect(csv).toContain('Conversion,Enquiry to registration,32%');
    expect(csv).toContain('Conversion,Registration to accepted,\n');
    expect(csv).toContain('Monthly trend,Oct 2026: registrations,60');
  });
});

describe('admission insights page', () => {
  it('shows the key figures, the funnel and the Admitted placeholder without a number', async () => {
    mount('/admission-insights', PERMS);
    const kpis = await screen.findByRole('list', { name: 'Key figures' });
    expect(within(kpis).getByText('1,250')).toBeInTheDocument();
    expect(within(kpis).getByText('480')).toBeInTheDocument();
    expect(within(kpis).getByText('240')).toBeInTheDocument();
    expect(within(kpis).getByText('32%')).toBeInTheDocument();
    const funnel = screen.getByRole('region', { name: 'From enquiry to a place' });
    expect(within(funnel).getByText('400 of 1,250 enquiries have a registration')).toBeInTheDocument();
    const admitted = screen.getByTestId('funnel-admitted');
    expect(admitted).toHaveTextContent('Admitted');
    expect(admitted).toHaveTextContent('Nothing is counted here yet');
    expect(admitted.textContent).not.toMatch(/\d/);
  });

  it('shows a dash when a rate is null', async () => {
    mount('/admission-insights', PERMS, fixture({
      enquiries: { ...fixture().enquiries, total: 0 },
      conversion: { enquiryToRegistration: { of: 0, converted: 0, rate: null }, registrationToAccepted: { of: 480, converted: 240, rate: 0.5 }, acceptedToAdmitted: null },
    }));
    const kpis = await screen.findByRole('list', { name: 'Key figures' });
    expect(within(kpis).getByText('—')).toBeInTheDocument();
    expect(within(kpis).getByText('No enquiries to measure yet')).toBeInTheDocument();
  });

  it('has the monthly trend as a table in the page, and the toggle shows it', async () => {
    mount('/admission-insights', PERMS);
    const table = await screen.findByRole('table', { name: 'Enquiries and registrations for each month' });
    expect(within(table).getByRole('row', { name: /Oct 2026 150 60/ })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Monthly enquiries and registrations from Sep 2026 to Nov 2026/ })).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Show as a table' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Hide the table' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('links each figure to the list behind it', async () => {
    mount('/admission-insights', PERMS);
    await screen.findByRole('list', { name: 'Key figures' });
    expect(screen.getByRole('link', { name: 'Enquiries, open the list' })).toHaveAttribute('href', '/enquiries');
    expect(screen.getByRole('link', { name: 'Accepted, open the list' })).toHaveAttribute('href', '/registrations?status=accepted');
    expect(screen.getByRole('link', { name: 'Referral enquiries, open the list' })).toHaveAttribute('href', '/enquiries?source=referral');
    expect(screen.getByRole('link', { name: 'Visit scheduled enquiries, open the list' })).toHaveAttribute('href', '/enquiries?status=visit_scheduled');
    expect(screen.getByRole('link', { name: 'Under review registrations, open the list' })).toHaveAttribute('href', '/registrations?status=under_review');
    expect(screen.getByRole('link', { name: /See these enquiries/ })).toHaveAttribute('href', '/enquiries?followUpDue=true');
    expect(screen.getByText('7 overdue, 5 due today.')).toBeInTheDocument();
  });

  it('leaves out links to lists the person may not open', async () => {
    mount('/admission-insights', [VIEW]);
    await screen.findByRole('list', { name: 'Key figures' });
    expect(screen.queryByRole('link', { name: /open the list/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /See these enquiries/ })).not.toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Key figures' })).getByText('1,250')).toBeInTheDocument();
  });

  it('passes the year, class and dates to the server and clears them again', async () => {
    const server = mount('/admission-insights', PERMS);
    await screen.findByRole('list', { name: 'Key figures' });
    expect(server.calls[0]).toBe('');
    await screen.findByRole('option', { name: 'Class 5' });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Class' }), 'c1');
    await waitFor(() => expect(server.calls).toContain('?classId=c1'));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Academic year' }), 'y1');
    await waitFor(() => expect(server.calls).toContain('?yearId=y1&classId=c1'));
    await userEvent.type(screen.getByLabelText('From'), '2026-04-01');
    await waitFor(() => expect(server.calls).toContain('?yearId=y1&classId=c1&from=2026-04-01'));
    expect(await screen.findByRole('link', { name: 'Enquiries, open the list' })).toHaveAttribute('href', '/enquiries?classId=c1');
    expect(screen.getByText(/show every date/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(server.calls[server.calls.length - 1]).toBe(''));
  });

  it('does not ask the server for an end date before the start date', async () => {
    const server = mount('/admission-insights', PERMS);
    await screen.findByRole('list', { name: 'Key figures' });
    await userEvent.type(screen.getByLabelText('From'), '2026-05-01');
    await waitFor(() => expect(server.calls).toContain('?from=2026-05-01'));
    const before = server.calls.length;
    await userEvent.type(screen.getByLabelText('To'), '2026-04-01');
    expect(await screen.findByText('The end date is before the start date.')).toBeInTheDocument();
    expect(server.calls.length).toBe(before);
  });

  it('says so when nothing has been recorded', async () => {
    mount('/admission-insights', PERMS, fixture({
      enquiries: { total: 0, byStatus: { new: 0, contacted: 0, visit_scheduled: 0, converted: 0, closed: 0 }, bySource: { walk_in: 0, phone: 0, website: 0, referral: 0, social: 0, other: 0 } },
      registrations: { total: 0, byStatus: { submitted: 0, under_review: 0, accepted: 0, rejected: 0, withdrawn: 0 } },
    }));
    expect(await screen.findByText('No enquiries or registrations here yet')).toBeInTheDocument();
  });

  it('shows an error with Try again', async () => {
    let fail = true;
    mount('/admission-insights', PERMS, () =>
      fail ? new Response(JSON.stringify({ code: 'boom', detail: 'The server is busy.' }), { status: 500, headers: { 'Content-Type': 'application/json' } }) : new Response(JSON.stringify(fixture()), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent('The server is busy.');
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: /Try again/ }));
    expect(await screen.findByRole('list', { name: 'Key figures' })).toBeInTheDocument();
  });

  it('is not available without the permission', async () => {
    const server = mount('/admission-insights', ['adm.enquiry.view']);
    expect(await screen.findByRole('alert')).toHaveTextContent('Not available');
    expect(server.calls).toHaveLength(0);
  });
});

describe('lists opened from the dashboard', () => {
  it('read their filters from the address', async () => {
    const server = mount('/enquiries?status=new&followUpDue=true&bogus=1', ['adm.enquiry.view']);
    await waitFor(() => expect(server.calls.some((c) => c.startsWith('/enquiries?'))).toBe(true));
    const call = server.calls.find((c) => c.startsWith('/enquiries?'))!;
    expect(call).toContain('status=new');
    expect(call).toContain('followUpDue=true');
    expect(call).not.toContain('bogus');
  });
});
