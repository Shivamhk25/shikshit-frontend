import type { ColumnDef, CrudDescriptor, FieldDef, FormValues } from '../../crud/descriptor';

/** Descriptors for the academic structure: years, terms, classes, sections, subjects (ACA-15/16/20/21/22). */

const STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];
const text = (v: string | number | boolean | undefined) => String(v ?? '').trim();
const orNull = (v: string | number | boolean | undefined) => text(v) || null;
const intOrNull = (v: string | number | boolean | undefined) => (text(v) === '' ? null : Number(v));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 2026-04-01 -> 1 Apr 2026. A fixed table, not Intl, so the web and every device print the same text. */
export const formatDate = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  const month = m ? MONTHS[Number(m[2]) - 1] : undefined;
  return m && month ? `${Number(m[3])} ${month} ${m[1]}` : iso;
};

const statusColumn = <T extends { status: string }>(): ColumnDef<T> => ({ key: 'status', label: 'Status', render: (r) => (r.status === 'active' ? 'Active' : 'Inactive') });
const statusField: FieldDef = { key: 'status', label: 'Status', kind: 'select', required: true, defaultValue: 'active', options: STATUS_OPTIONS };

// ---- academic years

export interface AcademicYear {
  id: string;
  code: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  remarks: string | null;
  status: 'active' | 'inactive';
}

export const yearsDescriptor: CrudDescriptor<AcademicYear> = {
  singular: 'academic year',
  title: 'Academic years',
  endpoint: '/academic-years',
  permissions: { view: 'aca.academic_years.view', create: 'aca.academic_years.create', edit: 'aca.academic_years.edit', delete: 'aca.academic_years.delete' },
  defaultSort: '-startDate',
  searchPlaceholder: 'Search by code or name',
  label: (r) => r.name,
  columns: [
    { key: 'code', label: 'Code', sort: 'code' },
    { key: 'name', label: 'Name', sort: 'name' },
    { key: 'startDate', label: 'Starts', sort: 'startDate', render: (r) => formatDate(r.startDate) },
    { key: 'endDate', label: 'Ends', sort: 'endDate', render: (r) => formatDate(r.endDate) },
    { key: 'isCurrent', label: 'Current', render: (r) => (r.isCurrent ? 'Current' : '—') },
    statusColumn<AcademicYear>(),
  ],
  fields: [
    { key: 'code', label: 'Code', kind: 'text', required: true, maxLength: 20, hint: 'For example 2026-27.' },
    { key: 'name', label: 'Name', kind: 'text', required: true, maxLength: 100 },
    { key: 'startDate', label: 'Start date', kind: 'date', required: true },
    { key: 'endDate', label: 'End date', kind: 'date', required: true },
    { key: 'isCurrent', label: 'This is the current year', kind: 'checkbox', defaultValue: false },
    { key: 'remarks', label: 'Remarks', kind: 'textarea', maxLength: 500 },
    statusField,
  ],
  toForm: (r): FormValues => ({ code: r.code, name: r.name, startDate: r.startDate, endDate: r.endDate, isCurrent: r.isCurrent, remarks: r.remarks ?? '', status: r.status }),
  toInput: (v) => ({ code: text(v.code), name: text(v.name), startDate: text(v.startDate), endDate: text(v.endDate), isCurrent: v.isCurrent === true, remarks: orNull(v.remarks), status: text(v.status) || 'active' }),
};

// ---- academic terms

export interface AcademicTerm {
  id: string;
  yearId: string;
  yearName: string;
  code: string;
  title: string;
  startDate: string;
  endDate: string;
  days: number;
  color: string | null;
}

export const termsDescriptor: CrudDescriptor<AcademicTerm> = {
  singular: 'term',
  title: 'Terms',
  endpoint: '/academic-terms',
  permissions: { view: 'aca.academic_terms.view', create: 'aca.academic_terms.create', edit: 'aca.academic_terms.edit', delete: 'aca.academic_terms.delete' },
  defaultSort: 'startDate',
  searchPlaceholder: 'Search by code or title',
  label: (r) => `${r.title} (${r.yearName})`,
  columns: [
    { key: 'yearName', label: 'Academic year' },
    { key: 'code', label: 'Code', sort: 'code' },
    { key: 'title', label: 'Title', sort: 'title' },
    { key: 'startDate', label: 'Starts', sort: 'startDate', render: (r) => formatDate(r.startDate) },
    { key: 'endDate', label: 'Ends', sort: 'endDate', render: (r) => formatDate(r.endDate) },
    { key: 'days', label: 'Days' },
    { key: 'color', label: 'Colour', render: (r) => r.color ?? '—' },
  ],
  fields: [
    { key: 'yearId', label: 'Academic year', kind: 'select', required: true, remote: { endpoint: '/academic-years', value: 'id', label: 'name' } },
    { key: 'code', label: 'Code', kind: 'text', required: true, maxLength: 20, hint: 'Unique within the year.' },
    { key: 'title', label: 'Title', kind: 'text', required: true, maxLength: 100 },
    { key: 'startDate', label: 'Start date', kind: 'date', required: true, hint: 'Inside the academic year.' },
    { key: 'endDate', label: 'End date', kind: 'date', required: true, hint: 'Terms of one year cannot overlap.' },
    { key: 'color', label: 'Colour', kind: 'text', maxLength: 7, hint: 'Optional, like #2F5BFF.' },
  ],
  toForm: (r): FormValues => ({ yearId: r.yearId, code: r.code, title: r.title, startDate: r.startDate, endDate: r.endDate, color: r.color ?? '' }),
  toInput: (v) => ({ yearId: text(v.yearId), code: text(v.code), title: text(v.title), startDate: text(v.startDate), endDate: text(v.endDate), color: orNull(v.color) }),
};

// ---- classes

export interface SchoolClass {
  id: string;
  code: string;
  name: string;
  displayOrder: number;
  youngestAgeMonths: number | null;
  oldestAgeMonths: number | null;
  description: string | null;
  status: 'active' | 'inactive';
}

export const classesDescriptor: CrudDescriptor<SchoolClass> = {
  singular: 'class',
  title: 'Classes',
  endpoint: '/classes',
  permissions: { view: 'aca.classes.view', create: 'aca.classes.create', edit: 'aca.classes.edit', delete: 'aca.classes.delete' },
  defaultSort: 'displayOrder',
  searchPlaceholder: 'Search by code or name',
  label: (r) => r.name,
  columns: [
    { key: 'code', label: 'Code', sort: 'code' },
    { key: 'name', label: 'Name', sort: 'name' },
    { key: 'displayOrder', label: 'Order', sort: 'displayOrder' },
    { key: 'youngestAgeMonths', label: 'Youngest (months)', sort: 'youngestAgeMonths', render: (r) => (r.youngestAgeMonths === null ? '—' : String(r.youngestAgeMonths)) },
    statusColumn<SchoolClass>(),
  ],
  fields: [
    { key: 'code', label: 'Code', kind: 'text', required: true, maxLength: 20 },
    { key: 'name', label: 'Name', kind: 'text', required: true, maxLength: 100 },
    { key: 'displayOrder', label: 'Display order', kind: 'number', required: true, min: 0, max: 100000, defaultValue: 0 },
    { key: 'youngestAgeMonths', label: 'Youngest age (months)', kind: 'number', min: 0, max: 600 },
    { key: 'oldestAgeMonths', label: 'Oldest age (months)', kind: 'number', min: 0, max: 600 },
    { key: 'description', label: 'Description', kind: 'textarea', maxLength: 500 },
    statusField,
  ],
  toForm: (r): FormValues => ({
    code: r.code,
    name: r.name,
    displayOrder: r.displayOrder,
    youngestAgeMonths: r.youngestAgeMonths ?? '',
    oldestAgeMonths: r.oldestAgeMonths ?? '',
    description: r.description ?? '',
    status: r.status,
  }),
  toInput: (v) => ({
    code: text(v.code),
    name: text(v.name),
    displayOrder: Number(v.displayOrder || 0),
    youngestAgeMonths: intOrNull(v.youngestAgeMonths),
    oldestAgeMonths: intOrNull(v.oldestAgeMonths),
    description: orNull(v.description),
    status: text(v.status) || 'active',
  }),
};

// ---- sections

export interface Section {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  description: string | null;
  status: 'active' | 'inactive';
}

export const sectionsDescriptor: CrudDescriptor<Section> = {
  singular: 'section',
  title: 'Sections',
  endpoint: '/sections',
  permissions: { view: 'aca.sections.view', create: 'aca.sections.create', edit: 'aca.sections.edit', delete: 'aca.sections.delete' },
  defaultSort: 'name',
  searchPlaceholder: 'Search by code or name',
  label: (r) => r.name,
  columns: [
    { key: 'code', label: 'Code', sort: 'code' },
    { key: 'name', label: 'Name', sort: 'name' },
    { key: 'shortName', label: 'Short name', render: (r) => r.shortName ?? '—' },
    statusColumn<Section>(),
  ],
  fields: [
    { key: 'code', label: 'Code', kind: 'text', required: true, maxLength: 20 },
    { key: 'name', label: 'Name', kind: 'text', required: true, maxLength: 100 },
    { key: 'shortName', label: 'Short name', kind: 'text', maxLength: 20 },
    { key: 'description', label: 'Description', kind: 'textarea', maxLength: 500 },
    statusField,
  ],
  toForm: (r): FormValues => ({ code: r.code, name: r.name, shortName: r.shortName ?? '', description: r.description ?? '', status: r.status }),
  toInput: (v) => ({ code: text(v.code), name: text(v.name), shortName: orNull(v.shortName), description: orNull(v.description), status: text(v.status) || 'active' }),
};

// ---- subjects

export interface Subject {
  id: string;
  code: string;
  name: string;
  shortName: string | null;
  color: string | null;
  category: string;
  area: string;
  scholastic: boolean;
  coScholastic: boolean;
  nonScholastic: boolean;
  credits: number;
  description: string | null;
  status: 'active' | 'inactive';
}

export const subjectsDescriptor: CrudDescriptor<Subject> = {
  singular: 'subject',
  title: 'Subjects',
  endpoint: '/subjects',
  permissions: { view: 'aca.subjects.view', create: 'aca.subjects.create', edit: 'aca.subjects.edit', delete: 'aca.subjects.delete' },
  defaultSort: 'name',
  searchPlaceholder: 'Search by code, name or short name',
  label: (r) => r.name,
  columns: [
    { key: 'code', label: 'Code', sort: 'code' },
    { key: 'name', label: 'Name', sort: 'name' },
    { key: 'category', label: 'Category', sort: 'category' },
    { key: 'area', label: 'Area', sort: 'area' },
    { key: 'credits', label: 'Credits', sort: 'credits' },
    statusColumn<Subject>(),
  ],
  fields: [
    { key: 'code', label: 'Code', kind: 'text', required: true, maxLength: 20 },
    { key: 'name', label: 'Name', kind: 'text', required: true, maxLength: 100 },
    { key: 'shortName', label: 'Short name', kind: 'text', maxLength: 20 },
    { key: 'color', label: 'Colour', kind: 'text', maxLength: 7, hint: 'Optional, like #2F5BFF.' },
    { key: 'category', label: 'Category', kind: 'text', required: true, maxLength: 50 },
    { key: 'area', label: 'Area', kind: 'text', required: true, maxLength: 50 },
    { key: 'scholastic', label: 'Scholastic', kind: 'checkbox', defaultValue: false },
    { key: 'coScholastic', label: 'Co-scholastic', kind: 'checkbox', defaultValue: false },
    { key: 'nonScholastic', label: 'Non-scholastic', kind: 'checkbox', defaultValue: false },
    { key: 'credits', label: 'Credits', kind: 'number', required: true, min: 0, max: 99.9, step: 0.5, defaultValue: 0 },
    { key: 'description', label: 'Description', kind: 'textarea', maxLength: 500 },
    statusField,
  ],
  toForm: (r): FormValues => ({
    code: r.code,
    name: r.name,
    shortName: r.shortName ?? '',
    color: r.color ?? '',
    category: r.category,
    area: r.area,
    scholastic: r.scholastic,
    coScholastic: r.coScholastic,
    nonScholastic: r.nonScholastic,
    credits: r.credits,
    description: r.description ?? '',
    status: r.status,
  }),
  toInput: (v) => ({
    code: text(v.code),
    name: text(v.name),
    shortName: orNull(v.shortName),
    color: orNull(v.color),
    category: text(v.category),
    area: text(v.area),
    scholastic: v.scholastic === true,
    coScholastic: v.coScholastic === true,
    nonScholastic: v.nonScholastic === true,
    credits: Number(v.credits || 0),
    description: orNull(v.description),
    status: text(v.status) || 'active',
  }),
};
