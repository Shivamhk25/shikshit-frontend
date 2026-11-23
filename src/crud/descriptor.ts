import type { ReactNode } from 'react';
/**
 * A master-data screen is described, not coded. The descriptor says what the resource is called, which permissions
 * guard it, which columns the table shows and which fields the form has; CrudPage does the rest (paging, sorting,
 * search, side-sheet form, field errors, permission-aware controls, empty/error states).
 */

export type FieldKind = 'text' | 'textarea' | 'number' | 'date' | 'datetime' | 'select' | 'checkbox';

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
  /** The starting value of a new item. A function is called each time the form opens (for "now"). */
  defaultValue?: string | number | boolean | (() => string);
}

export interface ColumnDef<T> {
  key: string;
  label: string;
  /** Sort key sent to the API; omit when the column is not sortable. */
  sort?: string;
  render?: (row: T) => string;
}

/**
 * An action on one row that calls the server and changes nothing in the form: a POST to `endpoint(row)` with an empty
 * body, after a confirmation. It shows only to people who hold `permission`, on rows `visible` accepts.
 */
export interface RowAction<T> {
  key: string;
  label: string;
  permission: string;
  visible?: (row: T) => boolean;
  endpoint: (row: T) => string;
  /** The question asked before the call. */
  confirm: (row: T) => { title: string; body: string };
  /** What to tell the person once it worked, from the server's answer. */
  success: (result: Record<string, unknown>) => string;
}

/** A link in a row's Actions cell that opens another screen (no server call). Shown to people who hold `permission`, on rows `visible` accepts. */
export interface RowLink<T> {
  key: string;
  label: string;
  permission: string;
  visible?: (row: T) => boolean;
  href: (row: T) => string;
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
  /** Extra buttons in each row's Actions cell. */
  rowActions?: RowAction<T>[];
  /** Extra links in each row's Actions cell, for hand-offs to another screen. */
  rowLinks?: RowLink<T>[];
  /**
   * Shown at the top of the edit sheet for an existing row (for example a student's photo). `form.setValue` changes a
   * field of the open form, for an extra that changes the record behind the form's back.
   */
  editExtra?: (row: T, form: { setValue: (key: string, value: string | number | boolean) => void }) => ReactNode;
}

export type FormValues = Record<string, string | number | boolean>;

/** Starting values for a new item. */
export function blankValues(fields: FieldDef[]): FormValues {
  const out: FormValues = {};
  for (const f of fields) out[f.key] = (typeof f.defaultValue === 'function' ? f.defaultValue() : f.defaultValue) ?? (f.kind === 'checkbox' ? false : '');
  return out;
}
