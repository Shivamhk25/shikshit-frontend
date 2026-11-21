import type { ColumnDef, CrudDescriptor, FieldDef, FormValues } from '../../crud/descriptor';
import { STATUS_OPTIONS, formatDate, intOrNull, orNull, text } from './structure';

/** Descriptors for ACA-18 School Divisions, ACA-11 Campuses, ACA-17 Holidays, ACA-29 Academic Calendar, ACA-10 Elective Groups. */

const statusField: FieldDef = { key: 'status', label: 'Status', kind: 'select', required: true, defaultValue: 'active', options: STATUS_OPTIONS };
const statusColumn = <T extends { status: string }>(): ColumnDef<T> => ({ key: 'status', label: 'Status', render: (r) => (r.status === 'active' ? 'Active' : 'Inactive') });
const yesNo = (v: boolean) => (v ? 'Yes' : 'No');
const floatOrNull = (v: string | number | boolean | undefined) => (text(v) === '' ? null : Number(v));

// ---- school divisions

export interface SchoolDivision {
  id: string;
  code: string;
  name: string;
  displayOrder: number;
  description: string | null;
  status: 'active' | 'inactive';
}

export const divisionsDescriptor: CrudDescriptor<SchoolDivision> = {
  singular: 'division',
  title: 'School divisions',
  endpoint: '/school-divisions',
  permissions: { view: 'aca.school_divisions.view', create: 'aca.school_divisions.create', edit: 'aca.school_divisions.edit', delete: 'aca.school_divisions.delete' },
  defaultSort: 'displayOrder',
  searchPlaceholder: 'Search by code or name',
  label: (r) => r.name,
  columns: [
    { key: 'code', label: 'Code', sort: 'code' },
    { key: 'name', label: 'Name', sort: 'name' },
    { key: 'displayOrder', label: 'Order', sort: 'displayOrder' },
    statusColumn<SchoolDivision>(),
  ],
  fields: [
    { key: 'code', label: 'Code', kind: 'text', required: true, maxLength: 20 },
    { key: 'name', label: 'Name', kind: 'text', required: true, maxLength: 100 },
    { key: 'displayOrder', label: 'Display order', kind: 'number', required: true, min: 0, max: 100000, defaultValue: 0 },
    { key: 'description', label: 'Description', kind: 'textarea', maxLength: 500 },
    statusField,
  ],
  toForm: (r): FormValues => ({ code: r.code, name: r.name, displayOrder: r.displayOrder, description: r.description ?? '', status: r.status }),
  toInput: (v) => ({ code: text(v.code), name: text(v.name), displayOrder: Number(v.displayOrder || 0), description: orNull(v.description), status: text(v.status) || 'active' }),
};

// ---- campuses

export interface Campus {
  id: string;
  code: string | null;
  name: string;
  checkInRadiusM: number;
  latitude: number | null;
  longitude: number | null;
  staffDueIn: string | null;
  address: string | null;
  remarks: string | null;
  status: 'active' | 'inactive';
}

export const campusesDescriptor: CrudDescriptor<Campus> = {
  singular: 'campus',
  title: 'Campuses',
  endpoint: '/campuses',
  permissions: { view: 'aca.campuses.view', create: 'aca.campuses.create', edit: 'aca.campuses.edit', delete: 'aca.campuses.delete' },
  defaultSort: 'name',
  searchPlaceholder: 'Search by code, name or address',
  label: (r) => r.name,
  columns: [
    { key: 'code', label: 'Code', sort: 'code', render: (r) => r.code ?? '—' },
    { key: 'name', label: 'Name', sort: 'name' },
    { key: 'checkInRadiusM', label: 'Check-in circle', render: (r) => `${r.checkInRadiusM} m` },
    { key: 'staffDueIn', label: 'Staff due in', render: (r) => r.staffDueIn ?? 'School time' },
    { key: 'address', label: 'Address', render: (r) => r.address ?? '—' },
    { key: 'map', label: 'Map', render: (r) => (r.latitude === null || r.longitude === null ? '—' : `${r.latitude.toFixed(4)}, ${r.longitude.toFixed(4)}`) },
    statusColumn<Campus>(),
  ],
  fields: [
    { key: 'name', label: 'Name', kind: 'text', required: true, maxLength: 100 },
    { key: 'code', label: 'Code', kind: 'text', maxLength: 20 },
    { key: 'checkInRadiusM', label: 'Check-in circle radius (metres)', kind: 'number', required: true, min: 10, max: 5000, defaultValue: 200 },
    { key: 'latitude', label: 'Latitude', kind: 'number', min: -90, max: 90, step: 0.000001, hint: 'Enter both latitude and longitude, or neither.' },
    { key: 'longitude', label: 'Longitude', kind: 'number', min: -180, max: 180, step: 0.000001 },
    { key: 'staffDueIn', label: 'Staff due in', kind: 'text', maxLength: 5, hint: 'HH:MM, only if different from the school.' },
    { key: 'address', label: 'Address', kind: 'textarea', maxLength: 300 },
    { key: 'remarks', label: 'Remarks', kind: 'textarea', maxLength: 500 },
    statusField,
  ],
  toForm: (r): FormValues => ({
    name: r.name,
    code: r.code ?? '',
    checkInRadiusM: r.checkInRadiusM,
    latitude: r.latitude ?? '',
    longitude: r.longitude ?? '',
    staffDueIn: r.staffDueIn ?? '',
    address: r.address ?? '',
    remarks: r.remarks ?? '',
    status: r.status,
  }),
  toInput: (v) => ({
    name: text(v.name),
    code: orNull(v.code),
    checkInRadiusM: Number(v.checkInRadiusM),
    latitude: floatOrNull(v.latitude),
    longitude: floatOrNull(v.longitude),
    staffDueIn: orNull(v.staffDueIn),
    address: orNull(v.address),
    remarks: orNull(v.remarks),
    status: text(v.status) || 'active',
  }),
};

// ---- holidays

export const HOLIDAY_TYPES = [
  { value: 'public', label: 'Public' },
  { value: 'school', label: 'School' },
  { value: 'regional', label: 'Regional' },
  { value: 'restricted', label: 'Restricted' },
  { value: 'other', label: 'Other' },
];

export interface Holiday {
  id: string;
  yearId: string;
  yearName: string;
  title: string;
  holidayType: string;
  startDate: string;
  endDate: string;
  isOptional: boolean;
  isRecurringAnnual: boolean;
  applicableFor: string | null;
  description: string | null;
  status: 'active' | 'inactive';
}

export const holidaysDescriptor: CrudDescriptor<Holiday> = {
  singular: 'holiday',
  title: 'Holidays',
  endpoint: '/holidays',
  permissions: { view: 'aca.holiday_calendars.view', create: 'aca.holiday_calendars.create', edit: 'aca.holiday_calendars.edit', delete: 'aca.holiday_calendars.delete' },
  defaultSort: 'startDate',
  searchPlaceholder: 'Search by title',
  label: (r) => r.title,
  columns: [
    { key: 'yearName', label: 'Academic year' },
    { key: 'title', label: 'Title', sort: 'title' },
    { key: 'holidayType', label: 'Type', render: (r) => HOLIDAY_TYPES.find((t) => t.value === r.holidayType)?.label ?? r.holidayType },
    { key: 'startDate', label: 'Starts', sort: 'startDate', render: (r) => formatDate(r.startDate) },
    { key: 'endDate', label: 'Ends', sort: 'endDate', render: (r) => formatDate(r.endDate) },
    { key: 'isOptional', label: 'Optional', render: (r) => yesNo(r.isOptional) },
    statusColumn<Holiday>(),
  ],
  fields: [
    { key: 'yearId', label: 'Academic year', kind: 'select', required: true, remote: { endpoint: '/academic-years', value: 'id', label: 'name' } },
    { key: 'title', label: 'Title', kind: 'text', required: true, maxLength: 100 },
    { key: 'holidayType', label: 'Holiday type', kind: 'select', required: true, options: HOLIDAY_TYPES },
    { key: 'startDate', label: 'Start date', kind: 'date', required: true, hint: 'Inside the academic year unless it recurs every year.' },
    { key: 'endDate', label: 'End date', kind: 'date', required: true },
    { key: 'isOptional', label: 'Optional holiday', kind: 'checkbox', defaultValue: false },
    { key: 'isRecurringAnnual', label: 'Recurs every year', kind: 'checkbox', defaultValue: false },
    { key: 'applicableFor', label: 'Applicable for', kind: 'text', maxLength: 100 },
    { key: 'description', label: 'Description', kind: 'textarea', maxLength: 500 },
    statusField,
  ],
  toForm: (r): FormValues => ({
    yearId: r.yearId,
    title: r.title,
    holidayType: r.holidayType,
    startDate: r.startDate,
    endDate: r.endDate,
    isOptional: r.isOptional,
    isRecurringAnnual: r.isRecurringAnnual,
    applicableFor: r.applicableFor ?? '',
    description: r.description ?? '',
    status: r.status,
  }),
  toInput: (v) => ({
    yearId: text(v.yearId),
    title: text(v.title),
    holidayType: text(v.holidayType),
    startDate: text(v.startDate),
    endDate: text(v.endDate),
    isOptional: v.isOptional === true,
    isRecurringAnnual: v.isRecurringAnnual === true,
    applicableFor: orNull(v.applicableFor),
    description: orNull(v.description),
    status: text(v.status) || 'active',
  }),
};

// ---- academic calendar events

export const EVENT_TYPES = [
  { value: 'academic', label: 'Academic' },
  { value: 'exam', label: 'Exam' },
  { value: 'event', label: 'Event' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'activity', label: 'Activity' },
  { value: 'other', label: 'Other' },
];

export interface CalendarEvent {
  id: string;
  yearId: string;
  yearName: string;
  title: string;
  eventType: string;
  startDate: string;
  endDate: string;
  isAllDay: boolean;
  isInstructionalDay: boolean;
  isExaminationDay: boolean;
  venue: string | null;
  description: string | null;
  status: 'active' | 'inactive';
}

export const eventsDescriptor: CrudDescriptor<CalendarEvent> = {
  singular: 'event',
  title: 'Academic calendar',
  endpoint: '/calendar-events',
  permissions: { view: 'aca.academic_calendars.view', create: 'aca.academic_calendars.create', edit: 'aca.academic_calendars.edit', delete: 'aca.academic_calendars.delete' },
  defaultSort: 'startDate',
  searchPlaceholder: 'Search by title or venue',
  label: (r) => r.title,
  columns: [
    { key: 'yearName', label: 'Academic year' },
    { key: 'title', label: 'Title', sort: 'title' },
    { key: 'eventType', label: 'Type', render: (r) => EVENT_TYPES.find((t) => t.value === r.eventType)?.label ?? r.eventType },
    { key: 'startDate', label: 'Starts', sort: 'startDate', render: (r) => formatDate(r.startDate) },
    { key: 'endDate', label: 'Ends', sort: 'endDate', render: (r) => formatDate(r.endDate) },
    { key: 'isInstructionalDay', label: 'Classes held', render: (r) => yesNo(r.isInstructionalDay) },
    statusColumn<CalendarEvent>(),
  ],
  fields: [
    { key: 'yearId', label: 'Academic year', kind: 'select', required: true, remote: { endpoint: '/academic-years', value: 'id', label: 'name' } },
    { key: 'title', label: 'Title', kind: 'text', required: true, maxLength: 100 },
    { key: 'eventType', label: 'Event type', kind: 'select', required: true, options: EVENT_TYPES },
    { key: 'startDate', label: 'Start date', kind: 'date', required: true, hint: 'Inside the academic year.' },
    { key: 'endDate', label: 'End date', kind: 'date', required: true },
    { key: 'isAllDay', label: 'All day', kind: 'checkbox', defaultValue: true },
    { key: 'isInstructionalDay', label: 'Classes are held', kind: 'checkbox', defaultValue: false },
    { key: 'isExaminationDay', label: 'Examination day', kind: 'checkbox', defaultValue: false },
    { key: 'venue', label: 'Venue', kind: 'text', maxLength: 100 },
    { key: 'description', label: 'Description', kind: 'textarea', maxLength: 500 },
    statusField,
  ],
  toForm: (r): FormValues => ({
    yearId: r.yearId,
    title: r.title,
    eventType: r.eventType,
    startDate: r.startDate,
    endDate: r.endDate,
    isAllDay: r.isAllDay,
    isInstructionalDay: r.isInstructionalDay,
    isExaminationDay: r.isExaminationDay,
    venue: r.venue ?? '',
    description: r.description ?? '',
    status: r.status,
  }),
  toInput: (v) => ({
    yearId: text(v.yearId),
    title: text(v.title),
    eventType: text(v.eventType),
    startDate: text(v.startDate),
    endDate: text(v.endDate),
    isAllDay: v.isAllDay === true,
    isInstructionalDay: v.isInstructionalDay === true,
    isExaminationDay: v.isExaminationDay === true,
    venue: orNull(v.venue),
    description: orNull(v.description),
    status: text(v.status) || 'active',
  }),
};

// ---- elective groups

export interface ElectiveGroup {
  id: string;
  code: string | null;
  name: string;
  minSubjects: number;
  maxSubjects: number;
  enforceLimits: boolean;
  displayOrder: number;
  description: string | null;
  status: 'active' | 'inactive';
}

export const electivesDescriptor: CrudDescriptor<ElectiveGroup> = {
  singular: 'elective group',
  title: 'Elective groups',
  endpoint: '/elective-groups',
  permissions: { view: 'aca.elective_groups.view', create: 'aca.elective_groups.create', edit: 'aca.elective_groups.edit', delete: 'aca.elective_groups.delete' },
  defaultSort: 'displayOrder',
  searchPlaceholder: 'Search by code or name',
  label: (r) => r.name,
  columns: [
    { key: 'code', label: 'Code', sort: 'code', render: (r) => r.code ?? '—' },
    { key: 'name', label: 'Name', sort: 'name' },
    { key: 'minSubjects', label: 'Must take at least' },
    { key: 'maxSubjects', label: 'May take at most' },
    { key: 'enforceLimits', label: 'Enforced', render: (r) => yesNo(r.enforceLimits) },
    statusColumn<ElectiveGroup>(),
  ],
  fields: [
    { key: 'name', label: 'Name', kind: 'text', required: true, maxLength: 100 },
    { key: 'code', label: 'Code', kind: 'text', maxLength: 20 },
    { key: 'minSubjects', label: 'Must take at least', kind: 'number', required: true, min: 0, max: 50, defaultValue: 0 },
    { key: 'maxSubjects', label: 'May take at most', kind: 'number', required: true, min: 1, max: 50, defaultValue: 1, hint: 'Not below the minimum.' },
    { key: 'enforceLimits', label: 'Enforce the limits', kind: 'checkbox', defaultValue: true },
    { key: 'displayOrder', label: 'Display order', kind: 'number', min: 0, max: 100000, defaultValue: 0 },
    { key: 'description', label: 'Description', kind: 'textarea', maxLength: 500 },
    statusField,
  ],
  toForm: (r): FormValues => ({
    name: r.name,
    code: r.code ?? '',
    minSubjects: r.minSubjects,
    maxSubjects: r.maxSubjects,
    enforceLimits: r.enforceLimits,
    displayOrder: r.displayOrder,
    description: r.description ?? '',
    status: r.status,
  }),
  toInput: (v) => ({
    name: text(v.name),
    code: orNull(v.code),
    minSubjects: intOrNull(v.minSubjects) ?? 0,
    maxSubjects: intOrNull(v.maxSubjects) ?? 1,
    enforceLimits: v.enforceLimits === true,
    displayOrder: Number(v.displayOrder || 0),
    description: orNull(v.description),
    status: text(v.status) || 'active',
  }),
};
