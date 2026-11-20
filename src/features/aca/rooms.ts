import type { CrudDescriptor, FormValues } from '../../crud/descriptor';

export interface Room {
  id: string;
  code: string | null;
  name: string;
  type: string | null;
  capacity: number;
  building: string | null;
  floor: string | null;
  availableForTimetable: boolean;
  displayOrder: number;
  description: string | null;
  status: 'active' | 'inactive';
}

const TYPES = [
  { value: 'classroom', label: 'Classroom' },
  { value: 'lab', label: 'Lab' },
  { value: 'library', label: 'Library' },
  { value: 'hall', label: 'Hall' },
  { value: 'staff', label: 'Staff room' },
  { value: 'other', label: 'Other' },
];
const label = (v: string | null) => TYPES.find((t) => t.value === v)?.label ?? '—';
const text = (v: string | number | boolean | undefined) => String(v ?? '').trim();
const orNull = (v: string | number | boolean | undefined) => text(v) || null;

/** ACA-24 Rooms. Everything the page does comes from this descriptor. */
export const roomsDescriptor: CrudDescriptor<Room> = {
  singular: 'room',
  title: 'Rooms',
  endpoint: '/rooms',
  permissions: { view: 'aca.rooms.view', create: 'aca.rooms.create', edit: 'aca.rooms.edit', delete: 'aca.rooms.delete' },
  defaultSort: 'displayOrder',
  searchPlaceholder: 'Search by name, code or building',
  label: (r) => r.name,
  columns: [
    { key: 'code', label: 'Code', sort: 'code', render: (r) => r.code ?? '—' },
    { key: 'name', label: 'Name', sort: 'name' },
    { key: 'type', label: 'Type', render: (r) => label(r.type) },
    { key: 'capacity', label: 'Capacity', sort: 'capacity' },
    { key: 'building', label: 'Building', sort: 'building', render: (r) => r.building ?? '—' },
    { key: 'status', label: 'Status', render: (r) => (r.status === 'active' ? 'Active' : 'Inactive') },
  ],
  fields: [
    { key: 'name', label: 'Name', kind: 'text', required: true, maxLength: 100 },
    { key: 'code', label: 'Code', kind: 'text', maxLength: 20, hint: 'Must be unique. Leave blank if the room has no code.' },
    { key: 'type', label: 'Type', kind: 'select', options: TYPES },
    { key: 'capacity', label: 'Capacity', kind: 'number', required: true, min: 1, max: 10000, defaultValue: 30 },
    { key: 'building', label: 'Building', kind: 'text', maxLength: 100 },
    { key: 'floor', label: 'Floor', kind: 'text', maxLength: 20 },
    { key: 'availableForTimetable', label: 'Available for timetabling', kind: 'checkbox', defaultValue: true },
    { key: 'displayOrder', label: 'Display order', kind: 'number', min: 0, max: 100000, defaultValue: 0 },
    { key: 'description', label: 'Description', kind: 'textarea', maxLength: 500 },
    {
      key: 'status',
      label: 'Status',
      kind: 'select',
      required: true,
      defaultValue: 'active',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'inactive', label: 'Inactive' },
      ],
    },
  ],
  toForm: (r): FormValues => ({
    name: r.name,
    code: r.code ?? '',
    type: r.type ?? '',
    capacity: r.capacity,
    building: r.building ?? '',
    floor: r.floor ?? '',
    availableForTimetable: r.availableForTimetable,
    displayOrder: r.displayOrder,
    description: r.description ?? '',
    status: r.status,
  }),
  toInput: (v) => ({
    name: text(v.name),
    code: orNull(v.code),
    type: orNull(v.type),
    capacity: Number(v.capacity),
    building: orNull(v.building),
    floor: orNull(v.floor),
    availableForTimetable: v.availableForTimetable === true,
    displayOrder: Number(v.displayOrder || 0),
    description: orNull(v.description),
    status: text(v.status) || 'active',
  }),
};
