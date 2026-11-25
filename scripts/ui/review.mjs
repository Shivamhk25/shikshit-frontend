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
  { screenId: 'year_rollover', label: 'Year rollover', order: 22 },
  { screenId: 'classes', label: 'Classes', order: 23 },
  { screenId: 'enquiries', label: 'Enquiries', order: 35 },
  { screenId: 'enquiry_discussions', label: 'Enquiry discussions', order: 36 },
  { screenId: 'registrations', label: 'Registrations', order: 37 },
  { screenId: 'admission_insights', label: 'Admission insights', order: 39 },
  { screenId: 'admissions', label: 'Admissions', order: 38 },
  { screenId: 'students', label: 'Students', order: 40 },
  { screenId: 'guardians', label: 'Guardians', order: 42 },
  { screenId: 'promotions', label: 'Promotions', order: 45 },
  { screenId: 'transfers', label: 'Transfers', order: 46 },
  { screenId: 'student_pauses', label: 'Pauses', order: 47 },
  { screenId: 'alumni', label: 'Alumni', order: 48 },
  { screenId: 'student_electives', label: 'Student electives', order: 49 },
  { screenId: 'student_elective_changes', label: 'Elective change requests', order: 50 },
  { screenId: 'scope_assignments', label: 'Class assignments', order: 60 },
  { screenId: 'users', label: 'Users', order: 61 },
  { screenId: 'roles', label: 'Roles', order: 62 },
  { screenId: 'parent_links', label: 'Parent accounts', order: 63 },
  { screenId: 'appearance', label: 'Appearance', order: 64 },
  { screenId: 'approvals', label: 'Approvals', order: 70 },
  { screenId: 'profile', label: 'Profile', order: 90 },
];
const permissions = ['adm.admission_insights.view', 'onb.workspace.view', 'aca.academic_years.view', 'aca.classes.view', 'adm.enquiry.view', 'adm.enquiry.create', 'adm.enquiry.edit', 'adm.enquiry.delete', 'adm.enquiry_discussions.view', 'adm.enquiry_discussions.create', 'adm.enquiry_discussions.edit', 'adm.enquiry_discussions.delete', 'stu.students.view', 'stu.students.create', 'stu.students.edit', 'stu.students.delete', 'iam.users.view', 'iam.users.create', 'iam.users.edit', 'iam.scope_assignments.view', 'iam.scope_assignments.edit', 'iam.roles.view', 'iam.roles.create', 'iam.roles.edit', 'iam.roles.delete', 'iam.parent_links.view', 'iam.parent_links.create', 'iam.parent_links.edit', 'iam.parent_links.delete', 'iam.appearance.view', 'iam.appearance.manage', 'adm.student_registrations.view', 'adm.student_registrations.create', 'adm.student_registrations.edit', 'adm.student_registrations.delete', 'adm.admissions.view', 'adm.admissions.create', 'stu.student_promotions.view', 'stu.student_promotions.create', 'stu.student_promotions.edit', 'stu.student_promotions.delete', 'stu.student_transfers.view', 'stu.student_transfers.create', 'stu.student_transfers.edit', 'stu.student_transfers.delete', 'stu.student_pauses.view', 'stu.student_pauses.create', 'stu.student_pauses.edit', 'stu.alumni.view'];
permissions.push('stu.student_electives.view', 'stu.student_electives.edit', 'stu.student_electives.delete', 'stu.student_elective_approvals.view', 'stu.student_elective_approvals.create', 'stu.student_elective_approvals.edit');
permissions.push('ten.year_rollover.view', 'ten.year_rollover.create', 'ten.year_rollover.edit');
const admission = (n, o) => ({ id: `r${n}`, applicationNumber: `REG-0000${n}`, appliedOn: '2026-11-12', fullName: 'Diya Singh', dateOfBirth: '2021-03-14', gender: 'female', fatherName: 'Rahul Singh', motherName: null, guardianName: null, guardianPhone: '9810012345', classId: 'c1', className: 'Nursery', sectionId: null, sectionName: null, yearId: 'y1', yearName: '2027-28', status: 'accepted', admitted: false, admittedAt: null, studentId: null, studentCode: null, enrolledSectionName: null, rollNumber: null, ...o });
const admissions = [admission(43, {}), admission(46, { fullName: 'Kabir Iyer', gender: null, className: 'Class 1', classId: 'c2' }), admission(47, { fullName: 'Aarav Sharma', sectionName: 'A' })];
const students = [
  { id: '1', registrationCode: 'R-0001', firstName: 'Asha', fullName: 'Asha Rao', gender: 'female', dateOfBirth: '2015-06-01', status: 'active', currentClassName: 'Class 5', currentSectionName: 'A', currentRollNumber: '1' },
  { id: '2', registrationCode: 'R-0002', firstName: 'Kabir', fullName: 'Kabir Mehta', gender: 'male', dateOfBirth: '2015-02-11', status: 'active', currentClassName: 'Class 5', currentSectionName: 'A', currentRollNumber: '2' },
  { id: '3', registrationCode: 'R-0003', firstName: 'Meera', fullName: 'Meera Iyer', gender: 'female', dateOfBirth: '2014-11-23', status: 'paused', currentClassName: 'Class 5', currentSectionName: 'B', currentRollNumber: null },
];

// Promotions (STU-07)
let promoMode = 'draft';
const promoBatch = (o) => ({ id: 'b1', fromYearId: 'y1', fromYearName: '2026-27', toYearId: 'y2', toYearName: '2027-28', fromClassId: 'c5', fromClassName: 'Class 5', fromSectionId: 'sa', fromSectionName: 'Section A', rollMode: 'alphabetical', note: null, status: 'draft', studentCount: 5, promoteCount: 3, repeatCount: 1, graduateCount: 0, leaveOutCount: 1, committedAt: null, committedByName: null, undoUntil: null, canUndo: false, duesOverrideReason: null, undoneAt: null, undoneByName: null, undoReason: null, createdAt: '2026-11-20T04:00:00Z', updatedAt: '2026-11-20T04:00:00Z', ...o });
const promoPeople = [['s1', 'R-0001', 'Asha Rao', 'active', '1'], ['s2', 'R-0002', 'Kabir Mehta', 'active', '2'], ['s3', 'R-0003', 'Meera Iyer', 'paused', '3'], ['s4', 'R-0004', 'Zoya Khan', 'active', '4'], ['s5', 'R-0005', 'Dev Patel', 'active', '5']];
const promoCandidates = promoPeople.map(([studentId, registrationCode, studentName, studentStatus, rollNumber]) => ({ studentId, registrationCode, studentName, studentStatus, enrollmentId: `e${studentId}`, rollNumber, decision: studentStatus === 'active' ? 'promote' : 'leave_out', toClassId: studentStatus === 'active' ? 'c6' : null, toClassName: studentStatus === 'active' ? 'Class 6' : null }));
const promoRows = (committed) => promoPeople.map(([studentId, registrationCode, studentName, studentStatus, rollNumber], i) => ({ studentId, registrationCode, studentName, studentStatus, enrollmentId: `e${studentId}`, rollNumber, decision: studentStatus !== 'active' ? 'leave_out' : studentId === 's5' ? 'repeat' : 'promote', toClassId: studentStatus !== 'active' ? null : studentId === 's5' ? 'c5' : 'c6', toClassName: null, toSectionId: null, toSectionName: null, newRollNumber: null, newEnrollmentId: committed && studentStatus === 'active' ? `n${i}` : null, enrolledClassName: committed && studentStatus === 'active' ? (studentId === 's5' ? 'Class 5' : 'Class 6') : null, enrolledSectionName: committed && studentStatus === 'active' ? 'Section A' : null, enrolledRollNumber: committed && studentStatus === 'active' ? String(i + 1) : null }));
const promoOutcome = (problem) => ({ batch: promoBatch({}), committed: false, alreadyCommitted: false, undone: false, alreadyUndone: false, enrolledCount: problem ? 3 : 4, graduatedCount: 0, leftOutCount: 1, problemCount: problem ? 1 : 0, duesOverridden: false,
  warnings: ['Class 6 (Section A) would have 31 students; its capacity is 30.'],
  rows: promoRows(false).map((r, i) => ({ studentId: r.studentId, registrationCode: r.registrationCode, studentName: r.studentName, decision: r.decision, outcome: r.decision === 'leave_out' ? 'leave_out' : problem && r.studentId === 's2' ? 'problem' : 'enrol', toClassId: r.toClassId, toClassName: r.decision === 'repeat' ? 'Class 5' : 'Class 6', toSectionId: 'sa', toSectionName: 'Section A', rollNumber: problem && r.studentId === 's2' ? null : String(i + 1), enrollmentId: null,
    problems: problem && r.studentId === 's2' ? [{ field: 'rollNumber', code: 'roll_taken', message: 'Roll number 2 is already used in Class 6 (Section A).' }] : [] })) });
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
const insights = {
  asOf: '2026-11-23T10:00:00Z', trendFrom: '2025-12', trendTo: '2026-11',
  enquiries: { total: 1250, byStatus: { new: 400, contacted: 300, visit_scheduled: 150, converted: 300, closed: 100 }, bySource: { walk_in: 500, phone: 250, website: 200, referral: 150, social: 100, other: 50 } },
  followUps: { due: 12, dueToday: 5, overdue: 7 },
  registrations: { total: 480, admitted: 180, byStatus: { submitted: 100, under_review: 80, accepted: 240, rejected: 40, withdrawn: 20 } },
  conversion: { enquiryToRegistration: { of: 1250, converted: 400, rate: 0.32 }, registrationToAccepted: { of: 480, converted: 240, rate: 0.5 }, acceptedToAdmitted: { of: 240, converted: 180, rate: 0.75 } },
  trend: [['2025-12', 40, 10], ['2026-01', 90, 30], ['2026-02', 140, 55], ['2026-03', 210, 80], ['2026-04', 180, 70], ['2026-05', 60, 25], ['2026-06', 30, 8], ['2026-07', 55, 12], ['2026-08', 120, 40], ['2026-09', 150, 60], ['2026-10', 130, 55], ['2026-11', 45, 35]].map(([month, enquiries, registrations]) => ({ month, enquiries, registrations })),
};
const emptyInsights = { ...insights, enquiries: { total: 0, byStatus: { new: 0, contacted: 0, visit_scheduled: 0, converted: 0, closed: 0 }, bySource: { walk_in: 0, phone: 0, website: 0, referral: 0, social: 0, other: 0 } }, followUps: { due: 0, dueToday: 0, overdue: 0 }, registrations: { total: 0, admitted: 0, byStatus: { submitted: 0, under_review: 0, accepted: 0, rejected: 0, withdrawn: 0 } }, conversion: { enquiryToRegistration: { of: 0, converted: 0, rate: null }, registrationToAccepted: { of: 0, converted: 0, rate: null }, acceptedToAdmitted: { of: 0, converted: 0, rate: null } }, trend: insights.trend.map((t) => ({ ...t, enquiries: 0, registrations: 0 })) };
let insightsMode = 'ready';
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

const transfer = (n, status, o) => ({ id: `t${n}`, student: { id: `s${n}`, name: 'Asha Rao', registrationCode: `R-000${n}` }, className: 'Class 5', sectionName: 'A', yearName: '2026-27', requestedOn: '2026-11-10', reason: 'relocation', reasonNote: null, destinationSchool: 'Pune Public School', lastAttendanceDate: '2026-11-08', status, approvalRequestId: status === 'requested' ? 'ap1' : null, tcNumber: null, tcIssuedOn: null, dues: { status: 'not_tracked', note: 'Fee dues are not tracked yet.' }, createdAt: '2026-11-10T04:00:00Z', updatedAt: '2026-11-10T04:00:00Z', ...o });
const transfers = [
  transfer(1, 'requested', { student: { id: 's1', name: 'Kabir Mehta', registrationCode: 'R-0002' }, reason: 'other', reasonNote: 'Moving abroad for a year; the family expects to return in 2028.' }),
  transfer(2, 'approved', { student: { id: 's2', name: 'Meera Iyer', registrationCode: 'R-0003' }, className: 'Class 8', sectionName: 'B', reason: 'another_school', requestedOn: '2026-11-05' }),
  transfer(3, 'completed', { tcNumber: 'TC-000012', tcIssuedOn: '2026-11-20', requestedOn: '2026-11-01', reason: 'health' }),
  transfer(4, 'rejected', { student: { id: 's4', name: 'Ishaan Verma', registrationCode: 'R-0007' }, className: 'Class 3', sectionName: null, reason: 'financial', requestedOn: '2026-10-28' }),
  transfer(5, 'cancelled', { student: { id: 's5', name: 'Diya Singh', registrationCode: 'R-0009' }, className: null, sectionName: null, yearName: null, reason: 'relocation', destinationSchool: null, lastAttendanceDate: null, requestedOn: '2026-10-20' }),
];
const certificate = { tcNumber: 'TC-000012', issuedOn: '2026-11-20', schoolName: 'Springfield Public School', student: { fullName: 'Asha Rao', registrationCode: 'R-0003', dateOfBirth: '2015-06-01', gender: 'female', admissionDate: '2021-04-05' }, className: 'Class 5', sectionName: 'A', yearName: '2026-27', lastAttendanceDate: '2026-11-08', reason: 'health', reasonLabel: 'Health', reasonNote: 'Advised a change of climate by the family doctor.', destinationSchool: 'Pune Public School', guardians: [{ name: 'Meera Rao', relation: 'mother' }, { name: 'Anil Rao', relation: 'father' }] };
let transfersMode = 'ready';
// Student electives (STU-04) and change requests (STU-05)
const elSubj = (id, name) => ({ id, code: id.toUpperCase(), name });
const elGroup = { id: 'g1', name: 'Stream subjects', code: null, minSubjects: 1, maxSubjects: 2, enforceLimits: true };
const elChoice = (n, name, subjects, o) => ({ id: `e${n}`, student: { id: `s${n}`, name, registrationCode: `R-000${n}` }, yearId: 'y1', yearName: '2026-27', classId: 'c5', className: 'Class 11', sectionId: 'sa', sectionName: 'A', group: elGroup, subjects, offered: [elSubj('m', 'Mathematics'), elSubj('b', 'Biology'), elSubj('cs', 'Computer Science')], status: 'chosen', withinLimits: true, warnings: [], createdAt: '2026-11-01T04:00:00Z', updatedAt: '2026-11-01T04:00:00Z', ...o });
const elChoices = [
  elChoice(1, 'Asha Rao', [elSubj('m', 'Mathematics'), elSubj('b', 'Biology')], { status: 'confirmed' }),
  elChoice(2, 'Kabir Mehta', [elSubj('cs', 'Computer Science')]),
  elChoice(3, 'Meera Iyer', [], { withinLimits: false, warnings: [{ code: 'below_minimum', message: 'Below the minimum of 1 subject.' }] }),
];
const elChange = (n, status, o) => ({ id: `ch${n}`, student: { id: `s${n}`, name: 'Asha Rao', registrationCode: `R-000${n}` }, yearId: 'y1', yearName: '2026-27', className: 'Class 11', sectionName: 'A', group: { id: 'g1', name: 'Stream subjects' }, choiceId: 'e1', fromSubject: elSubj('m', 'Mathematics'), toSubject: elSubj('b', 'Biology'), wantedFrom: '2026-12-01', reason: 'Wants to study medicine after school.', status, approvalRequestId: status === 'requested' ? 'ap1' : null, requestedBy: { id: 'u1', name: 'Asha Verma' }, decision: null, cancelledAt: null, createdAt: '2026-11-20T04:00:00Z', updatedAt: '2026-11-20T04:00:00Z', ...o });
const elChanges = [elChange(1, 'requested', { student: { id: 's2', name: 'Kabir Mehta', registrationCode: 'R-0002' } }), elChange(2, 'approved', { decision: { outcome: 'approved', decidedBy: { id: 'u2', name: 'Ravi Nair' }, decidedAt: '2026-11-21T04:00:00Z', note: 'Fine.' } }), elChange(3, 'rejected', { decision: { outcome: 'rejected', decidedBy: { id: 'u2', name: 'Ravi Nair' }, decidedAt: '2026-11-21T04:00:00Z', note: 'Too late in the term.' } })];
const elRoster = { year: { id: 'y1', name: '2026-27' }, class: { id: 'c5', name: 'Class 11' }, section: { id: 'sa', name: 'A' }, group: elGroup, offered: [elSubj('m', 'Mathematics'), elSubj('b', 'Biology'), elSubj('cs', 'Computer Science')], students: elChoices.map((c, i) => ({ student: c.student, rollNumber: String(i + 1), choiceId: c.id, status: c.status, subjects: c.subjects, withinLimits: c.withinLimits, warnings: c.warnings })) };
let electivesMode = 'ready';
const elRosterOpen = async (p) => { await p.getByRole('tab', { name: 'Class roster' }).click(); await p.getByLabel('Academic year').selectOption('y1'); await p.getByLabel('Class', { exact: true }).selectOption('c5'); await p.getByRole('combobox', { name: 'Section' }).selectOption({ index: 1 }); await p.getByLabel('Elective group').selectOption('g1'); await p.getByRole('button', { name: 'Show students' }).click(); await p.waitForSelector('role=checkbox[name="Biology for Kabir Mehta"]'); };
// Student pauses (STU-09) and Alumni (STU-10)
const pause = (n, status, o) => ({ id: `p${n}`, student: { id: `s${n}`, name: 'Asha Rao', registrationCode: `R-000${n}` }, className: 'Class 5', sectionName: 'A', yearName: '2026-27', pausedFrom: '2026-11-03', days: status === 'cancelled' ? null : 20, expectedBack: '2026-12-15', overdue: false, reason: 'illness', reasonNote: null, status, endedOn: status === 'ended' ? '2026-11-23' : null, closeNote: null, figures: { owed: { status: 'not_tracked', note: 'Fee dues are not tracked yet' }, missed: { status: 'not_tracked', note: 'Attendance is not tracked yet' } }, createdAt: '2026-11-03T04:00:00Z', updatedAt: '2026-11-03T04:00:00Z', ...o });
const pauses = [
  pause(1, 'active', { student: { id: 's1', name: 'Kabir Mehta', registrationCode: 'R-0002' }, reason: 'family_relocation', reasonNote: 'Parents are posted in Dubai for the term.' }),
  pause(2, 'active', { student: { id: 's2', name: 'Meera Iyer', registrationCode: 'R-0003' }, className: 'Class 8', sectionName: 'B', overdue: true, expectedBack: '2026-11-15', days: 25, reason: 'other', reasonNote: 'Training camp for the state team.' }),
  pause(3, 'ended', { days: 14, pausedFrom: '2026-10-01', expectedBack: '2026-10-20', closeNote: 'Recovered fully.' }),
  pause(4, 'cancelled', { student: { id: 's4', name: 'Ishaan Verma', registrationCode: 'R-0007' }, className: null, sectionName: null, yearName: null, expectedBack: null, reason: 'financial', pausedFrom: '2026-09-12' }),
];
const alumniRow = (n, o) => ({ id: `a${n}`, name: 'Farid Khan', registrationCode: `R-010${n}`, admissionDate: '2018-04-02', lastClassName: 'Class 8', lastSectionName: 'A', yearName: '2025-26', reason: 'graduated', reasonLabel: 'Graduated', exitDate: '2026-03-31', tcNumber: null, destinationSchool: null, lastAttendanceDate: null, ...o });
const alumni = [
  alumniRow(1, {}),
  alumniRow(2, { name: 'Tara Nair', lastClassName: 'Class 5', lastSectionName: 'B', reason: 'transferred', reasonLabel: 'Transferred', exitDate: '2026-03-12', tcNumber: 'TC-000012', destinationSchool: 'Pune Public School', lastAttendanceDate: '2026-03-10' }),
  alumniRow(3, { name: 'Gita Menon', lastClassName: 'Class 8', lastSectionName: 'B' }),
  alumniRow(4, { name: 'Manu Joshi', lastClassName: 'Class 7', lastSectionName: null, yearName: '2024-25', reason: 'other', reasonLabel: 'Other', exitDate: null }),
];
let pausesMode = 'ready';
let alumniMode = 'ready';


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

// Year rollover (TEN-01)
let rolloverMode = 'off';
const rollYear = (id, code, name, start, end, cur) => ({ id, code, name, startDate: start, endDate: end, isCurrent: cur, status: 'active' });
const rollY1 = rollYear('y1', '2026-27', '2026-27', '2026-04-01', '2027-03-31', true);
const rollY2 = rollYear('y2', '2027-28', '2027-28', '2027-04-01', '2028-03-31', false);
const rollStep = (id, title, description, o) => ({ id, title, description, defaultOn: true, irreversible: false, sourceCount: 2, targetCount: 0, ...o });
const rollChecklist = () => ({
  from: rollY1, to: rollY2, shift: { mode: 'years', years: 1, days: 0 }, promotions: { sections: 6, promoted: 2 },
  notes: ['Elective groups, textbooks and chapters are not tied to an academic year, so there is nothing to copy; they carry over as they are.', 'Students are not moved here. Promote each class section on the Promotions screen once the new year has its class sections.'],
  steps: [
    rollStep('terms', 'Terms', 'Copy each term with its dates moved into the new year. A term is refused when its moved dates fall outside the new year or overlap a term it already has.', { sourceCount: 3, lastRun: { id: 'r0', ranAt: '2026-11-22T05:00:00Z', runByName: 'Asha Verma', createdCount: 3, existingCount: 0, skippedCount: 0, conflictCount: 0, reviewCount: 0 } }),
    rollStep('class_sections', 'Class sections', 'Map the same sections to the same classes, with their capacity and room. Do this before the subject mappings and before promoting students.', { sourceCount: 24 }),
    rollStep('subject_classes', 'Class subjects', 'Map the same subjects to the same classes (and sections). A subject set for one section needs that section mapped to the class in the new year first.', { sourceCount: 112 }),
    rollStep('holidays', 'Holidays', 'Copy the holidays with dates moved by the year shift. Festival dates change every year, so public, regional and restricted holidays are marked for you to review. Holidays that repeat every year are not copied; they already apply.', { sourceCount: 18 }),
    rollStep('calendar_events', 'Calendar events', 'Copy the academic calendar events with dates moved by the year shift. Off by default: events are usually planned afresh.', { defaultOn: false, sourceCount: 9 }),
    rollStep('make_current', 'Make the new year current', 'Switch the institute to the new year. Attendance, fees, admissions and every screen that defaults to the current year start using it at once. Needs terms and class sections in the new year.', { defaultOn: false, irreversible: true, sourceCount: 0 }),
  ],
});
const rollItem = (label, status, o) => ({ label, status, reason: '', message: '', detail: '', review: false, ...o });
const rollResult = (step, o) => ({ step, dryRun: false, fromYearId: 'y1', toYearId: 'y2', createdCount: 0, existingCount: 0, skippedCount: 0, conflictCount: 0, reviewCount: 0, items: [], itemsTruncated: false, warnings: [], blockers: [], shift: { mode: 'years', years: 1, days: 0 }, runId: 'run1', ranAt: '2026-11-24T05:00:00Z', ...o });
const rollPreviews = {
  terms: rollResult('terms', { dryRun: true, runId: null, ranAt: null, createdCount: 2, conflictCount: 1, items: [
    rollItem('T3 · Third term', 'conflict', { reason: 'outside_year', message: 'The moved dates fall outside 2027-28 (2027-04-01 to 2028-03-31).', detail: '2027-01-01 to 2027-04-15 becomes 2028-01-01 to 2028-04-15' }),
    rollItem('T1 · First term', 'create', { detail: '2026-04-01 to 2026-09-30 becomes 2027-04-01 to 2027-09-30' }),
    rollItem('T2 · Second term', 'create', { detail: '2026-10-01 to 2026-12-31 becomes 2027-10-01 to 2027-12-31' }),
  ] }),
  holidays: rollResult('holidays', { dryRun: true, runId: null, ranAt: null, createdCount: 14, existingCount: 1, skippedCount: 3, reviewCount: 9, items: [
    rollItem('Diwali', 'create', { review: true, detail: '2026-11-08 to 2026-11-09 becomes 2027-11-08 to 2027-11-09', message: 'The date of a public holiday may change from year to year. Check it.' }),
    rollItem('Republic Day', 'create', { review: true, detail: '2027-01-26 to 2027-01-26 becomes 2028-01-26 to 2028-01-26', message: 'The date of a public holiday may change from year to year. Check it.' }),
    rollItem("Founders' Day", 'create', { detail: '2026-08-15 to 2026-08-15 becomes 2027-08-15 to 2027-08-15' }),
    rollItem('Labour Day', 'skipped', { reason: 'recurring_annual', message: 'This holiday repeats every year, so it already applies to 2027-28.' }),
    rollItem('Summer break', 'exists', { message: 'This holiday is already in 2027-28 on the moved dates.' }),
  ] }),
  make_current: rollResult('make_current', { dryRun: true, runId: null, ranAt: null, createdCount: 1, items: [rollItem('Make 2027-28 the current year', 'create', { detail: 'The current year changes from 2026-27 to 2027-28.' })],
    warnings: ['4 of 6 class sections with students in 2026-27 have not been promoted into 2027-28 yet.', '2027-28 starts on 2027-04-01, which is still ahead.'] }),
};
const rollHistory = [
  { id: 'h3', fromYearId: 'y1', fromYearName: '2026-27', toYearId: 'y2', toYearName: '2027-28', step: 'make_current', status: 'failed', createdCount: 0, existingCount: 0, skippedCount: 0, conflictCount: 0, reviewCount: 0, warnings: [], error: 'Blocked: 2027-28 has no class sections. Run the class sections step or map them first.', runByName: 'Asha Verma', ranAt: '2026-11-24T05:10:00Z' },
  { id: 'h2', fromYearId: 'y1', fromYearName: '2026-27', toYearId: 'y2', toYearName: '2027-28', step: 'holidays', status: 'completed', createdCount: 14, existingCount: 1, skippedCount: 3, conflictCount: 0, reviewCount: 9, warnings: [], error: null, runByName: 'Asha Verma', ranAt: '2026-11-24T05:05:00Z' },
  { id: 'h1', fromYearId: 'y1', fromYearName: '2026-27', toYearId: 'y2', toYearName: '2027-28', step: 'terms', status: 'completed', createdCount: 3, existingCount: 0, skippedCount: 0, conflictCount: 0, reviewCount: 0, warnings: [], error: null, runByName: 'Asha Verma', ranAt: '2026-11-22T05:00:00Z' },
];

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
      return json(200, { user: { id: 'u1', name: 'Asha Verma', tier: 'tenant' }, tenant: { id: 't1', name: 'Springfield Public School', brand: { primary: '#1F3A5F' }, modules: ['onb', 'aca', 'adm', 'stu', 'iam', 'wfl', 'ten'] }, permissions, scopes: {}, fieldMasks: {}, workspace: { home: 'admin', navigation: nav }, mobile: { tabs: [], features: [] }, approvals: { canApprove: [] }, version: 1 });
    if (rolloverMode !== 'off' && path === '/academic-years') return json(200, { items: rolloverMode === 'nonext' ? [rollY1] : [rollY1, rollY2], page: { number: 1, size: 200, total: 2 } });
    if (rolloverMode !== 'off' && path === '/year-rollover/checklist') return json(200, rollChecklist());
    if (rolloverMode !== 'off' && path === '/year-rollover/history') return json(200, { items: rolloverMode === 'empty' ? [] : rollHistory, page: { number: 1, size: 25, total: rolloverMode === 'empty' ? 0 : rollHistory.length } });
    if (rolloverMode !== 'off' && path.startsWith('/year-rollover/steps/') && path.endsWith('/preview')) return json(200, rollPreviews[path.split('/')[3]] ?? rollResult(path.split('/')[3], { dryRun: true, runId: null, ranAt: null, createdCount: 2 }));
    if (rolloverMode !== 'off' && path.startsWith('/year-rollover/steps/') && path.endsWith('/run')) {
      const step = path.split('/')[3];
      if (rolloverMode === 'failed' && step === 'class_sections') return json(500, { code: 'internal', detail: 'Something went wrong. Please try again.' });
      return json(200, step === 'holidays' ? rollResult(step, { createdCount: 14, existingCount: 1, skippedCount: 3, reviewCount: 9 }) : step === 'terms' ? rollResult(step, { createdCount: 2, conflictCount: 1, items: rollPreviews.terms.items.slice(0, 1) }) : rollResult(step, { createdCount: step === 'make_current' ? 1 : 24, warnings: step === 'class_sections' ? ['2 mappings were copied without a room because the room no longer exists.'] : [] }));
    }
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
    if (path === '/academic-years' && promoMode !== 'off') return json(200, { items: [{ id: 'y1', name: '2026-27' }, { id: 'y2', name: '2027-28' }], page: { number: 1, size: 200, total: 2 } });
    if (path === '/classes' && promoMode !== 'off') return json(200, { items: [{ id: 'c5', name: 'Class 5' }, { id: 'c6', name: 'Class 6' }, { id: 'c7', name: 'Class 7' }], page: { number: 1, size: 200, total: 3 } });
    if (path === '/class-section-mappings' && promoMode !== 'off') return json(200, { items: new URL(route.request().url()).searchParams.get('yearId') === 'y1' ? [{ classId: 'c5', yearId: 'y1', sectionId: 'sa', sectionName: 'Section A' }] : [{ classId: 'c6', yearId: 'y2', sectionId: 'sa', sectionName: 'Section A' }, { classId: 'c6', yearId: 'y2', sectionId: 'sb', sectionName: 'Section B' }, { classId: 'c5', yearId: 'y2', sectionId: 'sa', sectionName: 'Section A' }], page: { number: 1, size: 200, total: 3 } });
    if (path === '/promotions/proposal') return json(200, { fromYearId: 'y1', fromYearName: '2026-27', toYearId: 'y2', toYearName: '2027-28', classId: 'c5', className: 'Class 5', sectionId: 'sa', sectionName: 'Section A', nextClassId: 'c6', nextClassName: 'Class 6', isLastClass: false, existingBatchId: promoMode === 'committed' ? 'b1' : null, existingBatchStatus: promoMode === 'committed' ? 'committed' : null, candidates: promoCandidates });
    if (path === '/promotions' && route.request().method() === 'POST') return json(201, { batch: promoBatch({}), rows: promoRows(false) });
    if (path === '/promotions') return json(200, { items: [promoBatch({}), promoBatch({ id: 'b2', fromClassName: 'Class 7', status: 'committed', committedAt: '2026-11-18T05:00:00Z', undoUntil: '2026-11-25T05:00:00Z', canUndo: true }), promoBatch({ id: 'b3', fromClassName: 'Class 8', fromSectionName: 'Section B', status: 'undone', undoneAt: '2026-11-19T05:00:00Z', undoReason: 'Wrong year' })], page: { number: 1, size: 25, total: 3 } });
    if (path === '/promotions/b1/preview') return json(200, promoOutcome(promoMode === 'problem'));
    if (path === '/promotions/b1/undo') return json(409, { code: 'cannot_undo', detail: 'This promotion can no longer be undone. Nothing was changed.', errors: [{ field: 's2', code: 'enrolment_changed', message: 'edited' }, { field: 's4', code: 'promoted_onward', message: 'again' }] });
    if (path === '/promotions/b1') return json(200, promoMode === 'committed' ? { batch: promoBatch({ status: 'committed', committedAt: '2026-11-21T05:00:00Z', committedByName: 'Asha Verma', undoUntil: '2026-11-28T05:00:00Z', canUndo: true }), rows: promoRows(true) } : { batch: promoBatch({}), rows: promoRows(false) });
    if (path === '/enquiry-discussions') {
      const e = new URL(route.request().url()).searchParams.get('enquiryId');
      const items = e ? discussions.filter((d) => d.enquiryId === e) : discussions;
      return json(200, { items, page: { number: 1, size: 25, total: items.length } });
    }
    if (path === '/admission-insights') return insightsMode === 'error' ? json(500, { code: 'internal', detail: 'The figures could not be loaded. Please try again.' }) : json(200, insightsMode === 'empty' ? emptyInsights : insights);
    if (path === '/enquiries') return json(200, { items: enquiries, page: { number: 1, size: 25, total: enquiries.length } });
    if (path === '/student-pauses' && route.request().method() === 'GET') {
      if (pausesMode === 'error') return json(500, { code: 'internal', detail: 'The pauses could not be loaded. Please try again.' });
      const items = pausesMode === 'empty' ? [] : pauses;
      return json(200, { items, page: { number: 1, size: 25, total: items.length } });
    }
    if (path === '/student-pauses' && route.request().method() === 'POST') return pausesMode === 'conflict' ? json(409, { code: 'already_paused', detail: 'x' }) : json(201, pauses[0]);
    if (path.startsWith('/student-pauses/')) return json(200, pauses[0]);
    if (path === '/alumni') {
      if (alumniMode === 'error') return json(500, { code: 'internal', detail: 'The alumni could not be loaded. Please try again.' });
      const items = alumniMode === 'empty' ? [] : alumni;
      return json(200, { items, page: { number: 1, size: 25, total: items.length } });
    }
    if (path === '/academic-years' && alumniMode !== 'off') return json(200, { items: [{ id: 'y1', name: '2025-26' }, { id: 'y2', name: '2026-27' }], page: { number: 1, size: 200, total: 2 } });
    if (path === '/student-electives' && route.request().method() === 'GET') {
      if (electivesMode === 'error') return json(500, { code: 'internal', detail: 'The choices could not be loaded. Please try again.' });
      const items = electivesMode === 'empty' ? [] : elChoices;
      return json(200, { items, page: { number: 1, size: 25, total: items.length } });
    }
    if (path === '/student-electives/roster') return json(200, elRoster);
    if (path.startsWith('/student-electives/')) return json(200, elChoices[0]);
    if (path === '/student-elective-changes' && route.request().method() === 'GET') {
      const items = electivesMode === 'empty' ? [] : elChanges;
      return json(200, { items, page: { number: 1, size: 25, total: items.length } });
    }
    if (path === '/elective-groups') return json(200, { items: [{ id: 'g1', name: 'Stream subjects' }], page: { number: 1, size: 200, total: 1 } });
    if (path === '/student-transfers' && route.request().method() === 'GET') {
      if (transfersMode === 'error') return json(500, { code: 'internal', detail: 'The transfers could not be loaded. Please try again.' });
      const items = transfersMode === 'empty' ? [] : transfers;
      return json(200, { items, page: { number: 1, size: 25, total: items.length } });
    }
    if (path === '/student-transfers' && route.request().method() === 'POST') return transfersMode === 'conflict' ? json(409, { code: 'open_transfer', detail: 'x' }) : json(201, transfers[0]);
    if (path.endsWith('/certificate') && path.startsWith('/student-transfers/')) return transfersMode === 'notcompleted' ? json(409, { code: 'not_completed', detail: 'x' }) : json(200, certificate);
    if (path.endsWith('/complete') && path.startsWith('/student-transfers/')) return json(200, { transfer: transfers[2], alreadyCompleted: false });
    if (path.startsWith('/student-transfers/')) return json(200, transfers[0]);
    if (path === '/admissions') return json(200, { items: admissions, page: { number: 1, size: 25, total: admissions.length } });
    if (path.startsWith('/admissions/') && path.endsWith('/admit')) return json(201, { registrationId: 'r43', applicationNumber: 'REG-00043', alreadyAdmitted: false, student: { id: 's9', registrationCode: 'STU-000045', fullName: 'Diya Singh', className: 'Nursery', sectionName: 'A', rollNumber: '1' }, enrollmentId: 'e1', yearName: '2027-28', guardians: [], notes: [] });
    if (path === '/class-section-mappings') return json(200, { items: [{ id: 'm1', classId: 'c1', yearId: 'y1', sectionId: 's1', sectionName: 'A' }, { id: 'm2', classId: 'c1', yearId: 'y1', sectionId: 's2', sectionName: 'B' }, { id: 'm3', classId: 'c2', yearId: 'y1', sectionId: 's1', sectionName: 'A' }], page: { number: 1, size: 200, total: 3 } });
    if (path === '/student-registrations') return json(200, { items: registrations, page: { number: 1, size: 25, total: registrations.length } });
    if (path === '/classes') return json(200, { items: [{ id: 'c1', name: 'Nursery' }, { id: 'c2', name: 'Class 1' }], page: { number: 1, size: 200, total: 2 } });
    if (path === '/students') return json(200, { items: students, page: { number: 1, size: 25, total: students.length } });
    return json(200, { items: [], page: { number: 1, size: 25, total: 0 } });
  });
}


async function promoPick(p) {
  await p.getByLabel('Year being closed').selectOption('y1');
  await p.locator('label', { hasText: /^Class/ }).locator('select').selectOption('c5');
  await p.locator('label', { hasText: /^Section/ }).locator('select').selectOption('sa');
  await p.getByRole('button', { name: 'Show students' }).click();
  await p.waitForSelector('text=Asha Rao');
}

async function rollOpen(p) {
  await p.waitForSelector('option:has-text("2027-28")', { state: 'attached' });
  await p.getByRole('button', { name: /Continue/ }).click();
  await p.waitForSelector('text=Rollover steps', { state: 'attached' }).catch(() => {});
  await p.waitForSelector('text=Cannot be undone from here');
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
  { name: 'admission-insights', full: true, path: '/admission-insights', signedIn: true, ready: 'text=From enquiry to a place' },
  { name: 'admission-insights-table', path: '/admission-insights', signedIn: true, ready: 'text=From enquiry to a place', then: (p) => p.getByRole('button', { name: 'Show as a table' }).click().then(() => p.waitForSelector('table:visible')) },
  { name: 'admission-insights-print', full: true, path: '/admission-insights', signedIn: true, print: true, ready: 'text=From enquiry to a place' },
  { name: 'admission-insights-empty', path: '/admission-insights', signedIn: true, insights: 'empty', ready: 'text=No enquiries or registrations here yet' },
  { name: 'admission-insights-error', path: '/admission-insights', signedIn: true, insights: 'error', ready: 'text=could not be loaded' },
  { name: 'registrations', path: '/registrations', signedIn: true, ready: 'text=Ishaan Verma' },
  { name: 'admissions', path: '/admissions', signedIn: true, ready: 'text=Diya Singh' },
  { name: 'admissions-admit', path: '/admissions', signedIn: true, ready: 'text=Diya Singh', then: (p) => p.getByRole('button', { name: /^Admit REG-000043/ }).click().then(() => p.waitForSelector('role=dialog')) },
  { name: 'rollover-years', path: '/year-rollover', signedIn: true, rollover: 'ready', ready: 'text=Year being rolled over', then: (p) => p.waitForSelector('option:has-text("2027-28")', { state: 'attached' }) },
  { name: 'rollover-new-year', path: '/year-rollover', signedIn: true, rollover: 'nonext', ready: 'text=Year being rolled over', then: (p) => p.waitForSelector('text=The new academic year') },
  { name: 'rollover-checklist', full: true, path: '/year-rollover', signedIn: true, rollover: 'ready', ready: 'text=Year being rolled over', then: rollOpen },
  { name: 'rollover-preview', full: true, path: '/year-rollover', signedIn: true, rollover: 'ready', ready: 'text=Year being rolled over', then: async (p) => { await rollOpen(p); await p.getByRole('button', { name: 'Preview Terms' }).click(); await p.getByRole('button', { name: 'Preview Holidays' }).click(); await p.waitForSelector('text=9 copied rows to check afterwards'); } },
  { name: 'rollover-confirm', path: '/year-rollover', signedIn: true, rollover: 'ready', ready: 'text=Year being rolled over', then: async (p) => { await rollOpen(p); await p.getByRole('checkbox', { name: 'Include Make the new year current' }).check(); await p.getByRole('button', { name: /^Run 5 selected steps/ }).click(); await p.waitForSelector('role=alertdialog'); } },
  { name: 'rollover-results', full: true, path: '/year-rollover', signedIn: true, rollover: 'ready', ready: 'text=Year being rolled over', then: async (p) => { await rollOpen(p); await p.getByRole('button', { name: /^Run 4 selected steps/ }).click(); await p.waitForSelector('text=Back to the checklist'); } },
  { name: 'rollover-failed', path: '/year-rollover', signedIn: true, rollover: 'failed', ready: 'text=Year being rolled over', then: async (p) => { await rollOpen(p); await p.getByRole('button', { name: /^Run 4 selected steps/ }).click(); await p.waitForSelector('text=Class sections did not run'); } },
  { name: 'rollover-history', path: '/year-rollover', signedIn: true, rollover: 'ready', ready: 'text=Year being rolled over', then: async (p) => { await p.getByRole('button', { name: 'History' }).click(); await p.waitForSelector('text=Blocked: 2027-28 has no class sections'); } },
  { name: 'promotions-step1', path: '/promotions', signedIn: true, promo: 'draft', ready: 'text=Which class section?', then: promoPick },
  { name: 'promotions-step2', path: '/promotions', signedIn: true, promo: 'problem', ready: 'text=Which class section?', then: async (p) => { await promoPick(p); await p.getByRole('button', { name: /Save and continue/ }).click(); await p.waitForSelector('text=Roll numbers in'); await p.getByRole('button', { name: 'Preview' }).click(); await p.waitForSelector('text=needs attention'); } },
  { name: 'promotions-step2-ready', path: '/promotions', signedIn: true, promo: 'draft', ready: 'text=Which class section?', then: async (p) => { await promoPick(p); await p.getByRole('button', { name: /Save and continue/ }).click(); await p.waitForSelector('text=Roll numbers in'); await p.getByRole('button', { name: 'Preview' }).click(); await p.waitForSelector('text=Ready:'); } },
  { name: 'promotions-done', path: '/promotions', signedIn: true, promo: 'committed', ready: 'text=Which class section?', then: async (p) => { await promoPick(p); await p.waitForSelector('text=Committed on'); } },
  { name: 'promotions-undo-ask', path: '/promotions', signedIn: true, promo: 'committed', ready: 'text=Which class section?', then: async (p) => { await promoPick(p); await p.getByRole('button', { name: /Undo this promotion/ }).click(); await p.waitForSelector('role=alertdialog'); } },
  { name: 'promotions-undo-refused', path: '/promotions', signedIn: true, promo: 'committed', ready: 'text=Which class section?', then: async (p) => { await promoPick(p); await p.getByRole('button', { name: /Undo this promotion/ }).click(); await p.getByRole('textbox', { name: 'Why are you undoing it?' }).fill('Wrong year'); await p.getByRole('button', { name: 'Undo promotion' }).click(); await p.waitForSelector('text=can no longer be undone'); } },
  { name: 'promotions-history', path: '/promotions', signedIn: true, promo: 'draft', ready: 'text=Which class section?', then: async (p) => { await p.getByRole('button', { name: 'History' }).click(); await p.waitForSelector('text=Class 7 · Section A'); } },
  { name: 'transfers', path: '/transfers', signedIn: true, ready: 'text=Kabir Mehta' },
  { name: 'transfers-add', path: '/transfers', signedIn: true, ready: 'text=Kabir Mehta', then: (p) => p.getByRole('button', { name: 'Request transfer' }).click().then(() => p.waitForSelector('role=dialog')) },
  { name: 'transfers-add-other-error', path: '/transfers', signedIn: true, ready: 'text=Kabir Mehta', then: async (p) => { await p.getByRole('button', { name: 'Request transfer' }).click(); const d = p.getByRole('dialog', { name: 'Request a transfer' }); await d.getByRole('combobox', { name: 'Reason *' }).selectOption('other'); await d.getByLabel('Note *').fill('Moving'); await d.getByLabel('Note *').fill(''); await d.getByRole('button', { name: 'Request transfer' }).click(); await d.getByText('Tell us the reason when you choose Other.').waitFor(); } },
  { name: 'transfers-add-conflict', path: '/transfers', signedIn: true, transfers: 'conflict', ready: 'text=Kabir Mehta', then: async (p) => { await p.getByRole('button', { name: 'Request transfer' }).click(); const d = p.getByRole('dialog', { name: 'Request a transfer' }); await d.getByRole('option', { name: /Asha Rao/ }).waitFor({ state: 'attached' }); await d.getByRole('combobox', { name: 'Student results' }).selectOption({ label: 'Asha Rao (R-0001) · Class 5 A' }); await d.getByRole('combobox', { name: 'Reason *' }).selectOption('health'); await d.getByRole('button', { name: 'Request transfer' }).click(); await d.getByRole('alert').waitFor(); } },
  { name: 'transfers-edit', path: '/transfers', signedIn: true, ready: 'text=Kabir Mehta', then: (p) => p.getByRole('button', { name: /^Edit Kabir Mehta/ }).click().then(() => p.waitForSelector('role=dialog')) },
  { name: 'transfers-detail-requested', path: '/transfers', signedIn: true, ready: 'text=Kabir Mehta', then: (p) => p.getByRole('button', { name: /^View Kabir Mehta/ }).click().then(() => p.waitForSelector('[data-testid=transfer-detail]')) },
  { name: 'transfers-detail-completed', path: '/transfers', signedIn: true, ready: 'text=Kabir Mehta', then: (p) => p.getByRole('button', { name: /^View Asha Rao/ }).click().then(() => p.waitForSelector('[data-testid=transfer-detail]')) },
  { name: 'transfers-detail-rejected', path: '/transfers', signedIn: true, ready: 'text=Kabir Mehta', then: (p) => p.getByRole('button', { name: /^View Ishaan Verma/ }).click().then(() => p.waitForSelector('[data-testid=transfer-detail]')) },
  { name: 'transfers-complete-confirm', path: '/transfers', signedIn: true, ready: 'text=Kabir Mehta', then: (p) => p.getByRole('button', { name: /^Complete transfer of Meera Iyer/ }).click().then(() => p.waitForSelector('role=alertdialog')) },
  { name: 'transfers-cancel-confirm', path: '/transfers', signedIn: true, ready: 'text=Kabir Mehta', then: (p) => p.getByRole('button', { name: /^Cancel transfer of Kabir Mehta/ }).click().then(() => p.waitForSelector('role=alertdialog')) },
  { name: 'transfers-empty', path: '/transfers', signedIn: true, transfers: 'empty', ready: 'text=No transfers yet' },
  { name: 'transfers-error', path: '/transfers', signedIn: true, transfers: 'error', ready: 'text=could not be loaded' },
  { name: 'electives', path: '/student-electives', signedIn: true, ready: 'text=Kabir Mehta' },
  { name: 'electives-edit', path: '/student-electives', signedIn: true, ready: 'text=Kabir Mehta', then: (p) => p.getByRole('button', { name: 'Edit subjects of Kabir Mehta' }).click().then(() => p.waitForSelector('role=checkbox[name="Biology"]')) },
  { name: 'electives-request-change', path: '/student-electives', signedIn: true, ready: 'text=Kabir Mehta', then: (p) => p.getByRole('button', { name: 'Request a change for Asha Rao' }).click().then(() => p.waitForSelector('role=dialog')) },
  { name: 'electives-remove-confirm', path: '/student-electives', signedIn: true, ready: 'text=Kabir Mehta', then: (p) => p.getByRole('button', { name: 'Remove choice of Kabir Mehta' }).click().then(() => p.waitForSelector('role=alertdialog')) },
  { name: 'electives-roster', full: true, promo: 'draft', path: '/student-electives', signedIn: true, ready: 'text=Kabir Mehta', then: elRosterOpen },
  { name: 'electives-empty', path: '/student-electives', signedIn: true, electives: 'empty', ready: 'text=No elective choices yet' },
  { name: 'electives-error', path: '/student-electives', signedIn: true, electives: 'error', ready: 'text=could not be loaded' },
  { name: 'elective-changes', path: '/student-elective-changes', signedIn: true, ready: 'text=Wants to study medicine' , then: (p) => p.waitForSelector('text=Too late in the term') },
  { name: 'elective-changes-cancel', path: '/student-elective-changes', signedIn: true, ready: 'text=Wants to study medicine', then: (p) => p.getByRole('button', { name: 'Cancel the request for Kabir Mehta' }).click().then(() => p.waitForSelector('role=alertdialog')) },
  { name: 'elective-changes-empty', path: '/student-elective-changes', signedIn: true, electives: 'empty', ready: 'text=No change requests yet' },
  { name: 'pauses', path: '/student-pauses', signedIn: true, ready: 'text=Kabir Mehta' },
  { name: 'pauses-add', path: '/student-pauses', signedIn: true, ready: 'text=Kabir Mehta', then: (p) => p.getByRole('button', { name: 'Pause a student' }).click().then(() => p.waitForSelector('role=dialog')) },
  { name: 'pauses-add-other-error', path: '/student-pauses', signedIn: true, ready: 'text=Kabir Mehta', then: async (p) => { await p.getByRole('button', { name: 'Pause a student' }).click(); const d = p.getByRole('dialog', { name: 'Pause a student' }); await d.getByRole('combobox', { name: 'Reason *' }).selectOption('other'); await d.getByRole('button', { name: 'Pause student' }).click(); await d.getByText('Tell us the reason when you choose Other.').waitFor(); } },
  { name: 'pauses-add-conflict', path: '/student-pauses', signedIn: true, pauses: 'conflict', ready: 'text=Kabir Mehta', then: async (p) => { await p.getByRole('button', { name: 'Pause a student' }).click(); const d = p.getByRole('dialog', { name: 'Pause a student' }); await d.getByRole('option', { name: /Asha Rao/ }).waitFor({ state: 'attached' }); await d.getByRole('combobox', { name: 'Student results' }).selectOption({ label: 'Asha Rao (R-0001) · Class 5 A' }); await d.getByRole('combobox', { name: 'Reason *' }).selectOption('illness'); await d.getByRole('button', { name: 'Pause student' }).click(); await d.getByRole('alert').waitFor(); } },
  { name: 'pauses-edit', path: '/student-pauses', signedIn: true, ready: 'text=Kabir Mehta', then: (p) => p.getByRole('button', { name: /^Edit pause of Kabir Mehta/ }).click().then(() => p.waitForSelector('role=dialog')) },
  { name: 'pauses-detail-active', path: '/student-pauses', signedIn: true, ready: 'text=Kabir Mehta', then: (p) => p.getByRole('button', { name: /^View pause of Kabir Mehta/ }).click().then(() => p.waitForSelector('[data-testid=pause-detail]')) },
  { name: 'pauses-detail-overdue', path: '/student-pauses', signedIn: true, ready: 'text=Kabir Mehta', then: (p) => p.getByRole('button', { name: /^View pause of Meera Iyer/ }).click().then(() => p.waitForSelector('[data-testid=pause-detail]')) },
  { name: 'pauses-detail-ended', path: '/student-pauses', signedIn: true, ready: 'text=Kabir Mehta', then: (p) => p.getByRole('button', { name: /^View pause of Asha Rao/ }).click().then(() => p.waitForSelector('[data-testid=pause-detail]')) },
  { name: 'pauses-back-confirm', path: '/student-pauses', signedIn: true, ready: 'text=Kabir Mehta', then: (p) => p.getByRole('button', { name: /^Mark Kabir Mehta/ }).click().then(() => p.waitForSelector('role=alertdialog')) },
  { name: 'pauses-cancel-confirm', path: '/student-pauses', signedIn: true, ready: 'text=Kabir Mehta', then: (p) => p.getByRole('button', { name: /^Cancel pause of Kabir Mehta/ }).click().then(() => p.waitForSelector('role=alertdialog')) },
  { name: 'pauses-empty', path: '/student-pauses', signedIn: true, pauses: 'empty', ready: 'text=No pauses yet' },
  { name: 'pauses-error', path: '/student-pauses', signedIn: true, pauses: 'error', ready: 'text=could not be loaded' },
  { name: 'alumni', path: '/alumni', signedIn: true, ready: 'text=Farid Khan' },
  { name: 'alumni-detail-transferred', path: '/alumni', signedIn: true, ready: 'text=Farid Khan', then: (p) => p.getByRole('button', { name: /^View details of Tara Nair/ }).click().then(() => p.waitForSelector('[data-testid=alumni-detail]')) },
  { name: 'alumni-detail-graduated', path: '/alumni', signedIn: true, ready: 'text=Farid Khan', then: (p) => p.getByRole('button', { name: /^View details of Farid Khan/ }).click().then(() => p.waitForSelector('[data-testid=alumni-detail]')) },
  { name: 'alumni-detail-unknown-date', path: '/alumni', signedIn: true, ready: 'text=Farid Khan', then: (p) => p.getByRole('button', { name: /^View details of Manu Joshi/ }).click().then(() => p.waitForSelector('[data-testid=alumni-detail]')) },
  { name: 'alumni-empty', path: '/alumni', signedIn: true, alumni: 'empty', ready: 'text=No alumni yet' },
  { name: 'alumni-error', path: '/alumni', signedIn: true, alumni: 'error', ready: 'text=could not be loaded' },
  { name: 'transfer-certificate', full: true, path: '/transfers/t3/certificate', signedIn: true, ready: 'role=heading[name="Transfer Certificate"]' },
  { name: 'transfer-certificate-print', full: true, path: '/transfers/t3/certificate', signedIn: true, print: true, a4: true, ready: 'role=heading[name="Transfer Certificate"]' },
  { name: 'transfer-certificate-not-completed', path: '/transfers/t1/certificate', signedIn: true, transfers: 'notcompleted', ready: 'text=No certificate yet' },
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
const only = process.env.UI_ONLY ? new RegExp(process.env.UI_ONLY) : null;
for (const s of screens) {
  if (only && !only.test(s.name)) continue;
  for (const size of sizes) {
    const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    approvalsEmpty = Boolean(s.empty);
    insightsMode = s.insights ?? 'ready';
    promoMode = s.promo ?? 'off';
    rolloverMode = s.rollover ?? 'off';
    transfersMode = s.transfers ?? 'ready';
    electivesMode = s.electives ?? 'ready';
    pausesMode = s.pauses ?? 'ready';
    alumniMode = s.alumni ?? 'ready';
    handoverDenied = Boolean(s.denied);
    await mockApi(page, s.signedIn, s.mfa);
    await page.goto(BASE + s.path);
    await page.waitForSelector(s.ready);
    if (s.then) await s.then(page);
    if (s.print) await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(400);
    const file = `${OUT}/${s.name}-${size.name}.png`;
    await page.screenshot({ path: file, fullPage: Boolean(s.full) });
    if (s.a4 && size.name === 'desktop') await page.pdf({ path: `${OUT}/${s.name}.pdf`, preferCSSPageSize: true });
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    const issues = axe.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length }));
    serious += issues.filter((i) => i.impact === 'serious' || i.impact === 'critical').length;
    report.push({ screen: s.name, size: size.name, file, issues });
    if (process.env.UI_DETAIL) for (const v of axe.violations) for (const n of v.nodes) console.log('  ', v.id, n.html.slice(0, 160), n.any[0]?.message?.slice(0, 160));
    console.log(`${s.name}/${size.name}: ${issues.length ? issues.map((i) => `${i.impact} ${i.id} (${i.nodes})`).join(', ') : 'no accessibility issues'}`);
    await ctx.close();
  }
}
await browser.close();
writeFileSync(`${OUT}/axe-report.json`, JSON.stringify(report, null, 2));
console.log(`\n${report.length} screenshots in ${OUT}/. Serious or critical accessibility issues: ${serious}.`);
process.exit(serious > 0 ? 1 : 0);
