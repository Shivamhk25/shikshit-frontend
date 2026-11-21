import type { ColumnDef, CrudDescriptor, FieldDef, FormValues } from '../../crud/descriptor';
import { STATUS_OPTIONS, intOrNull, orNull, text } from './structure';

/** Descriptors for ACA-30 Class Sections, ACA-31 Class Subjects, Textbooks and Textbook chapters. All are per academic year or per book. */

const yearField: FieldDef = { key: 'yearId', label: 'Academic year', kind: 'select', required: true, remote: { endpoint: '/academic-years', value: 'id', label: 'name' } };
const classField: FieldDef = { key: 'classId', label: 'Class', kind: 'select', required: true, remote: { endpoint: '/classes', value: 'id', label: 'name' } };
const sectionField = (required: boolean, hint?: string): FieldDef => ({ key: 'sectionId', label: 'Section', kind: 'select', required, hint, remote: { endpoint: '/sections', value: 'id', label: 'name' } });
const subjectField: FieldDef = { key: 'subjectId', label: 'Subject', kind: 'select', required: true, remote: { endpoint: '/subjects', value: 'id', label: 'name' } };
const yesNo = (v: boolean) => (v ? 'Yes' : 'No');
const flag = (key: string, label: string, defaultValue: boolean, hint?: string): FieldDef => ({ key, label, kind: 'checkbox', defaultValue, hint });

// ---- class sections

export interface ClassSection {
  id: string;
  yearId: string;
  yearName: string;
  classId: string;
  className: string;
  sectionId: string;
  sectionName: string;
  capacity: number | null;
  roomId: string | null;
  roomName: string | null;
  remarks: string | null;
}

export const classSectionsDescriptor: CrudDescriptor<ClassSection> = {
  singular: 'class section',
  title: 'Class sections',
  endpoint: '/class-section-mappings',
  permissions: { view: 'aca.class_section_mappings.view', create: 'aca.class_section_mappings.create', edit: 'aca.class_section_mappings.edit', delete: 'aca.class_section_mappings.delete' },
  defaultSort: 'className,sectionName',
  searchPlaceholder: 'Search by class, section or remarks',
  label: (r) => `${r.className} ${r.sectionName} (${r.yearName})`,
  columns: [
    { key: 'yearName', label: 'Year' },
    { key: 'className', label: 'Class', sort: 'className' },
    { key: 'sectionName', label: 'Section', sort: 'sectionName' },
    { key: 'capacity', label: 'Capacity', sort: 'capacity', render: (r) => (r.capacity === null ? '—' : String(r.capacity)) },
    { key: 'roomName', label: 'Room', render: (r) => r.roomName ?? '—' },
  ] as ColumnDef<ClassSection>[],
  fields: [
    yearField,
    classField,
    sectionField(true),
    { key: 'capacity', label: 'Capacity', kind: 'number', min: 1, max: 1000, hint: 'Most students this section can hold.' },
    { key: 'roomId', label: 'Room', kind: 'select', remote: { endpoint: '/rooms', value: 'id', label: 'name' } },
    { key: 'remarks', label: 'Remarks', kind: 'textarea', maxLength: 500 },
  ],
  toForm: (r): FormValues => ({ yearId: r.yearId, classId: r.classId, sectionId: r.sectionId, capacity: r.capacity ?? '', roomId: r.roomId ?? '', remarks: r.remarks ?? '' }),
  toInput: (v) => ({ yearId: text(v.yearId), classId: text(v.classId), sectionId: text(v.sectionId), capacity: intOrNull(v.capacity), roomId: orNull(v.roomId), remarks: orNull(v.remarks) }),
};

// ---- class subjects

export interface SubjectClass {
  id: string;
  yearId: string;
  yearName: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  sectionId: string | null;
  sectionName: string | null;
  periodsPerWeek: number | null;
  isElective: boolean;
  isExamined: boolean;
  isAssessed: boolean;
  isGradeOnly: boolean;
  hasPractical: boolean;
  onReportCard: boolean;
}

export const subjectClassesDescriptor: CrudDescriptor<SubjectClass> = {
  singular: 'class subject',
  title: 'Class subjects',
  endpoint: '/subject-class-mappings',
  permissions: { view: 'aca.subject_class_mappings.view', create: 'aca.subject_class_mappings.create', edit: 'aca.subject_class_mappings.edit', delete: 'aca.subject_class_mappings.delete' },
  defaultSort: 'className,subjectName',
  searchPlaceholder: 'Search by class or subject',
  label: (r) => `${r.subjectName} in ${r.className}${r.sectionName ? ` ${r.sectionName}` : ''} (${r.yearName})`,
  columns: [
    { key: 'yearName', label: 'Year' },
    { key: 'className', label: 'Class', sort: 'className' },
    { key: 'subjectName', label: 'Subject', sort: 'subjectName' },
    { key: 'sectionName', label: 'Section', render: (r) => r.sectionName ?? 'Whole class' },
    { key: 'periodsPerWeek', label: 'Periods a week', sort: 'periodsPerWeek', render: (r) => (r.periodsPerWeek === null ? '—' : String(r.periodsPerWeek)) },
    { key: 'isElective', label: 'Elective', render: (r) => yesNo(r.isElective) },
    { key: 'onReportCard', label: 'On report card', render: (r) => yesNo(r.onReportCard) },
  ] as ColumnDef<SubjectClass>[],
  fields: [
    yearField,
    classField,
    subjectField,
    sectionField(false, 'Leave empty for the whole class. A section must already be mapped to the class for this year.'),
    { key: 'periodsPerWeek', label: 'Periods a week', kind: 'number', min: 0, max: 60 },
    flag('isElective', 'Elective', false),
    flag('isExamined', 'Examined', true),
    flag('isAssessed', 'Assessed', true),
    flag('isGradeOnly', 'Grade only', false),
    flag('hasPractical', 'Has practical', false),
    flag('onReportCard', 'Shown on the report card', true),
  ],
  toForm: (r): FormValues => ({
    yearId: r.yearId, classId: r.classId, subjectId: r.subjectId, sectionId: r.sectionId ?? '', periodsPerWeek: r.periodsPerWeek ?? '',
    isElective: r.isElective, isExamined: r.isExamined, isAssessed: r.isAssessed, isGradeOnly: r.isGradeOnly, hasPractical: r.hasPractical, onReportCard: r.onReportCard,
  }),
  toInput: (v) => ({
    yearId: text(v.yearId), classId: text(v.classId), subjectId: text(v.subjectId), sectionId: orNull(v.sectionId), periodsPerWeek: intOrNull(v.periodsPerWeek),
    isElective: v.isElective === true, isExamined: v.isExamined === true, isAssessed: v.isAssessed === true, isGradeOnly: v.isGradeOnly === true,
    hasPractical: v.hasPractical === true, onReportCard: v.onReportCard === true,
  }),
};

// ---- textbooks

export interface Textbook {
  id: string;
  code: string;
  title: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  publisher: string | null;
  author: string | null;
  isbn: string | null;
  bookUrl: string | null;
  notes: string | null;
  status: 'active' | 'inactive';
  chapterCount: number;
  periodsNeeded: number;
}

export const textbooksDescriptor: CrudDescriptor<Textbook> = {
  singular: 'textbook',
  title: 'Textbooks',
  endpoint: '/textbooks',
  permissions: { view: 'aca.textbooks.view', create: 'aca.textbooks.create', edit: 'aca.textbooks.edit', delete: 'aca.textbooks.delete' },
  defaultSort: 'className,subjectName,title',
  searchPlaceholder: 'Search by code, title, publisher or author',
  label: (r) => r.title,
  columns: [
    { key: 'code', label: 'Code', sort: 'code' },
    { key: 'title', label: 'Title', sort: 'title' },
    { key: 'className', label: 'Class', sort: 'className' },
    { key: 'subjectName', label: 'Subject', sort: 'subjectName' },
    { key: 'chapterCount', label: 'Chapters', render: (r) => String(r.chapterCount) },
    { key: 'periodsNeeded', label: 'Periods needed', render: (r) => String(r.periodsNeeded) },
    { key: 'status', label: 'Status', render: (r) => (r.status === 'active' ? 'Active' : 'Inactive') },
  ] as ColumnDef<Textbook>[],
  fields: [
    { key: 'code', label: 'Code', kind: 'text', required: true, maxLength: 20 },
    { key: 'title', label: 'Title', kind: 'text', required: true, maxLength: 200 },
    classField,
    subjectField,
    { key: 'publisher', label: 'Publisher', kind: 'text', maxLength: 100 },
    { key: 'author', label: 'Author', kind: 'text', maxLength: 100 },
    { key: 'isbn', label: 'ISBN', kind: 'text', maxLength: 17, hint: '10 to 17 digits, hyphens or an X.' },
    { key: 'bookUrl', label: 'Web link', kind: 'text', maxLength: 500, hint: 'A link to the book. Must start with http:// or https://.' },
    { key: 'notes', label: 'Notes', kind: 'textarea', maxLength: 500 },
    { key: 'status', label: 'Status', kind: 'select', required: true, defaultValue: 'active', options: STATUS_OPTIONS },
  ],
  toForm: (r): FormValues => ({
    code: r.code, title: r.title, classId: r.classId, subjectId: r.subjectId, publisher: r.publisher ?? '', author: r.author ?? '', isbn: r.isbn ?? '',
    bookUrl: r.bookUrl ?? '', notes: r.notes ?? '', status: r.status,
  }),
  toInput: (v) => ({
    code: text(v.code), title: text(v.title), classId: text(v.classId), subjectId: text(v.subjectId), publisher: orNull(v.publisher), author: orNull(v.author),
    isbn: orNull(v.isbn), bookUrl: orNull(v.bookUrl), notes: orNull(v.notes), status: text(v.status) || 'active',
  }),
};

// ---- textbook chapters

export interface TextbookChapter {
  id: string;
  textbookId: string;
  textbookTitle: string;
  sortOrder: number;
  chapterNo: string | null;
  title: string;
  periods: number | null;
  fromPage: number | null;
  toPage: number | null;
  isOptional: boolean;
  summary: string | null;
}

export const chaptersDescriptor: CrudDescriptor<TextbookChapter> = {
  singular: 'chapter',
  title: 'Textbook chapters',
  endpoint: '/textbook-chapters',
  permissions: { view: 'aca.textbook_chapters.view', create: 'aca.textbook_chapters.create', edit: 'aca.textbook_chapters.edit', delete: 'aca.textbook_chapters.delete' },
  defaultSort: 'sortOrder',
  searchPlaceholder: 'Search by title or chapter number',
  label: (r) => `${r.chapterNo ? `${r.chapterNo}. ` : ''}${r.title}`,
  columns: [
    { key: 'textbookTitle', label: 'Textbook' },
    { key: 'sortOrder', label: 'Order', sort: 'sortOrder' },
    { key: 'chapterNo', label: 'No.', render: (r) => r.chapterNo ?? '—' },
    { key: 'title', label: 'Title', sort: 'title' },
    { key: 'periods', label: 'Periods', sort: 'periods', render: (r) => (r.periods === null ? '—' : String(r.periods)) },
    { key: 'pages', label: 'Pages', render: (r) => (r.fromPage === null && r.toPage === null ? '—' : `${r.fromPage ?? '?'}–${r.toPage ?? '?'}`) },
    { key: 'isOptional', label: 'Optional', render: (r) => yesNo(r.isOptional) },
  ] as ColumnDef<TextbookChapter>[],
  fields: [
    { key: 'textbookId', label: 'Textbook', kind: 'select', required: true, remote: { endpoint: '/textbooks', value: 'id', label: 'title' } },
    { key: 'sortOrder', label: 'Order', kind: 'number', required: true, min: 0, max: 100000, defaultValue: 0, hint: 'Chapters are listed in this order.' },
    { key: 'chapterNo', label: 'Chapter number', kind: 'text', maxLength: 20 },
    { key: 'title', label: 'Title', kind: 'text', required: true, maxLength: 200 },
    { key: 'periods', label: 'Periods', kind: 'number', min: 0, max: 200 },
    { key: 'fromPage', label: 'From page', kind: 'number', min: 1, max: 10000 },
    { key: 'toPage', label: 'To page', kind: 'number', min: 1, max: 10000 },
    { key: 'isOptional', label: 'Optional chapter', kind: 'checkbox', defaultValue: false, hint: 'Optional chapters do not count towards the periods the book needs.' },
    { key: 'summary', label: 'Summary', kind: 'textarea', maxLength: 1000 },
  ],
  toForm: (r): FormValues => ({
    textbookId: r.textbookId, sortOrder: r.sortOrder, chapterNo: r.chapterNo ?? '', title: r.title, periods: r.periods ?? '', fromPage: r.fromPage ?? '',
    toPage: r.toPage ?? '', isOptional: r.isOptional, summary: r.summary ?? '',
  }),
  toInput: (v) => ({
    textbookId: text(v.textbookId), sortOrder: Number(v.sortOrder || 0), chapterNo: orNull(v.chapterNo), title: text(v.title), periods: intOrNull(v.periods),
    fromPage: intOrNull(v.fromPage), toPage: intOrNull(v.toPage), isOptional: v.isOptional === true, summary: orNull(v.summary),
  }),
};
