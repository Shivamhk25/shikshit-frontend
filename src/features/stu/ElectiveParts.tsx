import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { Button, cx } from '../../design-system';
import { changeStatusLabel, PAGE_SIZE, statusLabel, type ElectiveSubject } from './electives';

export const CONTROL = 'h-10 rounded-md border border-line bg-surface px-3 text-sm text-fg shadow-soft hover:border-line-strong focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle';

const TONE: Record<string, string> = {
  chosen: 'border-warning-line bg-warning-bg text-warning',
  confirmed: 'border-success-line bg-success-bg text-success',
  requested: 'border-warning-line bg-warning-bg text-warning',
  approved: 'border-success-line bg-success-bg text-success',
  rejected: 'border-danger-line bg-danger-bg text-danger',
  cancelled: 'border-line bg-subtle text-fg-muted',
};

/** A choice or change-request status as a pill, in the colours the other screens use for the same meaning. */
export function ElectivePill({ status, change }: { status: string; change?: boolean }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium', TONE[status] ?? TONE.cancelled)}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {change ? changeStatusLabel(status) : statusLabel(status)}
    </span>
  );
}

export function SubjectChips({ subjects }: { subjects: ElectiveSubject[] }) {
  if (!subjects.length) return <span className="text-fg-subtle">None chosen</span>;
  return (
    <ul className="flex flex-wrap gap-1.5">
      {subjects.map((s) => (
        <li key={s.id} className="rounded-md border border-line-subtle bg-canvas px-2 py-0.5 text-xs text-fg">
          {s.name}
        </li>
      ))}
    </ul>
  );
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="space-y-3 rounded-lg border border-danger-line bg-surface p-6 shadow-soft">
      <p className="text-fg">{message}</p>
      <Button variant="secondary" onClick={onRetry}>
        Try again
      </Button>
    </div>
  );
}

export function EmptyRow({ cols, text }: { cols: number; text: string }) {
  return (
    <tr>
      <td colSpan={cols} className="px-5 py-16 text-center text-fg-muted">
        <Inbox aria-hidden="true" className="mx-auto mb-3 size-6 text-fg-subtle" />
        {text}
      </td>
    </tr>
  );
}

export function Pager({ page, total, onPage }: { page: number; total: number; onPage: (p: number) => void }) {
  if (total === 0) return null;
  const last = Math.max(1, Math.ceil(total / PAGE_SIZE));
  return (
    <nav className="flex items-center justify-between text-sm text-fg-muted" aria-label="Pagination">
      <span>
        Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} of {total}
      </span>
      <span className="flex items-center gap-2">
        <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft aria-hidden="true" className="size-4" />
          Previous
        </Button>
        <Button size="sm" variant="secondary" disabled={page >= last} onClick={() => onPage(page + 1)}>
          Next
          <ChevronRight aria-hidden="true" className="size-4" />
        </Button>
      </span>
    </nav>
  );
}

export const TH = 'whitespace-nowrap px-5 py-3.5 font-semibold';
export const THEAD = 'border-b border-line-subtle text-[11px] uppercase tracking-[0.08em] text-fg-subtle';
