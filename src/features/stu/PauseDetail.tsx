import type { ReactNode } from 'react';
import { Ban, FileText, Pencil, UserCheck } from 'lucide-react';
import { Button, Sheet, cx } from '../../design-system';
import { formatDate } from '../adm/dates';
import { classLine, daysLabel, reasonLabel, statusLabel, type Pause, type PauseAction } from './pauses';

const TONE: Record<string, string> = {
  active: 'border-warning-line bg-warning-bg text-warning',
  ended: 'border-success-line bg-success-bg text-success',
  cancelled: 'border-line bg-subtle text-fg-muted',
};

/** A pause's status as a small pill, in the same colours the other screens use for the same meaning. */
export function PauseStatusPill({ status }: { status: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium', TONE[status] ?? TONE.cancelled)}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {statusLabel(status)}
    </span>
  );
}

/** Shown where a figure depends on fees or attendance, which are not recorded in Shikshit yet. */
export function NotTracked() {
  return <span className="text-fg-subtle">Not tracked yet</span>;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-fg-subtle">{label}</dt>
      <dd className="min-w-0 break-words text-fg">{children}</dd>
    </>
  );
}

/** Every field of one pause and the actions that fit its status. */
export function PauseDetail({ pause: p, actions, onClose, onAction }: { pause: Pause; actions: PauseAction[]; onClose: () => void; onAction: (a: PauseAction) => void }) {
  const has = (a: PauseAction) => actions.includes(a);
  return (
    <Sheet open onClose={onClose} title={p.student.name} description={`${p.student.registrationCode} · paused from ${formatDate(p.pausedFrom)}`}>
      <div className="flex flex-1 flex-col gap-6" data-testid="pause-detail">
        <div className="flex flex-wrap items-center gap-3">
          <PauseStatusPill status={p.status} />
          {p.overdue ? <span className="rounded-full border border-danger-line bg-danger-bg px-2.5 py-0.5 text-xs font-medium text-danger">Past the expected date</span> : null}
        </div>

        {p.status === 'active' ? (
          <p role="note" className="rounded-md border border-warning-line bg-warning-bg p-3 text-sm text-fg">
            The student is marked <strong className="font-medium">paused</strong> while this pause is active. Marking them back sets them to active again.
          </p>
        ) : null}

        <section aria-labelledby="pause-details" className="space-y-3">
          <h3 id="pause-details" className="text-xs font-semibold uppercase tracking-[0.1em] text-fg-subtle">
            Details
          </h3>
          <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-2 text-sm">
            <Row label="Class">
              {classLine(p)}
              {p.yearName ? <span className="block text-xs text-fg-subtle">{p.yearName}</span> : null}
            </Row>
            <Row label="Paused from">{formatDate(p.pausedFrom)}</Row>
            <Row label="Expected back">{p.expectedBack ? formatDate(p.expectedBack) : 'Not set'}</Row>
            {p.status === 'ended' ? <Row label="Came back on">{formatDate(p.endedOn)}</Row> : null}
            <Row label="Days away">{daysLabel(p.days)}</Row>
            <Row label="Reason">
              {reasonLabel(p.reason)}
              {p.reasonNote ? <span className="mt-0.5 block whitespace-pre-wrap text-fg-muted">{p.reasonNote}</span> : null}
            </Row>
            {p.closeNote ? <Row label="Closing note">{p.closeNote}</Row> : null}
            <Row label="Owed when paused">
              <NotTracked />
              <span className="block text-xs text-fg-subtle">{p.figures.owed.note}</span>
            </Row>
            <Row label="School days missed">
              <NotTracked />
              <span className="block text-xs text-fg-subtle">{p.figures.missed.note}</span>
            </Row>
          </dl>
        </section>

        <div className="mt-auto flex flex-wrap gap-2 border-t border-line-subtle pt-4">
          {has('end') ? (
            <Button onClick={() => onAction('end')}>
              <UserCheck aria-hidden="true" className="size-4" />
              Mark back
            </Button>
          ) : null}
          {has('edit') ? (
            <Button variant="secondary" onClick={() => onAction('edit')}>
              <Pencil aria-hidden="true" className="size-4" />
              Edit
            </Button>
          ) : null}
          {has('cancel') ? (
            <Button variant="danger" onClick={() => onAction('cancel')}>
              <Ban aria-hidden="true" className="size-4" />
              Cancel pause
            </Button>
          ) : null}
          {actions.length <= 1 ? (
            <p className="flex items-center gap-2 text-sm text-fg-subtle">
              <FileText aria-hidden="true" className="size-4" />
              Nothing more to do here.
            </p>
          ) : null}
        </div>
      </div>
    </Sheet>
  );
}
