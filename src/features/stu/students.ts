import { createElement, Fragment } from 'react';
import type { ColumnDef, CrudDescriptor, FieldDef, FormValues } from '../../crud/descriptor';
import { formatDate, orNull, text } from '../aca/structure';
import { StudentDocuments } from './StudentDocuments';
import { StudentPhoto } from './StudentPhoto';

/** Descriptors for Students, Enrollments, Guardians, Student guardians and Student addresses. These are children's records: the server audits every read. */

const dash = (v: string | null | undefined) => (v && v.trim() ? v : '—');
const yesNo = (v: boolean) => (v ? 'Yes' : 'No');
const studentPicker: FieldDef = { key: 'studentId', label: 'Student', kind: 'select', required: true, remote: { endpoint: '/students', value: 'id', label: 'fullName', detail: 'registrationCode', search: true } };

export const GENDERS = [
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'other', label: 'Other' },
];
export const STUDENT_STATUSES = [
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'transferred', label: 'Transferred' },
  { value: 'alumni', label: 'Alumni' },
];
export const ENROLLMENT_STATUSES = [
  { value: 'enrolled', label: 'Enrolled' },
  { value: 'withdrawn', label: 'Withdrawn' },
  { value: 'completed', label: 'Completed' },
];
export const RELATIONS = [
  { value: 'mother', label: 'Mother' },
  { value: 'father', label: 'Father' },
  { value: 'guardian', label: 'Guardian' },
  { value: 'grandparent', label: 'Grandparent' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'other', label: 'Other' },
];
export const ADDRESS_KINDS = [
  { value: 'home', label: 'Home' },
  { value: 'mailing', label: 'Mailing' },
];
const labelOf = (options: { value: string; label: string }[], v: string) => options.find((o) => o.value === v)?.label ?? v;

// ---- students

export interface Student {
  id: string;
  registrationCode: string;
  firstName: string;
  middleName: string | null;
  lastName: string | null;
  fullName: string;
  gender: string;
  dateOfBirth: string;
  admissionDate: string | null;
  mobile: string | null;
  parentEmail: string | null;
  studentEmail: string | null;
  apaarId: string | null;
  status: string;
  remarks: string | null;
  currentClassName: string | null;
  currentSectionName: string | null;
  currentRollNumber: string | null;
}

export const studentsDescriptor: CrudDescriptor<Student> = {
  singular: 'student',
  title: 'Students',
  endpoint: '/students',
  permissions: { view: 'stu.students.view', create: 'stu.students.create', edit: 'stu.students.edit', delete: 'stu.students.delete' },
  editExtra: (row) => createElement(Fragment, null, createElement(StudentPhoto, { studentId: row.id, name: row.fullName }), createElement(StudentDocuments, { studentId: row.id })),
  defaultSort: 'fullName',
  searchPlaceholder: 'Search by name, code, mobile or APAAR ID',
  label: (r) => `${r.fullName} (${r.registrationCode})`,
  columns: [
    { key: 'registrationCode', label: 'Code', sort: 'registrationCode' },
    { key: 'fullName', label: 'Student', sort: 'fullName' },
    { key: 'class', label: 'Class', render: (r) => (r.currentClassName ? `${r.currentClassName} ${r.currentSectionName ?? ''}`.trim() : '—') },
    { key: 'roll', label: 'Roll no.', render: (r) => dash(r.currentRollNumber) },
    { key: 'gender', label: 'Gender', render: (r) => labelOf(GENDERS, r.gender) },
    { key: 'dateOfBirth', label: 'Born', sort: 'dateOfBirth', render: (r) => formatDate(r.dateOfBirth) },
    { key: 'status', label: 'Status', render: (r) => labelOf(STUDENT_STATUSES, r.status) },
  ] as ColumnDef<Student>[],
  fields: [
    { key: 'registrationCode', label: 'Registration code', kind: 'text', required: true, maxLength: 30 },
    { key: 'firstName', label: 'First name', kind: 'text', required: true, maxLength: 100 },
    { key: 'middleName', label: 'Middle name', kind: 'text', maxLength: 100 },
    { key: 'lastName', label: 'Last name', kind: 'text', maxLength: 100 },
    { key: 'gender', label: 'Gender', kind: 'select', required: true, options: GENDERS },
    { key: 'dateOfBirth', label: 'Date of birth', kind: 'date', required: true, hint: 'Not in the future, and not more than 30 years ago.' },
    { key: 'admissionDate', label: 'Admission date', kind: 'date' },
    { key: 'mobile', label: 'Mobile', kind: 'text', maxLength: 20, hint: 'The number the school messages first.' },
    { key: 'parentEmail', label: 'Parent email', kind: 'text', maxLength: 254 },
    { key: 'studentEmail', label: 'Student email', kind: 'text', maxLength: 254 },
    { key: 'apaarId', label: 'APAAR ID', kind: 'text', maxLength: 12, hint: '12 digits.' },
    { key: 'status', label: 'Status', kind: 'select', required: true, defaultValue: 'active', options: STUDENT_STATUSES },
    { key: 'remarks', label: 'Remarks', kind: 'textarea', maxLength: 500 },
  ],
  toForm: (r): FormValues => ({
    registrationCode: r.registrationCode, firstName: r.firstName, middleName: r.middleName ?? '', lastName: r.lastName ?? '', gender: r.gender, dateOfBirth: r.dateOfBirth,
    admissionDate: r.admissionDate ?? '', mobile: r.mobile ?? '', parentEmail: r.parentEmail ?? '', studentEmail: r.studentEmail ?? '', apaarId: r.apaarId ?? '', status: r.status, remarks: r.remarks ?? '',
  }),
  toInput: (v) => ({
    registrationCode: text(v.registrationCode), firstName: text(v.firstName), middleName: orNull(v.middleName), lastName: orNull(v.lastName), gender: text(v.gender), dateOfBirth: text(v.dateOfBirth),
    admissionDate: orNull(v.admissionDate), mobile: orNull(v.mobile), parentEmail: orNull(v.parentEmail), studentEmail: orNull(v.studentEmail), apaarId: orNull(v.apaarId),
    status: text(v.status) || 'active', remarks: orNull(v.remarks),
  }),
};

// ---- enrollments

export interface Enrollment {
  id: string;
  studentId: string;
  registrationCode: string;
  studentName: string;
  yearId: string;
  yearName: string;
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string;
  rollNumber: string | null;
  enrollmentNumber: string | null;
  enrollmentDate: string | null;
  status: string;
}

export const enrollmentsDescriptor: CrudDescriptor<Enrollment> = {
  singular: 'enrollment',
  title: 'Enrollments',
  endpoint: '/student-enrollments',
  permissions: { view: 'stu.students.view', create: 'stu.students.create', edit: 'stu.students.edit', delete: 'stu.students.delete' },
  defaultSort: 'className,sectionName,studentName',
  searchPlaceholder: 'Search by student, code or roll number',
  label: (r) => `${r.studentName} in ${r.className} ${r.sectionName} (${r.yearName})`,
  columns: [
    { key: 'yearName', label: 'Year' },
    { key: 'studentName', label: 'Student', sort: 'studentName', render: (r) => `${r.studentName} (${r.registrationCode})` },
    { key: 'className', label: 'Class', sort: 'className' },
    { key: 'sectionName', label: 'Section', sort: 'sectionName' },
    { key: 'rollNumber', label: 'Roll no.', sort: 'rollNumber', render: (r) => dash(r.rollNumber) },
    { key: 'status', label: 'Status', render: (r) => labelOf(ENROLLMENT_STATUSES, r.status) },
  ] as ColumnDef<Enrollment>[],
  fields: [
    studentPicker,
    { key: 'yearId', label: 'Academic year', kind: 'select', required: true, remote: { endpoint: '/academic-years', value: 'id', label: 'name' } },
    { key: 'classId', label: 'Class', kind: 'select', required: true, remote: { endpoint: '/classes', value: 'id', label: 'name' } },
    { key: 'sectionId', label: 'Section', kind: 'select', required: true, hint: 'Must already be mapped to the class for this year.', remote: { endpoint: '/sections', value: 'id', label: 'name' } },
    { key: 'rollNumber', label: 'Roll number', kind: 'text', maxLength: 20 },
    { key: 'enrollmentNumber', label: 'Enrollment number', kind: 'text', maxLength: 30 },
    { key: 'enrollmentDate', label: 'Enrollment date', kind: 'date' },
    { key: 'status', label: 'Status', kind: 'select', required: true, defaultValue: 'enrolled', options: ENROLLMENT_STATUSES },
  ],
  toForm: (r): FormValues => ({
    studentId: r.studentId, yearId: r.yearId, classId: r.classId, sectionId: r.sectionId, rollNumber: r.rollNumber ?? '', enrollmentNumber: r.enrollmentNumber ?? '',
    enrollmentDate: r.enrollmentDate ?? '', status: r.status,
  }),
  toInput: (v) => ({
    studentId: text(v.studentId), yearId: text(v.yearId), classId: text(v.classId), sectionId: text(v.sectionId), rollNumber: orNull(v.rollNumber),
    enrollmentNumber: orNull(v.enrollmentNumber), enrollmentDate: orNull(v.enrollmentDate), status: text(v.status) || 'enrolled',
  }),
};

// ---- guardians

export interface Guardian {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  studentCount: number;
}

export const guardiansDescriptor: CrudDescriptor<Guardian> = {
  singular: 'guardian',
  title: 'Guardians',
  endpoint: '/guardians',
  permissions: { view: 'stu.students.view', create: 'stu.students.create', edit: 'stu.students.edit', delete: 'stu.students.delete' },
  defaultSort: 'name',
  searchPlaceholder: 'Search by name, phone or email',
  label: (r) => `${r.name} (${r.phone})`,
  columns: [
    { key: 'name', label: 'Name', sort: 'name' },
    { key: 'phone', label: 'Phone', sort: 'phone' },
    { key: 'email', label: 'Email', render: (r) => dash(r.email) },
    { key: 'studentCount', label: 'Students', render: (r) => String(r.studentCount) },
  ] as ColumnDef<Guardian>[],
  fields: [
    { key: 'name', label: 'Name', kind: 'text', required: true, maxLength: 150 },
    { key: 'phone', label: 'Phone', kind: 'text', required: true, maxLength: 20 },
    { key: 'email', label: 'Email', kind: 'text', maxLength: 254 },
  ],
  toForm: (r): FormValues => ({ name: r.name, phone: r.phone, email: r.email ?? '' }),
  toInput: (v) => ({ name: text(v.name), phone: text(v.phone), email: orNull(v.email) }),
};

// ---- student guardians

export interface StudentGuardian {
  id: string;
  studentId: string;
  registrationCode: string;
  studentName: string;
  guardianId: string;
  guardianName: string;
  guardianPhone: string;
  relation: string;
  isPrimary: boolean;
  isLegalCustody: boolean;
  canPickup: boolean;
}

export const studentGuardiansDescriptor: CrudDescriptor<StudentGuardian> = {
  singular: 'student guardian',
  title: 'Student guardians',
  endpoint: '/student-guardians',
  permissions: { view: 'stu.students.view', create: 'stu.students.create', edit: 'stu.students.edit', delete: 'stu.students.delete' },
  defaultSort: 'studentName,guardianName',
  searchPlaceholder: 'Search by student or guardian',
  label: (r) => `${r.guardianName} for ${r.studentName}`,
  columns: [
    { key: 'studentName', label: 'Student', sort: 'studentName', render: (r) => `${r.studentName} (${r.registrationCode})` },
    { key: 'guardianName', label: 'Guardian', sort: 'guardianName', render: (r) => `${r.guardianName} (${r.guardianPhone})` },
    { key: 'relation', label: 'Relation', sort: 'relation', render: (r) => labelOf(RELATIONS, r.relation) },
    { key: 'isPrimary', label: 'Primary', render: (r) => yesNo(r.isPrimary) },
    { key: 'canPickup', label: 'May collect', render: (r) => yesNo(r.canPickup) },
  ] as ColumnDef<StudentGuardian>[],
  fields: [
    studentPicker,
    { key: 'guardianId', label: 'Guardian', kind: 'select', required: true, remote: { endpoint: '/guardians', value: 'id', label: 'name', detail: 'phone', search: true } },
    { key: 'relation', label: 'Relation', kind: 'select', required: true, options: RELATIONS },
    { key: 'isPrimary', label: 'Primary guardian', kind: 'checkbox', defaultValue: false, hint: 'A student has at most one.' },
    { key: 'isLegalCustody', label: 'Has legal custody', kind: 'checkbox', defaultValue: false },
    { key: 'canPickup', label: 'May collect the child from school', kind: 'checkbox', defaultValue: true },
  ],
  toForm: (r): FormValues => ({ studentId: r.studentId, guardianId: r.guardianId, relation: r.relation, isPrimary: r.isPrimary, isLegalCustody: r.isLegalCustody, canPickup: r.canPickup }),
  toInput: (v) => ({ studentId: text(v.studentId), guardianId: text(v.guardianId), relation: text(v.relation), isPrimary: v.isPrimary === true, isLegalCustody: v.isLegalCustody === true, canPickup: v.canPickup === true }),
};

// ---- addresses

export interface StudentAddress {
  id: string;
  studentId: string;
  registrationCode: string;
  studentName: string;
  kind: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string | null;
  postcode: string | null;
  country: string;
}

export const addressesDescriptor: CrudDescriptor<StudentAddress> = {
  singular: 'address',
  title: 'Student addresses',
  endpoint: '/student-addresses',
  permissions: { view: 'stu.student_addresses.view', create: 'stu.student_addresses.create', edit: 'stu.student_addresses.edit', delete: 'stu.student_addresses.delete' },
  defaultSort: 'studentName,kind',
  searchPlaceholder: 'Search by student, city or postcode',
  label: (r) => `${labelOf(ADDRESS_KINDS, r.kind)} address of ${r.studentName}`,
  columns: [
    { key: 'studentName', label: 'Student', sort: 'studentName', render: (r) => `${r.studentName} (${r.registrationCode})` },
    { key: 'kind', label: 'Kind', sort: 'kind', render: (r) => labelOf(ADDRESS_KINDS, r.kind) },
    { key: 'line1', label: 'Address', render: (r) => [r.line1, r.line2].filter(Boolean).join(', ') },
    { key: 'city', label: 'City', sort: 'city' },
    { key: 'postcode', label: 'Postcode', render: (r) => dash(r.postcode) },
  ] as ColumnDef<StudentAddress>[],
  fields: [
    studentPicker,
    { key: 'kind', label: 'Kind', kind: 'select', required: true, options: ADDRESS_KINDS, hint: 'One of each kind per student.' },
    { key: 'line1', label: 'Address line 1', kind: 'text', required: true, maxLength: 200 },
    { key: 'line2', label: 'Address line 2', kind: 'text', maxLength: 200 },
    { key: 'city', label: 'City', kind: 'text', required: true, maxLength: 100 },
    { key: 'state', label: 'State', kind: 'text', maxLength: 100 },
    { key: 'postcode', label: 'Postcode', kind: 'text', maxLength: 10 },
    { key: 'country', label: 'Country', kind: 'text', required: true, maxLength: 100, defaultValue: 'India' },
  ],
  toForm: (r): FormValues => ({ studentId: r.studentId, kind: r.kind, line1: r.line1, line2: r.line2 ?? '', city: r.city, state: r.state ?? '', postcode: r.postcode ?? '', country: r.country }),
  toInput: (v) => ({ studentId: text(v.studentId), kind: text(v.kind), line1: text(v.line1), line2: orNull(v.line2), city: text(v.city), state: orNull(v.state), postcode: orNull(v.postcode), country: text(v.country) || 'India' }),
};
