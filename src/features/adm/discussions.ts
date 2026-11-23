import type { CrudDescriptor, FormValues } from '../../crud/descriptor';
import { formatDate, formatDateTime, fromLocalInput, nowLocalInput, toLocalInput } from './dates';

export type Channel = 'call' | 'visit' | 'whatsapp' | 'email' | 'other';
export type Outcome = 'interested' | 'visit_scheduled' | 'call_back_later' | 'not_reachable' | 'not_interested' | 'other';

export interface Discussion {
  id: string;
  enquiryId: string;
  enquiryCode: string;
  enquiryChildName: string;
  contactedAt: string;
  channel: Channel;
  summary: string;
  notes: string | null;
  outcome: Outcome;
  nextFollowUpDate: string | null;
  language: string;
  loggedById: string | null;
  loggedByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export const CHANNELS: { value: Channel; label: string }[] = [
  { value: 'call', label: 'Phone call' },
  { value: 'visit', label: 'Visit to the school' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'other', label: 'Other' },
];

export const OUTCOMES: { value: Outcome; label: string }[] = [
  { value: 'interested', label: 'Interested' },
  { value: 'visit_scheduled', label: 'Visit scheduled' },
  { value: 'call_back_later', label: 'Call back later' },
  { value: 'not_reachable', label: 'Could not reach' },
  { value: 'not_interested', label: 'Not interested' },
  { value: 'other', label: 'Other' },
];

/** English and twelve Indian languages, then "other". The codes are the ones the server accepts (ISO 639-1). */
export const LANGUAGES: { value: string; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'bn', label: 'Bengali' },
  { value: 'mr', label: 'Marathi' },
  { value: 'te', label: 'Telugu' },
  { value: 'ta', label: 'Tamil' },
  { value: 'gu', label: 'Gujarati' },
  { value: 'ur', label: 'Urdu' },
  { value: 'kn', label: 'Kannada' },
  { value: 'ml', label: 'Malayalam' },
  { value: 'or', label: 'Odia' },
  { value: 'pa', label: 'Punjabi' },
  { value: 'as', label: 'Assamese' },
  { value: 'other', label: 'Other' },
];

const labelOf = (list: { value: string; label: string }[], v: string) => list.find((o) => o.value === v)?.label ?? v;
export const channelLabel = (v: string) => labelOf(CHANNELS, v);
export const outcomeLabel = (v: string) => labelOf(OUTCOMES, v);
export const languageLabel = (v: string) => labelOf(LANGUAGES, v);

const text = (v: string | number | boolean | undefined) => String(v ?? '').trim();
const orNull = (v: string | number | boolean | undefined) => text(v) || null;

/** The form fields of a note. The enquiry's own sheet leaves out `enquiryId`, because the note is for that enquiry. */
export const discussionFields: CrudDescriptor<Discussion>['fields'] = [
  { key: 'enquiryId', label: 'Enquiry', kind: 'select', required: true, hint: 'Search by the child’s name, the parent’s name or the enquiry number.', remote: { endpoint: '/enquiries', value: 'id', label: 'childName', detail: 'code', search: true } },
  { key: 'contactedAt', label: 'Contacted on', kind: 'datetime', required: true, defaultValue: nowLocalInput, hint: 'India time. Cannot be in the future.' },
  { key: 'channel', label: 'How', kind: 'select', required: true, defaultValue: 'call', options: CHANNELS },
  { key: 'language', label: 'Language spoken', kind: 'select', required: true, defaultValue: 'en', options: LANGUAGES },
  { key: 'summary', label: 'What was discussed', kind: 'text', required: true, maxLength: 200, hint: 'One line.' },
  { key: 'notes', label: 'Notes', kind: 'textarea', maxLength: 2000, hint: 'More detail, or what was said word for word.' },
  { key: 'outcome', label: 'How it ended', kind: 'select', required: true, options: OUTCOMES },
  { key: 'nextFollowUpDate', label: 'Contact again on', kind: 'date' },
  { key: 'updateEnquiryFollowUp', label: 'Also make this the enquiry’s follow-up date', kind: 'checkbox', defaultValue: false },
];

/** Form values to the request body; the contact time is read as India time. */
export function discussionInput(v: FormValues): Record<string, unknown> {
  const next = orNull(v.nextFollowUpDate);
  return {
    enquiryId: text(v.enquiryId),
    contactedAt: fromLocalInput(text(v.contactedAt)),
    channel: text(v.channel),
    summary: text(v.summary),
    notes: orNull(v.notes),
    outcome: text(v.outcome),
    nextFollowUpDate: next,
    language: text(v.language),
    updateEnquiryFollowUp: v.updateEnquiryFollowUp === true,
  };
}

/** ADM-04 Enquiry Discussions: the follow-up notes the admissions desk keeps on enquiries. */
export const discussionsDescriptor: CrudDescriptor<Discussion> = {
  singular: 'discussion',
  title: 'Enquiry discussions',
  endpoint: '/enquiry-discussions',
  permissions: { view: 'adm.enquiry_discussions.view', create: 'adm.enquiry_discussions.create', edit: 'adm.enquiry_discussions.edit', delete: 'adm.enquiry_discussions.delete' },
  defaultSort: '-contactedAt',
  searchPlaceholder: 'Search by note, child, or enquiry number',
  label: (r) => `${r.enquiryCode} · ${formatDateTime(r.contactedAt)}`,
  filters: [
    { key: 'channel', label: 'Channels', kind: 'select', options: CHANNELS },
    { key: 'outcome', label: 'Outcomes', kind: 'select', options: OUTCOMES },
    { key: 'language', label: 'Languages', kind: 'select', options: LANGUAGES },
  ],
  columns: [
    { key: 'contactedAt', label: 'Contacted', sort: 'contactedAt', render: (r) => formatDateTime(r.contactedAt) },
    { key: 'enquiryCode', label: 'Enquiry', sort: 'enquiryCode', render: (r) => `${r.enquiryCode} · ${r.enquiryChildName}` },
    { key: 'channel', label: 'How', sort: 'channel', render: (r) => channelLabel(r.channel) },
    { key: 'summary', label: 'Discussed' },
    { key: 'outcome', label: 'Outcome', sort: 'outcome', render: (r) => outcomeLabel(r.outcome) },
    { key: 'nextFollowUpDate', label: 'Contact again', sort: 'nextFollowUpDate', render: (r) => formatDate(r.nextFollowUpDate) },
    { key: 'loggedByName', label: 'Logged by', render: (r) => r.loggedByName ?? '—' },
  ],
  fields: discussionFields,
  toForm: (r): FormValues => ({
    enquiryId: r.enquiryId,
    contactedAt: toLocalInput(r.contactedAt),
    channel: r.channel,
    language: r.language,
    summary: r.summary,
    notes: r.notes ?? '',
    outcome: r.outcome,
    nextFollowUpDate: r.nextFollowUpDate ?? '',
    updateEnquiryFollowUp: false,
  }),
  toInput: discussionInput,
};
