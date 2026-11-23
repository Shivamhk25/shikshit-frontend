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
  { screenId: 'enquiries', label: 'Enquiries', order: 35 },
  { screenId: 'enquiry_discussions', label: 'Enquiry discussions', order: 36 },
  { screenId: 'registrations', label: 'Registrations', order: 37 },
  { screenId: 'students', label: 'Students', order: 40 },
  { screenId: 'guardians', label: 'Guardians', order: 42 },
  { screenId: 'scope_assignments', label: 'Class assignments', order: 60 },
  { screenId: 'users', label: 'Users', order: 61 },
  { screenId: 'roles', label: 'Roles', order: 62 },
  { screenId: 'parent_links', label: 'Parent accounts', order: 63 },
  { screenId: 'appearance', label: 'Appearance', order: 64 },
  { screenId: 'approvals', label: 'Approvals', order: 70 },
  { screenId: 'profile', label: 'Profile', order: 90 },
];
const permissions = ['onb.workspace.view', 'aca.academic_years.view', 'aca.classes.view', 'adm.enquiry.view', 'adm.enquiry.create', 'adm.enquiry.edit', 'adm.enquiry.delete', 'adm.enquiry_discussions.view', 'adm.enquiry_discussions.create', 'adm.enquiry_discussions.edit', 'adm.enquiry_discussions.delete', 'stu.students.view', 'stu.students.create', 'stu.students.edit', 'stu.students.delete', 'iam.users.view', 'iam.users.create', 'iam.users.edit', 'iam.scope_assignments.view', 'iam.scope_assignments.edit', 'iam.roles.view', 'iam.roles.create', 'iam.roles.edit', 'iam.roles.delete', 'iam.parent_links.view', 'iam.parent_links.create', 'iam.parent_links.edit', 'iam.parent_links.delete', 'iam.appearance.view', 'iam.appearance.manage', 'adm.student_registrations.view', 'adm.student_registrations.create', 'adm.student_registrations.edit', 'adm.student_registrations.delete'];
const students = [
  { id: '1', registrationCode: 'R-0001', firstName: 'Asha', fullName: 'Asha Rao', gender: 'female', dateOfBirth: '2015-06-01', status: 'active', currentClassName: 'Class 5', currentSectionName: 'A', currentRollNumber: '1' },
  { id: '2', registrationCode: 'R-0002', firstName: 'Kabir', fullName: 'Kabir Mehta', gender: 'male', dateOfBirth: '2015-02-11', status: 'active', currentClassName: 'Class 5', currentSectionName: 'A', currentRollNumber: '2' },
  { id: '3', registrationCode: 'R-0003', firstName: 'Meera', fullName: 'Meera Iyer', gender: 'female', dateOfBirth: '2014-11-23', status: 'paused', currentClassName: 'Class 5', currentSectionName: 'B', currentRollNumber: null },
];
const enquiry = (id, o) => ({ id, code: `ENQ-${id}`, enquirerName: 'Sunil Kumar', phone: '9810012345', email: null, childName: 'Anaya Kumar', dateOfBirth: '2021-03-14', classId: 'c1', classCode: 'NUR', className: 'Nursery', yearId: 'y1', yearName: '2027-28', source: 'walk_in', status: 'new', followUpDate: null, followUpDue: false, notes: null, assignedToId: null, assignedToName: null, createdAt: '2026-11-18T00:00:00Z', updatedAt: '2026-11-18T00:00:00Z', ...o });
const enquiries = [
  enquiry('101', { followUpDate: '2026-11-20', followUpDue: true, assignedToId: 'u2', assignedToName: 'Ravi Nair', status: 'contacted' }),
  enquiry('102', { enquirerName: 'Neha Verma', childName: 'Ishaan Verma', className: 'Class 1', source: 'website', status: 'visit_scheduled', followUpDate: '2026-12-02', assignedToId: 'u1', assignedToName: 'Asha Verma' }),
  enquiry('103', { enquirerName: 'Rahul Singh', childName: 'Diya Singh', className: 'UKG', source: 'referral', status: 'converted' }),
  enquiry('104', { enquirerName: 'Meena Iyer', childName: 'Kabir Iyer', className: null, source: 'social', status: 'closed' }),
  enquiry('105', { enquirerName: 'Priya Sharma', childName: 'Aarav Sharma', className: 'Class 3', source: 'phone', phone: '9822234567' }),
];
const discussion = (id, o) => ({ id, enquiryId: '101', enquiryCode: 'ENQ-000101', enquiryChildName: 'Anaya Kumar', contactedAt: '2026-11-20T09:00:00Z', channel: 'call', summary: 'Asked about the fee for Nursery', notes: null, outcome: 'interested', nextFollowUpDate: null, language: 'hi', loggedById: 'u1', loggedByName: 'Asha Verma', createdAt: '2026-11-20T09:05:00Z', updatedAt: '2026-11-20T09:05:00Z', ...o });
const discussions = [
  discussion('d1', { contactedAt: '2026-11-22T11:15:00Z', channel: 'visit', summary: 'Visited the campus with both parents', notes: 'Liked the activity room. Wants to know about the school bus route from Sector 14.', outcome: 'visit_scheduled', language: 'en', nextFollowUpDate: '2026-11-29' }),
  discussion('d2', { contactedAt: '2026-11-20T09:00:00Z' }),
  discussion('d3', { enquiryId: '102', enquiryCode: 'ENQ-000102', enquiryChildName: 'Ishaan Verma', contactedAt: '2026-11-19T14:40:00Z', channel: 'whatsapp', summary: 'Sent the fee structure and prospectus', outcome: 'call_back_later', language: 'mr', loggedByName: 'Ravi Nair', nextFollowUpDate: '2026-12-02' }),
  discussion('d4', { enquiryId: '104', enquiryCode: 'ENQ-000104', enquiryChildName: 'Kabir Iyer', contactedAt: '2026-11-18T05:30:00Z', channel: 'call', summary: 'Phone was switched off', outcome: 'not_reachable', language: 'ta', loggedByName: 'Ravi Nair' }),
];
const registration = (n, o) => ({ id: `r${n}`, applicationNumber: `REG-0000${n}`, appliedOn: '2026-11-16', firstName: 'Anaya', middleName: null, lastName: 'Kumar', fullName: 'Anaya Kumar', dateOfBirth: '2021-03-14', gender: 'female', fatherName: 'Sunil Kumar', motherName: null, guardianName: null, guardianPhone: '9810012345', siblingStudentCode: null, classId: 'c1', classCode: 'NUR', className: 'Nursery', sectionId: null, sectionName: null, yearId: 'y1', yearName: '2027-28', status: 'submitted', enquiryId: null, enquiryCode: null, createdAt: '2026-11-16T00:00:00Z', updatedAt: '2026-11-16T00:00:00Z', ...o });
const registrations = [
  registration(41, {}),
  registration(42, { firstName: 'Ishaan', lastName: 'Verma', fullName: 'Ishaan Verma', gender: 'male', className: 'Class 1', sectionName: 'A', status: 'under_review', appliedOn: '2026-11-14', enquiryCode: 'ENQ-102' }),
  registration(43, { firstName: 'Diya', lastName: 'Singh', fullName: 'Diya Singh', className: 'UKG', status: 'accepted', appliedOn: '2026-11-12' }),
  registration(44, { firstName: 'Kabir', lastName: 'Iyer', fullName: 'Kabir Iyer', gender: null, className: 'Class 3', status: 'rejected', appliedOn: '2026-11-09' }),
  registration(45, { firstName: 'Aarav', lastName: 'Sharma', fullName: 'Aarav Sharma', gender: 'male', status: 'withdrawn', appliedOn: '2026-11-03' }),
];
const users = [
  { id: 'u1', username: 'asha.verma', displayName: 'Asha Verma', email: 'asha@springfield.edu.in', phone: null, status: 'active', lockedUntil: null, lastLoginAt: '2026-11-20T09:12:00Z' },
  { id: 'u2', username: 'r.nair', displayName: 'Ravi Nair', email: 'ravi@springfield.edu.in', phone: null, status: 'invited', lockedUntil: null, lastLoginAt: null },
  { id: 'u3', username: 'p.sharma', displayName: 'Priya Sharma', email: null, phone: '9876543210', status: 'locked', lockedUntil: null, lastLoginAt: '2026-10-02T07:40:00Z' },
  { id: 'u4', username: 'k.das', displayName: 'Kunal Das', email: null, phone: null, status: 'disabled', lockedUntil: null, lastLoginAt: '2026-06-14T11:05:00Z' },
];
const catalog = [
  ...['view', 'create', 'edit', 'delete', 'export'].map((a) => ({ code: `iam.users.${a}`, module: 'iam', resource: 'users', action: a, sensitive: false })),
  ...['view', 'create', 'edit', 'delete'].map((a) => ({ code: `iam.roles.${a}`, module: 'iam', resource: 'roles', action: a, sensitive: false })),
  ...['view', 'edit'].map((a) => ({ code: `iam.scope_assignments.${a}`, module: 'iam', resource: 'scope_assignments', action: a, sensitive: false })),
  ...['view', 'create', 'edit', 'delete', 'export'].map((a) => ({ code: `stu.students.${a}`, module: 'stu', resource: 'students', action: a, sensitive: true })),
  ...['view', 'create', 'edit', 'delete'].map((a) => ({ code: `stu.student_addresses.${a}`, module: 'stu', resource: 'student_addresses', action: a, sensitive: true })),
  ...['view', 'create', 'edit', 'delete'].map((a) => ({ code: `stu.student_documents.${a}`, module: 'stu', resource: 'student_documents', action: a, sensitive: true })),
];
const roles = [
  { id: 'r1', code: 'admin', name: 'Admin', description: 'Full visibility and management inside the institute.', isSystem: true, holderCount: 2, permissionCount: 27, updatedAt: '2026-11-01T00:00:00Z' },
  { id: 'r2', code: 'teacher', name: 'Teacher', description: 'Their own class sections.', isSystem: true, holderCount: 38, permissionCount: 6, updatedAt: '2026-11-01T00:00:00Z' },
  { id: 'r3', code: 'front_office', name: 'Front office', description: 'Admissions desk and student records.', isSystem: false, holderCount: 3, permissionCount: 9, updatedAt: '2026-11-18T00:00:00Z' },
];
const frontOffice = { ...roles[2], grants: [{ permission: 'stu.students.view', scope: 'tenant' }, { permission: 'stu.students.create', scope: 'tenant' }, { permission: 'stu.students.edit', scope: 'tenant' }, { permission: 'stu.student_addresses.view', scope: 'tenant' }, { permission: 'iam.users.view', scope: 'tenant' }] };

const platformPlans = [
  { code: 'standard', name: 'Standard', modules: ['iam', 'wfl', 'onb', 'aca', 'adm', 'stu', 'fee', 'att', 'exm', 'asg', 'crt', 'slf', 'stf', 'com', 'dsh', 'rpt'] },
  { code: 'premium', name: 'Premium', modules: ['iam', 'wfl', 'onb', 'aca', 'adm', 'stu', 'fee', 'att', 'exm', 'asg', 'crt', 'slf', 'stf', 'com', 'dsh', 'rpt', 'lrn', 'lib', 'trn', 'hrp', 'inv'] },
  { code: 'enterprise', name: 'Enterprise', modules: ['iam', 'wfl', 'onb', 'aca', 'adm', 'stu', 'fee', 'att', 'exm', 'asg', 'crt', 'slf', 'stf', 'com', 'dsh', 'rpt', 'lrn', 'lib', 'trn', 'hrp', 'inv', 'aia'] },
];
const platformInstitutes = [
  { id: 'i1', code: 'springfield', name: 'Springfield Public School', status: 'live', planCode: 'premium', planName: 'Premium', modules: ['iam', 'onb', 'aca', 'adm', 'stu', 'fee', 'att', 'exm', 'lib', 'trn'], createdAt: '2026-06-02T00:00:00Z', wentLiveAt: '2026-07-01T00:00:00Z' },
  { id: 'i2', code: 'gurukul-pune', name: 'Gurukul Vidyalaya, Pune', status: 'onboarding', planCode: 'standard', planName: 'Standard', modules: ['iam', 'onb', 'aca', 'stu'], createdAt: '2026-11-18T00:00:00Z', wentLiveAt: null },
  { id: 'i3', code: 'st-marys-convent', name: "St. Mary's Convent School", status: 'suspended', planCode: 'standard', planName: 'Standard', modules: ['iam', 'aca', 'stu', 'fee'], createdAt: '2026-03-11T00:00:00Z', wentLiveAt: '2026-04-01T00:00:00Z' },
];
const parentAccounts = [
  { userId: 'p1', username: 'sunil.kumar', displayName: 'Sunil Kumar', status: 'active', guardianId: 'g1', guardianName: 'Sunil Kumar', guardianPhone: '9810012345', children: [
    { linkId: 'l1', studentId: 's1', studentName: 'Kabir Kumar', registrationCode: 'SPS-2041', relation: 'father', noAccess: false },
    { linkId: 'l2', studentId: 's2', studentName: 'Anaya Kumar', registrationCode: 'SPS-2213', relation: 'father', noAccess: false },
  ] },
  { userId: 'p2', username: 'neha.verma', displayName: 'Neha Verma', status: 'invited', guardianId: 'g2', guardianName: 'Neha Verma', guardianPhone: '9822234567', children: [
    { linkId: 'l3', studentId: 's3', studentName: 'Ishaan Verma', registrationCode: 'SPS-1987', relation: 'mother', noAccess: false },
  ] },
  { userId: 'p3', username: 'rahul.s', displayName: 'Rahul Singh', status: 'active', guardianId: 'g3', guardianName: 'Rahul Singh', guardianPhone: '9833345678', children: [
    { linkId: 'l4', studentId: 's4', studentName: 'Diya Singh', registrationCode: 'SPS-2102', relation: 'father', noAccess: true },
  ] },
];

const ago = (mins) => new Date(Date.now() - mins * 60_000).toISOString();
const notifications = [
  { id: 'n1', kind: 'user.password_reset', title: 'Your password was reset', body: 'An administrator reset your password. Sign in again with the new one-time link.', link: '/profile', createdAt: ago(4), readAt: null },
  { id: 'n2', kind: 'user.invited', title: 'Ravi Nair accepted the invitation', body: 'Ravi Nair set a password and can now sign in to Springfield Public School.', link: '/users', createdAt: ago(95), readAt: null },
  { id: 'n3', kind: 'import.finished', title: 'Student import finished', body: '118 students were added and 2 rows need a look. Download the list of rows that were skipped.', link: null, createdAt: ago(60 * 26), readAt: null },
  { id: 'n4', kind: 'user.locked', title: 'An account was locked', body: 'Priya Sharma was locked after five wrong passwords.', link: '/users', createdAt: ago(60 * 24 * 4), readAt: ago(60 * 24 * 3) },
];

let approvalsEmpty = false;
let handoverDenied = false;
const approval = (id, o) => ({ id, typeKey: 'fee.concession', typeTitle: 'Fee concession', subjectId: 's1', summary: '', amount: null, requesterId: 'u9', requesterName: 'Ravi Nair', status: 'pending', currentStep: 2, stepCount: 3, stepName: 'Principal', createdAt: ago(60 * 50), decidedAt: null, ...o });
const approvalInbox = [
  approval('ap1', { summary: 'Sibling concession for Kabir Kumar, Class 5 A, term 2', amount: 12500 }),
  approval('ap2', { typeKey: 'student.transfer', typeTitle: 'Transfer certificate', summary: 'Ishaan Verma, Class 8 B: family relocating to Pune', currentStep: 1, stepName: 'Registrar', requesterName: 'Neha Verma', createdAt: ago(60 * 5) }),
  approval('ap7', { typeTitle: 'Fee concession', summary: 'Sibling concession for Aarav Joshi, Class 2 B', amount: 8000, currentStep: 2, stepName: 'Principal', requesterName: 'Neha Verma', createdAt: ago(60 * 3), delegatedFromId: 'u8', delegatedFromName: 'Dr. Sunita Iyer' }),
  approval('ap3', { typeKey: 'fee.waiver', typeTitle: 'Late fee waiver', summary: 'Diya Singh, Class 3 A: bank holiday delayed the payment', amount: 600, currentStep: 1, stepCount: 2, stepName: 'Accountant', requesterName: 'Priya Sharma', createdAt: ago(25) }),
];
const approvalMine = [
  approval('ap4', { summary: 'Hardship concession for Anaya Kumar', amount: 18000, currentStep: 1, stepName: 'Accountant', requesterName: 'Asha Verma' }),
  approval('ap5', { typeTitle: 'Late fee waiver', summary: 'Meera Iyer, Class 5 B', amount: 450, status: 'approved', currentStep: 2, stepCount: 2, stepName: 'Principal', requesterName: 'Asha Verma', createdAt: ago(60 * 24 * 9), decidedAt: ago(60 * 24 * 7) }),
  approval('ap6', { summary: 'Concession for Rahul Mehta', amount: 9000, status: 'rejected', currentStep: 1, stepName: 'Accountant', requesterName: 'Asha Verma', createdAt: ago(60 * 24 * 20), decidedAt: ago(60 * 24 * 18) }),
];
const ahead = (ms) => new Date(Date.now() + ms).toISOString();
const handoverBase = { delegatorId: 'u1', delegatorName: 'Asha Verma', delegateId: 'u5', delegateName: 'Kavita Rao', typeKeys: null, endedAt: null, createdAt: ago(60 * 24 * 2), reason: '' };
const handoversGiven = [
  { ...handoverBase, id: 'd1', startsAt: ago(60 * 24 * 2), endsAt: ahead(5 * 864e5), reason: 'Away at a conference in Hyderabad', status: 'active' },
  { ...handoverBase, id: 'd2', delegateName: 'Meena Das', startsAt: ago(60 * 24 * 40), endsAt: ago(60 * 24 * 30), typeKeys: ['fee.concession', 'fee.waiver'], status: 'expired', reason: 'Medical leave' },
  { ...handoverBase, id: 'd3', delegateName: 'Sunil Bose', startsAt: ago(60 * 24 * 20), endsAt: ago(60 * 24 * 10), endedAt: ago(60 * 24 * 18), status: 'ended' },
];
const handoversReceived = [
  { ...handoverBase, id: 'r1', delegatorId: 'u8', delegatorName: 'Dr. Sunita Iyer', delegateId: 'u1', delegateName: 'Asha Verma', startsAt: ago(60 * 24), endsAt: ahead(6 * 864e5), reason: 'Leave until the 30th', status: 'active' },
];
const approvalDetail = {
  ...approvalInbox[0], canDecide: true, canCancel: false,
  steps: [
    { step: 1, name: 'Accountant', status: 'approved', decidedBy: 'Meera Iyer', decidedAt: ago(60 * 40) },
    { step: 2, name: 'Principal', status: 'pending', decidedBy: null, decidedAt: null },
    { step: 3, name: 'Chairperson', status: 'pending', decidedBy: null, decidedAt: null },
  ],
  events: [
    { step: null, actorId: 'u9', actorName: 'Ravi Nair', action: 'submitted', comment: 'Single parent with two children in the school. Income certificate attached to the fee record.', createdAt: ago(60 * 50) },
    { step: 1, actorId: 'u3', actorName: 'Meera Iyer', action: 'approved', comment: 'Documents checked and found in order.', createdAt: ago(60 * 40) },
    { step: 1, actorId: 'u5', actorName: 'Kavita Rao', action: 'approved', comment: 'Second check done while Dr. Iyer is away.', createdAt: ago(60 * 30), onBehalfOfId: 'u8', onBehalfOfName: 'Dr. Sunita Iyer' },
  ],
};

async function mockApi(page, signedIn, mfa) {
  await page.route('**/api/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    const json = (status, body) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body), headers: { 'X-Access-Version': '1' } });
    const tokens = { accessToken: 'a1', accessTokenExpiresAt: new Date(Date.now() + 9e5).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 9e8).toISOString(), mustChangePassword: false };
    if (path === '/auth/refresh') return signedIn ? json(200, tokens) : json(400, { code: 'validation_failed' });
    if (path === '/auth/login' && mfa) return json(202, { mfaRequired: mfa, challengeToken: 'ch-1', expiresAt: new Date(Date.now() + 6e5).toISOString() });
    if (path === '/auth/mfa/setup') return json(200, { secret: 'JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP', otpauthUri: 'otpauth://totp/Shikshit:asha.verma?secret=JBSWY3DPEHPK3PXP' });
    if (path === '/me/mfa') return json(200, { enabled: true, required: true, recoveryCodesLeft: 9 });
    if (path === '/auth/login') return json(401, { code: 'invalid_credentials', detail: 'Incorrect username or password.' });
    if (path === '/auth/support-visit') return json(200, { accessToken: 'visit1', accessTokenExpiresAt: new Date(Date.now() + 18e5).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 18e5).toISOString(), mustChangePassword: false });
    if (path === '/me/access' && route.request().headers()['authorization'] === 'Bearer visit1')
      return json(200, { user: { id: 'p1', name: 'Rohan Mehta', tier: 'tenant' }, tenant: { id: 't1', name: 'Springfield Public School', brand: { primary: '#1F3A5F' }, modules: ['onb', 'aca', 'stu', 'iam'] }, visit: { by: 'Rohan Mehta', reason: 'Fees report shows the wrong total for class 5', expiresAt: new Date(Date.now() + 18e5).toISOString() }, permissions: permissions.filter((p) => p.endsWith('.view')), scopes: {}, fieldMasks: {}, workspace: { home: 'admin', navigation: nav }, mobile: { tabs: [], features: [] }, approvals: { canApprove: [] }, version: 0 });
    if (path === '/me/access')
      return json(200, { user: { id: 'u1', name: 'Asha Verma', tier: 'tenant' }, tenant: { id: 't1', name: 'Springfield Public School', brand: { primary: '#1F3A5F' }, modules: ['onb', 'aca', 'adm', 'stu', 'iam', 'wfl'] }, permissions, scopes: {}, fieldMasks: {}, workspace: { home: 'admin', navigation: nav }, mobile: { tabs: [], features: [] }, approvals: { canApprove: [] }, version: 1 });
    if (path === '/me/notifications') return json(200, { items: notifications, page: { number: 1, size: 10, total: notifications.length }, unreadCount: 3 });
    if (path.startsWith('/me/notifications/')) return route.fulfill({ status: 204 });
    if (path === '/approvals') return json(200, { items: approvalsEmpty ? [] : approvalInbox, page: { number: 1, size: 20, total: approvalsEmpty ? 0 : approvalInbox.length } });
    if (path === '/approvals/mine') return json(200, { items: approvalsEmpty ? [] : approvalMine, page: { number: 1, size: 20, total: approvalsEmpty ? 0 : approvalMine.length } });
    if (path === '/approvals/delegations' && route.request().method() === 'POST') return handoverDenied ? json(403, { code: 'forbidden', detail: 'Not allowed.' }) : json(201, handoversGiven[0]);
    if (path === '/approvals/delegations') return json(200, { given: approvalsEmpty ? [] : handoversGiven, received: approvalsEmpty ? [] : handoversReceived });
    if (path.startsWith('/approvals/')) return json(200, approvalDetail);
    if (path === '/scope-assignments') return json(200, { items: [
      { id: 'a1', userId: 'u2', userName: 'Ravi Nair', scopeType: 'class_section', scopeRef: 'c1', label: 'Class 5 A (2026-27)', startsAt: '2026-06-01T00:00:00Z', endsAt: null, createdAt: '' },
      { id: 'a2', userId: 'u2', userName: 'Ravi Nair', scopeType: 'class_section', scopeRef: 'c2', label: 'Class 5 B (2026-27)', startsAt: '2026-06-01T00:00:00Z', endsAt: '2027-03-31T00:00:00Z', createdAt: '' },
      { id: 'a3', userId: 'u3', userName: 'Priya Sharma', scopeType: 'class_section', scopeRef: 'c3', label: 'Class 8 A (2026-27)', startsAt: '2026-06-01T00:00:00Z', endsAt: null, createdAt: '' },
    ] });
    if (path === '/platform/auth/refresh') return signedIn ? json(200, tokens) : json(400, { code: 'validation_failed' });
    if (path === '/platform/me') return json(200, { id: 'p1', email: 'ops@shikshit.app', name: 'Rohan Mehta' });
    if (path === '/platform/users') return json(200, { items: [
      { id: 'p1', email: 'ops@shikshit.app', name: 'Rohan Mehta', status: 'active', mfaEnabled: true, lastLoginAt: '2026-11-22T08:00:00Z', createdAt: '' },
      { id: 'p2', email: 'meera@shikshit.app', name: 'Meera Iyer', status: 'active', mfaEnabled: true, lastLoginAt: '2026-11-20T08:00:00Z', createdAt: '' },
      { id: 'p3', email: 'kabir@shikshit.app', name: 'Kabir Rao', status: 'invited', mfaEnabled: false, lastLoginAt: null, createdAt: '' },
      { id: 'p4', email: 'anita@shikshit.app', name: 'Anita Das', status: 'disabled', mfaEnabled: true, lastLoginAt: '2026-08-01T08:00:00Z', createdAt: '' },
    ] });
    if (path === '/platform/plans') return json(200, { items: platformPlans });
    if (path === '/platform/institutes' && route.request().method() === 'POST') return json(201, { ...platformInstitutes[1], id: 'n1', adminUsername: 'meena', adminInviteLink: '/accept-invite?token=3f9c2a7be1d04c5a8e6b9f0d2c4a7e1b3f9c2a7be1d04c5a8e6b9f0d2c4a7e1b' });
    if (path === '/platform/institutes') return json(200, { items: platformInstitutes, page: { number: 1, size: 25, total: platformInstitutes.length } });
    if (path.startsWith('/platform/institutes/')) return json(200, platformInstitutes[0]);
    if (path === '/institute/appearance') return json(200, { accent: '#1F3A5F', preset: 'classic' });
    if (path === '/me/preferences') return json(200, { themeMode: 'light' });
    if (path === '/parent-links') return json(200, { items: parentAccounts, page: { number: 1, size: 25, total: parentAccounts.length } });
    if (path === '/guardians') return json(200, { items: [{ id: 'g4', name: 'Meena Iyer', phone: '9811122233' }], page: { number: 1, size: 20, total: 1 } });
    if (path === '/permissions/catalog') return json(200, { items: catalog });
    if (path === '/roles') return json(200, { items: roles });
    if (path === '/roles/r3') return json(200, frontOffice);
    if (path === '/users' && route.request().method() === 'POST') return json(201, { ...users[1], id: 'u9', inviteLink: '/accept-invite?token=3f9c2a7be1d04c5a8e6b9f0d2c4a7e1b3f9c2a7be1d04c5a8e6b9f0d2c4a7e1b', email: 'ravi.nair@school.test', emailQueued: true });
    if (path === '/colleagues') return json(200, { items: [{ id: 'u1', displayName: 'Asha Verma', label: 'Principal' }, { id: 'u2', displayName: 'Ravi Nair', label: 'Teacher' }, { id: 'u5', displayName: 'Kavita Rao', label: 'Teacher, Head of Department' }, { id: 'u6', displayName: 'Priya Sharma', label: 'Registrar' }], page: { number: 1, size: 25, total: 4 } });
    if (path === '/users') return json(200, { items: users, page: { number: 1, size: 25, total: users.length } });
    if (path.endsWith('/photo') && path.startsWith('/students/')) return json(200, { url: 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><rect width="64" height="64" fill="#c9b79c"/><circle cx="32" cy="26" r="12" fill="#8a7458"/><rect x="12" y="42" width="40" height="22" rx="11" fill="#8a7458"/></svg>'), expiresAt: '' });
    if (path === '/enquiry-discussions') {
      const e = new URL(route.request().url()).searchParams.get('enquiryId');
      const items = e ? discussions.filter((d) => d.enquiryId === e) : discussions;
      return json(200, { items, page: { number: 1, size: 25, total: items.length } });
    }
    if (path === '/enquiries') return json(200, { items: enquiries, page: { number: 1, size: 25, total: enquiries.length } });
    if (path === '/student-registrations') return json(200, { items: registrations, page: { number: 1, size: 25, total: registrations.length } });
    if (path === '/classes') return json(200, { items: [{ id: 'c1', name: 'Nursery' }, { id: 'c2', name: 'Class 1' }], page: { number: 1, size: 200, total: 2 } });
    if (path === '/students') return json(200, { items: students, page: { number: 1, size: 25, total: students.length } });
    return json(200, { items: [], page: { number: 1, size: 25, total: 0 } });
  });
}

const screens = [
  { name: 'signin', path: '/', signedIn: false, ready: 'text=Sign in' },
  { name: 'home', path: '/', signedIn: true, ready: 'text=Welcome, Asha Verma' },
  { name: 'students', path: '/students', signedIn: true, ready: 'text=Kabir Mehta' },
  { name: 'students-add', path: '/students', signedIn: true, ready: 'text=Kabir Mehta', then: (p) => p.getByRole('button', { name: 'Add student' }).click().then(() => p.waitForSelector('role=dialog')) },
  { name: 'enquiries', path: '/enquiries', signedIn: true, ready: 'text=Ishaan Verma' },
  { name: 'enquiries-add', path: '/enquiries', signedIn: true, ready: 'text=Ishaan Verma', then: (p) => p.getByRole('button', { name: 'Add enquiry' }).click().then(() => p.waitForSelector('role=dialog')) },
  { name: 'enquiry-discussions', path: '/enquiry-discussions', signedIn: true, ready: 'text=Visited the campus with both parents' },
  { name: 'enquiry-discussions-add', path: '/enquiry-discussions', signedIn: true, ready: 'text=Visited the campus with both parents', then: (p) => p.getByRole('button', { name: 'Add discussion' }).click().then(() => p.waitForSelector('role=dialog')) },
  { name: 'enquiry-edit-notes', path: '/enquiries', signedIn: true, ready: 'text=Ishaan Verma', then: async (p) => { await p.getByRole('button', { name: /^Edit ENQ-101/ }).click(); await p.waitForSelector('text=Visited the campus with both parents'); } },
  { name: 'enquiry-log-contact', path: '/enquiries', signedIn: true, ready: 'text=Ishaan Verma', then: async (p) => { await p.getByRole('button', { name: /^Edit ENQ-101/ }).click(); await p.getByRole('button', { name: 'Log a contact' }).click(); await p.getByRole('dialog', { name: 'Log a contact' }).waitFor(); } },
  { name: 'registrations', path: '/registrations', signedIn: true, ready: 'text=Ishaan Verma' },
  { name: 'registrations-add', path: '/registrations', signedIn: true, ready: 'text=Ishaan Verma', then: (p) => p.getByRole('button', { name: 'Add registration' }).click().then(() => p.waitForSelector('role=dialog')) },
  { name: 'enquiries-register', path: '/enquiries', signedIn: true, ready: 'text=Ishaan Verma', then: (p) => p.getByRole('button', { name: /^Register ENQ-102/ }).click().then(() => p.waitForSelector('role=alertdialog')) },
  { name: 'users', path: '/users', signedIn: true, ready: 'text=Ravi Nair' },
  { name: 'users-invite-link', path: '/users', signedIn: true, ready: 'text=Ravi Nair', then: async (p) => { await p.getByRole('button', { name: 'Add user' }).click(); await p.getByLabel('Username').fill('r.nair2'); await p.getByLabel('Display name').fill('Ravi Nair'); await p.getByRole('button', { name: 'Add and get invite link' }).click(); await p.waitForSelector('[data-testid=one-time-link]'); } },
  { name: 'accept-invite', path: '/accept-invite?token=abc', signedIn: false, ready: 'text=Set your password' },
  { name: 'roles', path: '/roles', signedIn: true, ready: 'text=Front office' },
  { name: 'role-matrix', path: '/roles', signedIn: true, ready: 'text=Front office', then: async (p) => { await p.getByRole('button', { name: 'Edit Front office' }).click(); await p.waitForSelector('text=Who students reaches', { state: 'attached' }).catch(() => {}); await p.getByRole('checkbox', { name: 'Delete Students' }).click(); } },
  { name: 'mfa-verify', path: '/', signedIn: false, mfa: 'verify', ready: 'text=Sign in', then: async (p) => { await (async (p) => { await p.getByLabel('Username').fill('asha.verma'); await p.getByLabel('Password', { exact: true }).fill('a long password'); await p.getByRole('button', { name: 'Sign in' }).click(); await p.waitForSelector('#signin-title'); })(p); await p.waitForSelector('text=Enter your code'); } },
  { name: 'mfa-setup', path: '/', signedIn: false, mfa: 'setup', ready: 'text=Sign in', then: async (p) => { await (async (p) => { await p.getByLabel('Username').fill('asha.verma'); await p.getByLabel('Password', { exact: true }).fill('a long password'); await p.getByRole('button', { name: 'Sign in' }).click(); await p.waitForSelector('#signin-title'); })(p); await p.waitForSelector('text=Set up two-step sign-in'); } },
  { name: 'profile-mfa', path: '/profile', signedIn: true, ready: 'text=Two-step sign-in' },
  { name: 'class-assignments', path: '/class-assignments', signedIn: true, ready: 'text=Class 8 A (2026-27)' },
  { name: 'parent-accounts', path: '/parent-accounts', signedIn: true, ready: 'text=Kabir Kumar' },
  { name: 'parent-link-sheet', path: '/parent-accounts', signedIn: true, ready: 'text=Kabir Kumar', then: (p) => p.getByRole('button', { name: 'Link an account' }).click().then(() => p.waitForSelector('role=dialog')) },
  { name: 'appearance', path: '/appearance', signedIn: true, ready: 'text=Design style' },
  { name: 'appearance-modern-teal', path: '/appearance', signedIn: true, ready: 'text=Design style', then: async (p) => { await p.getByRole('radio', { name: /Modern/ }).click(); await p.getByRole('radio', { name: 'Teal' }).click(); } },
  { name: 'appearance-contrast-dark', path: '/profile', signedIn: true, ready: 'text=Light or dark', then: async (p) => { await p.getByRole('radio', { name: 'Dark' }).click(); } },
  { name: 'console-signin', path: '/console', signedIn: false, ready: 'text=Platform sign-in' },
  { name: 'console-institutes', path: '/console', signedIn: true, ready: 'text=Gurukul Vidyalaya, Pune' },
  { name: 'console-new', path: '/console/new', signedIn: true, ready: 'text=New institute', then: async (p) => { await p.getByLabel(/^School name/).fill('Delhi Public School, Dwarka'); } },
  { name: 'console-detail', path: '/console/institutes/i1', signedIn: true, ready: 'text=Save modules' },
  { name: 'support-visit-banner', path: '/support-visit?code=' + 'c'.repeat(64), signedIn: false, ready: 'text=Read-only support visit' },
  { name: 'support-visit-users', path: '/support-visit?code=' + 'c'.repeat(64), signedIn: false, ready: 'text=Read-only support visit', then: async (p) => { const menu = p.getByRole('button', { name: 'Open menu' }); if (await menu.isVisible()) await menu.click(); await p.getByRole('link', { name: 'Users' }).last().click(); await p.waitForSelector('text=Ravi Nair'); } },
  { name: 'console-visit-dialog', path: '/console/institutes/i1', signedIn: true, ready: 'text=Save modules', then: async (p) => { await p.getByRole('button', { name: /View as school/ }).click(); await p.getByRole('textbox', { name: 'Reason' }).fill('Fees report shows the wrong total for class 5'); } },
  { name: 'console-team', path: '/console/team', signedIn: true, ready: 'text=Kabir Rao' },
  { name: 'console-accept-invite', path: '/console/accept-invite?token=abc', signedIn: false, ready: 'text=Set your password' },
  { name: 'student-edit-photo', path: '/students', signedIn: true, ready: 'text=Kabir Mehta', then: async (p) => { await p.getByRole('button', { name: /^Edit Kabir Mehta/ }).click(); await p.waitForSelector('text=Change photo'); } },
  { name: 'notifications-panel', path: '/', signedIn: true, ready: 'text=Welcome, Asha Verma', then: async (p) => { await p.getByRole('button', { name: 'Notifications' }).click(); await p.waitForSelector('text=Student import finished'); } },
  { name: 'approvals-inbox', path: '/approvals', signedIn: true, ready: 'text=Late fee waiver' },
  { name: 'approvals-mine', path: '/approvals?tab=mine', signedIn: true, ready: 'text=Hardship concession for Anaya Kumar' },
  { name: 'approval-detail', path: '/approvals?id=ap1', signedIn: true, ready: 'text=Your decision' },
  { name: 'approval-reject-error', path: '/approvals?id=ap1', signedIn: true, ready: 'text=Your decision', then: (p) => p.getByRole('button', { name: 'Reject' }).click().then(() => p.waitForSelector('text=Say why you are rejecting')) },
  { name: 'handovers', path: '/approvals?tab=handovers', signedIn: true, ready: 'text=Away at a conference in Hyderabad' },
  { name: 'handovers-empty', path: '/approvals?tab=handovers', signedIn: true, empty: true, ready: 'text=You have not handed your approvals to anyone' },
  { name: 'handover-new', path: '/approvals?tab=handovers', signedIn: true, ready: 'text=Away at a conference in Hyderabad', then: async (p) => { await p.getByRole('button', { name: /Hand over my approvals/ }).click(); await p.getByLabel(/^Colleague \*$/).fill('Pri'); await p.waitForSelector('option:has-text("Priya Sharma")', { state: 'attached' }); await p.getByLabel('Colleague results').selectOption({ label: 'Priya Sharma (Registrar)' }); await p.getByLabel(/^Ends/).fill(new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 16)); await p.getByLabel(/Reason/).fill('Away at a conference'); } },
  { name: 'handover-too-long', path: '/approvals?tab=handovers', signedIn: true, ready: 'text=Away at a conference in Hyderabad', then: async (p) => { await p.getByRole('button', { name: /Hand over my approvals/ }).click(); await p.getByLabel(/^Ends/).fill(new Date(Date.now() + 120 * 864e5).toISOString().slice(0, 16)); await p.getByRole('button', { name: 'Hand over', exact: true }).click(); await p.waitForSelector('text=Choose the colleague'); } },
  { name: 'handover-no-rights', path: '/approvals?tab=handovers', signedIn: true, denied: true, ready: 'text=Away at a conference in Hyderabad', then: async (p) => { await p.getByRole('button', { name: /Hand over my approvals/ }).click(); await p.getByLabel(/^Colleague \*$/).fill('Ravi'); await p.waitForSelector('option:has-text("Ravi Nair")', { state: 'attached' }); await p.getByLabel('Colleague results').selectOption({ index: 1 }); await p.getByLabel(/^Ends/).fill(new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 16)); await p.getByRole('button', { name: 'Hand over', exact: true }).click(); await p.waitForSelector('text=only when you can decide some yourself'); } },
  { name: 'handover-end-confirm', path: '/approvals?tab=handovers', signedIn: true, ready: 'text=Away at a conference in Hyderabad', then: async (p) => { await p.getByRole('button', { name: /End handover to Kavita Rao now/ }).click(); await p.waitForSelector('role=alertdialog'); } },
  { name: 'approvals-empty', path: '/approvals', signedIn: true, empty: true, ready: 'text=Nothing is waiting for you' },
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
    approvalsEmpty = Boolean(s.empty);
    handoverDenied = Boolean(s.denied);
    await mockApi(page, s.signedIn, s.mfa);
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
