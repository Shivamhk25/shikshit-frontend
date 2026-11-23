import type { ReactNode } from 'react';
/**
 * A master-data screen is described, not coded. The descriptor says what the resource is called, which permissions
 * guard it, which columns the table shows and which fields the form has; CrudPage does the rest (paging, sorting,
 * search, side-sheet form, field errors, permission-aware controls, empty/error states).
 */

export type FieldKind = 'text' | 'textarea' | 'number' | 'date' | 'select' | 'checkbox';

export interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  hint?: string;
  /** For `select`: allowed values and their labels. An optional select offers an empty choice. */
  options?: { value: string; label: string }[];
  maxLength?: number;
  min?: number;
  max?: number;
  /** For `number`: the step (0.5 for half credits). */
  step?: number;
  /** For `select`: load the options from another resource's list endpoint instead of listing them here. */
  remote?: { endpoint: string; value: string; label: string; /** Too many to load whole: the person searches instead (students, guardians). */ search?: boolean; /** A second field shown in brackets after the label, to tell two people with the same name apart. */ detail?: string; /** Searches shorter than this (but not empty) are not sent; the server refuses them. */ minChars?: number; /** The key on the edited row that holds the label of the current value, for lookups that have no single-record endpoint. */ currentLabel?: string };
  /** Shown in the form only (not a column). */
  defaultValue?: string | number | boolean;
}

export interface ColumnDef<T> {
  key: string;
  label: string;
  /** Sort key sent to the API; omit when the column is not sortable. */
  sort?: string;
  render?: (row: T) => string;
}

/** A filter above the table. A select sends its value as a query parameter; a toggle sends "true" when ticked. */
export interface FilterDef {
  key: string;
  label: string;
  kind: 'select' | 'toggle';
  options?: { value: string; label: string }[];
  /** Options loaded from another resource's list endpoint. */
  remote?: { endpoint: string; value: string; label: string };
}

export interface CrudDescriptor<T> {
  /** Singular name for buttons and dialogs: "room". */
  singular: string;
  title: string;
  endpoint: string;
  /** Permission codes; the server enforces them, the page only hides what the user cannot use. */
  permissions: { view: string; create: string; edit: string; delete: string };
  columns: ColumnDef<T>[];
  fields: FieldDef[];
  defaultSort: string;
  searchPlaceholder: string;
  /** Text identifying a row in the delete confirmation. */
  label: (row: T) => string;
  /** Maps a stored row to form values. */
  toForm: (row: T) => FormValues;
  /** Maps form values to the request body. */
  toInput: (values: FormValues) => Record<string, unknown>;
  /** Filters shown beside the search box; their values are sent with every list request. */
  filters?: FilterDef[];
  /** Shown at the top of the edit sheet for an existing row (for example a student's photo). */
  editExtra?: (row: T) => ReactNode;
}

export type FormValues = Record<string, string | number | boolean>;

/** Starting values for a new item. */
export function blankValues(fields: FieldDef[]): FormValues {
  const out: FormValues = {};
  for (const f of fields) out[f.key] = f.defaultValue ?? (f.kind === 'checkbox' ? false : '');
  return out;
}
