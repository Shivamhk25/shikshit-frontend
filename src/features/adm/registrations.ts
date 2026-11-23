import { createElement } from 'react';
import type { CrudDescriptor, FormValues } from '../../crud/descriptor';
import { admitHref } from './admissions';
import { formatDate, STATUSES as ENQUIRY_STATUSES, type Enquiry } from './enquiries';

export type RegistrationStatus = 'submitted' | 'under_review' | 'accepted' | 'rejected' | 'withdrawn';

export interface Registration {
  id: string;
  applicationNumber: string;
  appliedOn: string;
  firstName: string;
  middleName: string | null;
  lastName: string | null;
  fullName: string;
  dateOfBirth: string;
  gender: string | null;
  fatherName: string | null;
  motherName: string | null;
  guardianName: string | null;
  guardianPhone: string;
  siblingStudentCode: string | null;
  classId: string;
  classCode: string;
  className: string;
  sectionId: string | null;
  sectionName: string | null;
  yearId: string;
  yearName: string;
  status: RegistrationStatus;
  enquiryId: string | null;
  enquiryCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export const REGISTRATION_STATUSES: { value: RegistrationStatus; label: string }[] = [
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under review' },
  { value: 'accepted', label: 'Accepted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

export const GENDERS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
];

const statusLabel = (v: string) => REGISTRATION_STATUSES.find((s) => s.value === v)?.label ?? v;
const genderLabel = (v: string | null) => GENDERS.find((g) => g.value === v)?.label ?? '—';
const text = (v: string | number | boolean | undefined) => String(v ?? '').trim();
const orNull = (v: string | number | boolean | undefined) => text(v) || null;

/** Today's date in the browser's own calendar, as YYYY-MM-DD: the day a new application is taken. */
export function today(now: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`;
}

/** ADM-06 Student Registrations. Everything the page does comes from this descriptor. */
export const registrationsDescriptor: CrudDescriptor<Registration> = {
  singular: 'registration',
  title: 'Registrations',
  endpoint: '/student-registrations',
  permissions: { view: 'adm.student_registrations.view', create: 'adm.student_registrations.create', edit: 'adm.student_registrations.edit', delete: 'adm.student_registrations.delete' },
  defaultSort: '-appliedOn',
  searchPlaceholder: 'Search by number, name or phone',
  label: (r) => `${r.applicationNumber} · ${r.fullName}`,
  filters: [
    { key: 'status', label: 'Status', kind: 'select', options: REGISTRATION_STATUSES },
    { key: 'classId', label: 'Class', kind: 'select', remote: { endpoint: '/classes', value: 'id', label: 'name' } },
    { key: 'yearId', label: 'Academic year', kind: 'select', remote: { endpoint: '/academic-years', value: 'id', label: 'name' } },
  ],
  rowLinks: [
    {
      key: 'admit',
      label: 'Admit',
      permission: 'adm.admissions.create',
      visible: (r) => r.status === 'accepted',
      href: (r) => admitHref(r.id),
    },
  ],
  columns: [
    { key: 'applicationNumber', label: 'App. no.', sort: 'applicationNumber' },
    { key: 'fullName', label: 'Applicant', sort: 'applicant' },
    { key: 'className', label: 'Class', render: (r) => (r.sectionName ? `${r.className}\u00a0·\u00a0${r.sectionName}` : r.className) },
    { key: 'gender', label: 'Gender', render: (r) => genderLabel(r.gender) },
    { key: 'appliedOn', label: 'Applied on', sort: 'appliedOn', render: (r) => formatDate(r.appliedOn) },
    { key: 'yearName', label: 'Academic year' },
    { key: 'status', label: 'Status', sort: 'status', render: (r) => statusLabel(r.status) },
  ],
  fields: [
    { key: 'appliedOn', label: 'Applied on', kind: 'date', required: true, defaultValue: () => today() },
    { key: 'firstName', label: 'First name', kind: 'text', required: true, maxLength: 100 },
    { key: 'middleName', label: 'Middle name', kind: 'text', maxLength: 100 },
    { key: 'lastName', label: 'Last name', kind: 'text', maxLength: 100 },
    { key: 'dateOfBirth', label: 'Date of birth', kind: 'date', required: true },
    { key: 'gender', label: 'Gender', kind: 'select', options: GENDERS, hint: 'Can stay blank until admission.' },
    { key: 'yearId', label: 'Academic year', kind: 'select', required: true, remote: { endpoint: '/academic-years', value: 'id', label: 'name' } },
    { key: 'classId', label: 'Class', kind: 'select', required: true, remote: { endpoint: '/classes', value: 'id', label: 'name' } },
    { key: 'sectionId', label: 'Section', kind: 'select', hint: 'Optional. Sections are usually allocated later.', remote: { endpoint: '/sections', value: 'id', label: 'name' } },
    { key: 'fatherName', label: 'Father’s name', kind: 'text', maxLength: 150 },
    { key: 'motherName', label: 'Mother’s name', kind: 'text', maxLength: 150 },
    { key: 'guardianName', label: 'Guardian’s name', kind: 'text', maxLength: 150 },
    { key: 'guardianPhone', label: 'Guardian’s phone', kind: 'text', required: true, maxLength: 20 },
    { key: 'siblingStudentCode', label: 'Sibling’s student code', kind: 'text', maxLength: 30, hint: 'The code of a brother or sister who already studies here.' },
    { key: 'status', label: 'Status', kind: 'select', required: true, defaultValue: 'submitted', options: REGISTRATION_STATUSES },
  ],
  editExtra: (r) =>
    createElement('p', { className: 'text-sm text-fg-muted', 'data-testid': 'registration-number' }, `Application number ${r.applicationNumber}${r.enquiryCode ? ` · from enquiry ${r.enquiryCode}` : ''}`),
  toForm: (r): FormValues => ({
    appliedOn: r.appliedOn,
    firstName: r.firstName,
    middleName: r.middleName ?? '',
    lastName: r.lastName ?? '',
    dateOfBirth: r.dateOfBirth,
    gender: r.gender ?? '',
    yearId: r.yearId,
    classId: r.classId,
    sectionId: r.sectionId ?? '',
    fatherName: r.fatherName ?? '',
    motherName: r.motherName ?? '',
    guardianName: r.guardianName ?? '',
    guardianPhone: r.guardianPhone,
    siblingStudentCode: r.siblingStudentCode ?? '',
    status: r.status,
  }),
  toInput: (v) => ({
    appliedOn: text(v.appliedOn),
    firstName: text(v.firstName),
    middleName: orNull(v.middleName),
    lastName: orNull(v.lastName),
    dateOfBirth: text(v.dateOfBirth),
    gender: orNull(v.gender),
    fatherName: orNull(v.fatherName),
    motherName: orNull(v.motherName),
    guardianName: orNull(v.guardianName),
    guardianPhone: text(v.guardianPhone),
    siblingStudentCode: orNull(v.siblingStudentCode),
    classId: text(v.classId),
    sectionId: orNull(v.sectionId),
    yearId: text(v.yearId),
    status: text(v.status) || 'submitted',
  }),
};

/**
 * The enquiries descriptor with a "Register" action on each open enquiry. It is added here, not in the enquiries
 * file, so the two screens stay independent: registering needs `adm.student_registrations.create` on top of the
 * enquiries the page already lets the person see.
 */
export function enquiriesWithRegister(base: CrudDescriptor<Enquiry>): CrudDescriptor<Enquiry> {
  const open = new Set(ENQUIRY_STATUSES.filter((s) => s.value !== 'converted' && s.value !== 'closed').map((s) => s.value));
  return {
    ...base,
    rowActions: [
      {
        key: 'register',
        label: 'Register',
        permission: 'adm.student_registrations.create',
        visible: (r) => open.has(r.status),
        endpoint: (r) => `/enquiries/${encodeURIComponent(r.id)}/register`,
        confirm: (r) => ({
          title: `Register ${r.childName}?`,
          body: 'This creates a registration from the enquiry (child, class, year and parent details) and marks the enquiry as converted. An enquiry can be registered once.',
        }),
        success: (res) => `Registered as ${String(res.applicationNumber ?? 'a new registration')}.`,
      },
    ],
  };
}
