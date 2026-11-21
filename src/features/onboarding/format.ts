import type { BatchStatus, CommitMode, RowStatus, Strategy } from './importApi';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "21 Nov 2026". A fixed month table, not Intl, so web and mobile print the same text on every device. */
export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export const STRATEGIES: { value: Strategy; label: string; hint: string }[] = [
  { value: 'upsert', label: 'Add new and update existing', hint: 'Each row is matched to an existing record by its code, or by its key columns (for example year, class and section). A match is updated, anything else is added.' },
  { value: 'insert', label: 'Add new only', hint: 'A row whose code already exists is flagged instead of changed.' },
  { value: 'update', label: 'Update existing only', hint: 'A row that matches nothing is flagged. A blank cell, or a column left out of the file, keeps the current value.' },
];

export const COMMIT_MODES: { value: CommitMode; label: string; hint: string }[] = [
  { value: 'all_or_nothing', label: 'All or nothing', hint: 'Import only if every row is valid. Nothing is saved otherwise.' },
  { value: 'skip_invalid', label: 'Import the valid rows', hint: 'Rows with problems are skipped and listed so you can fix them.' },
];

export const STATUS_LABEL: Record<BatchStatus, string> = {
  uploaded: 'Waiting to be checked',
  validating: 'Checking',
  validated: 'Ready to review',
  committing: 'Importing',
  committed: 'Imported',
  rolling_back: 'Rolling back',
  rolled_back: 'Rolled back',
  failed: 'Failed',
  rejected: 'Rejected',
};

export const ROW_LABEL: Record<RowStatus, string> = {
  pending: 'Waiting',
  valid: 'Ready',
  warning: 'Ready, with a note',
  error: 'Needs fixing',
  committed: 'Imported',
  skipped: 'Skipped',
  reverted: 'Rolled back',
  revert_failed: 'Left as it is',
};

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** A message when the chosen file cannot be imported, checked before anything is uploaded. */
export function fileProblem(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!name.endsWith('.csv') && !name.endsWith('.xlsx')) return 'Choose a .csv or .xlsx file.';
  if (file.size === 0) return 'This file is empty.';
  if (file.size > MAX_FILE_BYTES) return 'This file is larger than 10 MB. Split it into smaller files.';
  return null;
}

/** Saves a blob as a file download. */
export function saveBlob(blob: Blob, name: string): void {
  if (typeof URL.createObjectURL !== 'function') return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
