// UI review: screenshots of the key screens at desktop and phone width, plus an axe accessibility check of each.
// Runs against the dev server with the API mocked in the browser, so no backend is needed.
//
//   npm run dev -- --port 5179 &   then   npm run ui:review
//
// Writes PNGs and axe-report.json to ui-review/ (git-ignored). Exits 1 when axe finds a serious or critical issue.
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const BASE = process.env.UI_BASE ?? 'http://localhost:5179';
const OUT = process.env.UI_OUT ?? 'ui-review';
mkdirSync(OUT, { recursive: true });

const nav = [
  { screenId: 'home', label: 'Home', order: 1 },
  { screenId: 'onboarding', label: 'Onboarding', order: 2 },
  { screenId: 'academic_years', label: 'Academic years', order: 21 },
  { screenId: 'classes', label: 'Classes', order: 23 },
  { screenId: 'students', label: 'Students', order: 40 },
  { screenId: 'guardians', label: 'Guardians', order: 42 },
  { screenId: 'users', label: 'Users', order: 61 },
  { screenId: 'profile', label: 'Profile', order: 90 },
];
const permissions = ['onb.workspace.view', 'aca.academic_years.view', 'aca.classes.view', 'stu.students.view', 'stu.students.create', 'stu.students.edit', 'stu.students.delete', 'iam.users.view', 'iam.users.create', 'iam.users.edit'];
const students = [
  { id: '1', registrationCode: 'R-0001', firstName: 'Asha', fullName: 'Asha Rao', gender: 'female', dateOfBirth: '2015-06-01', status: 'active', currentClassName: 'Class 5', currentSectionName: 'A', currentRollNumber: '1' },
  { id: '2', registrationCode: 'R-0002', firstName: 'Kabir', fullName: 'Kabir Mehta', gender: 'male', dateOfBirth: '2015-02-11', status: 'active', currentClassName: 'Class 5', currentSectionName: 'A', currentRollNumber: '2' },
  { id: '3', registrationCode: 'R-0003', firstName: 'Meera', fullName: 'Meera Iyer', gender: 'female', dateOfBirth: '2014-11-23', status: 'paused', currentClassName: 'Class 5', currentSectionName: 'B', currentRollNumber: null },
];
const users = [
  { id: 'u1', username: 'asha.verma', displayName: 'Asha Verma', email: 'asha@springfield.edu.in', phone: null, status: 'active', lockedUntil: null, lastLoginAt: '2026-11-20T09:12:00Z' },
  { id: 'u2', username: 'r.nair', displayName: 'Ravi Nair', email: 'ravi@springfield.edu.in', phone: null, status: 'invited', lockedUntil: null, lastLoginAt: null },
  { id: 'u3', username: 'p.sharma', displayName: 'Priya Sharma', email: null, phone: '9876543210', status: 'locked', lockedUntil: null, lastLoginAt: '2026-10-02T07:40:00Z' },
  { id: 'u4', username: 'k.das', displayName: 'Kunal Das', email: null, phone: null, status: 'disabled', lockedUntil: null, lastLoginAt: '2026-06-14T11:05:00Z' },
];

async function mockApi(page, signedIn) {
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers: { 'X-Access-Version': '1' } });
    const tokens = { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 9e5).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 9e8).toISOString(), mustChangePassword: false };
    if (path === '/auth/refresh') return signedIn ? json(200, tokens) : json(400, { code: 'validation_failed' });
    if (path === '/auth/login') return json(401, { code: 'invalid_credentials', detail: 'Incorrect username or password.' });
    if (path === '/me/access')
      return json(200, { user: { id: 'u1', name: 'Asha Verma', tier: 'tenant' }, tenant: { id: 't1', name: 'Springfield Public School', brand: { primary: '#1F3A5F' }, modules: ['onb', 'aca', 'stu', 'iam'] }, permissions, scopes: {}, fieldMasks: {}, workspace: { home: 'admin', navigation: nav }, mobile: { tabs: [], features: [] }, approvals: { canApprove: [] }, version: 1 });
    if (path === '/users' && route.request().method() === 'POST') return json(201, { ...users[1], id: 'u9', inviteLink: '/accept-invite?token=3f9c2a7be1d04c5a8e6b9f0d2c4a7e1b3f9c2a7be1d04c5a8e6b9f0d2c4a7e1b' });
    if (path === '/users') return json(200, { items: users, page: { number: 1, size: 25, total: users.length } });
    if (path === '/students') return json(200, { items: students, page: { number: 1, size: 25, total: students.length } });
    return json(200, { items: [], page: { number: 1, size: 25, total: 0 } });
  });
}

const screens = [
  { name: 'signin', path: '/', signedIn: false, ready: 'text=Sign in' },
  { name: 'home', path: '/', signedIn: true, ready: 'text=Welcome, Asha Verma' },
  { name: 'students', path: '/students', signedIn: true, ready: 'text=Kabir Mehta' },
  { name: 'students-add', path: '/students', signedIn: true, ready: 'text=Kabir Mehta', then: (p) => p.getByRole('button', { name: 'Add student' }).click().then(() => p.waitForSelector('role=dialog')) },
  { name: 'users', path: '/users', signedIn: true, ready: 'text=Ravi Nair' },
  { name: 'users-invite-link', path: '/users', signedIn: true, ready: 'text=Ravi Nair', then: async (p) => { await p.getByRole('button', { name: 'Add user' }).click(); await p.getByLabel('Username').fill('r.nair2'); await p.getByLabel('Display name').fill('Ravi Nair'); await p.getByRole('button', { name: 'Add and get invite link' }).click(); await p.waitForSelector('[data-testid=one-time-link]'); } },
  { name: 'accept-invite', path: '/accept-invite?token=abc', signedIn: false, ready: 'text=Set your password' },
  { name: 'palette', path: '/', signedIn: true, ready: 'text=Welcome, Asha Verma', then: (p) => p.keyboard.press('Control+k').then(() => p.waitForSelector('role=dialog')) },
];
const sizes = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'phone', width: 390, height: 844 },
];

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const report = [];
let serious = 0;
for (const s of screens) {
  for (const size of sizes) {
    const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await mockApi(page, s.signedIn);
    await page.goto(BASE + s.path);
    await page.waitForSelector(s.ready);
    if (s.then) await s.then(page);
    await page.waitForTimeout(400);
    const file = `${OUT}/${s.name}-${size.name}.png`;
    await page.screenshot({ path: file });
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    const issues = axe.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length }));
    serious += issues.filter((i) => i.impact === 'serious' || i.impact === 'critical').length;
    report.push({ screen: s.name, size: size.name, file, issues });
    console.log(`${s.name}/${size.name}: ${issues.length ? issues.map((i) => `${i.impact} ${i.id} (${i.nodes})`).join(', ') : 'no accessibility issues'}`);
    await ctx.close();
  }
}
await browser.close();
writeFileSync(`${OUT}/axe-report.json`, JSON.stringify(report, null, 2));
console.log(`\n${report.length} screenshots in ${OUT}/. Serious or critical accessibility issues: ${serious}.`);
process.exit(serious > 0 ? 1 : 0);
