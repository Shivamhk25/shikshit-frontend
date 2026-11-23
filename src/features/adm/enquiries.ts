import { createElement } from 'react';
import type { CrudDescriptor, FormValues } from '../../crud/descriptor';
import { formatDate } from './dates';
import { EnquiryDiscussions } from './EnquiryDiscussions';

export type EnquirySource = 'walk_in' | 'phone' | 'website' | 'referral' | 'social' | 'other';
export type EnquiryStatus = 'new' | 'contacted' | 'visit_scheduled' | 'converted' | 'closed';

export interface Enquiry {
  id: string;
  code: string;
  enquirerName: string;
  phone: string;
  email: string | null;
  childName: string;
  dateOfBirth: string | null;
  classId: string | null;
  classCode: string | null;
  className: string | null;
  yearId: string | null;
  yearName: string | null;
  source: EnquirySource;
  status: EnquiryStatus;
  followUpDate: string | null;
  followUpDue: boolean;
  notes: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  createdAt: string;
  updatedAt: string;
}

export const SOURCES: { value: EnquirySource; label: string }[] = [
  { value: 'walk_in', label: 'Walk-in' },
  { value: 'phone', label: 'Phone call' },
  { value: 'website', label: 'Website' },
  { value: 'referral', label: 'Referral' },
  { value: 'social', label: 'Social media' },
  { value: 'other', label: 'Other' },
];

export const STATUSES: { value: EnquiryStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'visit_scheduled', label: 'Visit scheduled' },
  { value: 'converted', label: 'Converted' },
  { value: 'closed', label: 'Closed' },
];

const statusLabel = (v: string) => STATUSES.find((s) => s.value === v)?.label ?? v;
export { formatDate };

/** The follow-up date, with "overdue" beside it when the server says the follow-up is due. */
export const followUpText = (r: Enquiry) => (r.followUpDate ? `${formatDate(r.followUpDate)}${r.followUpDue ? ' · due' : ''}` : '—');

const text = (v: string | number | boolean | undefined) => String(v ?? '').trim();
const orNull = (v: string | number | boolean | undefined) => text(v) || null;

/** ADM-03 Enquiry. Everything the page does comes from this descriptor. */
export const enquiriesDescriptor: CrudDescriptor<Enquiry> = {
  singular: 'enquiry',
  title: 'Enquiries',
  endpoint: '/enquiries',
  permissions: { view: 'adm.enquiry.view', create: 'adm.enquiry.create', edit: 'adm.enquiry.edit', delete: 'adm.enquiry.delete' },
  defaultSort: '-createdAt',
  searchPlaceholder: 'Search by number, name, phone or email',
  label: (r) => `${r.code} · ${r.childName}`,
  filters: [
    { key: 'status', label: 'Status', kind: 'select', options: STATUSES },
    { key: 'classId', label: 'Class', kind: 'select', remote: { endpoint: '/classes', value: 'id', label: 'name' } },
    { key: 'source', label: 'Source', kind: 'select', options: SOURCES },
    { key: 'followUpDue', label: 'Follow-up due', kind: 'toggle' },
  ],
  columns: [
    { key: 'code', label: 'Enquiry no.', sort: 'code' },
    { key: 'childName', label: 'Child', sort: 'childName' },
    { key: 'enquirerName', label: 'Enquirer', sort: 'enquirerName' },
    { key: 'phone', label: 'Phone' },
    { key: 'className', label: 'Class', render: (r) => r.className ?? '—' },
    { key: 'followUpDate', label: 'Follow-up', sort: 'followUpDate', render: followUpText },
    { key: 'assignedToName', label: 'Assigned to', render: (r) => r.assignedToName ?? '—' },
    { key: 'status', label: 'Status', sort: 'status', render: (r) => statusLabel(r.status) },
  ],
  fields: [
    { key: 'childName', label: 'Child’s name', kind: 'text', required: true, maxLength: 150 },
    { key: 'dateOfBirth', label: 'Child’s date of birth', kind: 'date' },
    { key: 'enquirerName', label: 'Enquirer’s name', kind: 'text', required: true, maxLength: 150, hint: 'The parent or guardian who got in touch.' },
    { key: 'phone', label: 'Phone', kind: 'text', required: true, maxLength: 20 },
    { key: 'email', label: 'Email', kind: 'text', maxLength: 150 },
    { key: 'yearId', label: 'Academic year', kind: 'select', remote: { endpoint: '/academic-years', value: 'id', label: 'name' } },
    { key: 'classId', label: 'Class', kind: 'select', remote: { endpoint: '/classes', value: 'id', label: 'name' } },
    { key: 'source', label: 'Source', kind: 'select', required: true, options: SOURCES },
    { key: 'status', label: 'Status', kind: 'select', required: true, defaultValue: 'new', options: STATUSES },
    { key: 'followUpDate', label: 'Follow-up date', kind: 'date' },
    { key: 'assignedToId', label: 'Assigned to', kind: 'select', hint: 'The staff member who follows this up.', remote: { endpoint: '/users', value: 'id', label: 'displayName', detail: 'username', search: true } },
    { key: 'notes', label: 'Notes', kind: 'textarea', maxLength: 1000 },
  ],
  editExtra: (row, form) =>
    createElement(
      'div',
      { className: 'space-y-4' },
      createElement('p', { className: 'text-sm text-fg-muted' }, 'Enquiry number ', createElement('strong', { className: 'font-semibold text-fg' }, row.code)),
      createElement(EnquiryDiscussions, { enquiryId: row.id, onFollowUpDate: (date: string) => form.setValue('followUpDate', date) }),
    ),
  toForm: (r): FormValues => ({
    childName: r.childName,
    dateOfBirth: r.dateOfBirth ?? '',
    enquirerName: r.enquirerName,
    phone: r.phone,
    email: r.email ?? '',
    yearId: r.yearId ?? '',
    classId: r.classId ?? '',
    source: r.source,
    status: r.status,
    followUpDate: r.followUpDate ?? '',
    assignedToId: r.assignedToId ?? '',
    notes: r.notes ?? '',
  }),
  toInput: (v) => ({
    enquirerName: text(v.enquirerName),
    phone: text(v.phone),
    email: orNull(v.email),
    childName: text(v.childName),
    dateOfBirth: orNull(v.dateOfBirth),
    classId: orNull(v.classId),
    yearId: orNull(v.yearId),
    source: text(v.source),
    status: text(v.status) || 'new',
    followUpDate: orNull(v.followUpDate),
    notes: orNull(v.notes),
    assignedToId: orNull(v.assignedToId),
  }),
};
