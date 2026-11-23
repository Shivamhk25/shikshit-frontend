import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Ban, Check, CircleDot, FileText, Pencil, Printer, ShieldCheck, Trash2, X } from 'lucide-react';
import { Button, Sheet, cx } from '../../design-system';
import { formatDate } from '../adm/dates';
import { approvalHref, certificateHref, classLine, reasonLabel, statusLabel, timelineSteps, type StepState, type Transfer, type TransferAction } from './transfers';

const TONE: Record<string, string> = {
  requested: 'border-warning-line bg-warning-bg text-warning',
  approved: 'border-success-line bg-success-bg text-success',
  completed: 'border-info-line bg-info-bg text-info',
  rejected: 'border-danger-line bg-danger-bg text-danger',
  cancelled: 'border-line bg-subtle text-fg-muted',
};

/** A transfer's status as a small pill, in the same colours the other screens use for the same meaning. */
export function TransferStatusPill({ status }: { status: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium', TONE[status] ?? TONE.cancelled)}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {statusLabel(status)}
    </span>
  );
}

/** "Not tracked yet": fee dues are not recorded in Shikshit yet, so nothing is claimed either way. */
export function DuesNote() {
  return <span className="text-fg-subtle">Not tracked yet</span>;
}

const DOT: Record<StepState, string> = {
  done: 'border-success bg-success text-white',
  current: 'border-accent bg-surface text-accent-fg',
  upcoming: 'border-line bg-surface text-fg-subtle',
  stopped: 'border-danger bg-danger text-white',
};

/** requested → approved → completed, or the point where it stopped. Read as an ordered list by screen readers. */
export function TransferTimeline({ transfer }: { transfer: Transfer }) {
  const steps = timelineSteps(transfer, formatDate);
  return (
    <ol className="space-y-0" aria-label="Progress of this transfer">
      {steps.map((s, i) => (
        <li key={s.key} className="relative flex gap-3 pb-5 last:pb-0" aria-current={s.state === 'current' ? 'step' : undefined}>
          {i < steps.length - 1 ? <span aria-hidden="true" className="absolute left-[11px] top-6 h-[calc(100%-1.25rem)] w-px bg-line-subtle" /> : null}
          <span aria-hidden="true" className={cx('mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border', DOT[s.state])}>
            {s.state === 'done' ? <Check className="size-3.5" /> : s.state === 'stopped' ? <X className="size-3.5" /> : <CircleDot className="size-3.5" />}
          </span>
          <div className="min-w-0 text-sm">
            <p className={cx('font-medium', s.state === 'upcoming' ? 'text-fg-subtle' : 'text-fg')}>
              {s.label}
              <span className="sr-only">{`: ${s.state === 'done' ? 'done' : s.state === 'current' ? 'in progress' : s.state === 'stopped' ? 'stopped here' : 'not yet'}`}</span>
            </p>
            {s.detail ? <p className="text-fg-muted">{s.detail}</p> : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt className="text-fg-subtle">{label}</dt>
      <dd className="min-w-0 break-words text-fg">{children}</dd>
    </>
  );
}

/** Every field of one transfer, how far it has got, and the actions that fit its status. */
export function TransferDetail({ transfer: t, actions, onClose, onAction }: { transfer: Transfer; actions: TransferAction[]; onClose: () => void; onAction: (a: TransferAction) => void }) {
  const has = (a: TransferAction) => actions.includes(a);
  return (
    <Sheet open onClose={onClose} title={t.student.name} description={`${t.student.registrationCode} · requested on ${formatDate(t.requestedOn)}`}>
      <div className="flex flex-1 flex-col gap-6" data-testid="transfer-detail">
        <div className="flex flex-wrap items-center gap-3">
          <TransferStatusPill status={t.status} />
          {t.tcNumber ? <span className="text-sm font-medium text-fg">{t.tcNumber}</span> : null}
        </div>

        {t.status === 'requested' ? (
          <p role="note" className="rounded-md border border-warning-line bg-warning-bg p-3 text-sm text-fg">
            Waiting for approval by someone else with transfer rights. You cannot approve your own request.
          </p>
        ) : null}
        {t.status === 'approved' ? <p className="rounded-md border border-success-line bg-success-bg p-3 text-sm text-fg">Approved. Complete the transfer to give the student a transfer certificate number.</p> : null}

        <section aria-labelledby="transfer-progress" className="space-y-3">
          <h3 id="transfer-progress" className="text-xs font-semibold uppercase tracking-[0.1em] text-fg-subtle">
            Progress
          </h3>
          <TransferTimeline transfer={t} />
        </section>

        <section aria-labelledby="transfer-details" className="space-y-3">
          <h3 id="transfer-details" className="text-xs font-semibold uppercase tracking-[0.1em] text-fg-subtle">
            Details
          </h3>
          <dl className="grid grid-cols-[8.5rem_1fr] gap-x-4 gap-y-2 text-sm">
            <Row label="Class">
              {classLine(t)}
              {t.yearName ? <span className="block text-xs text-fg-subtle">{t.yearName}</span> : null}
            </Row>
            <Row label="Reason">
              {reasonLabel(t.reason)}
              {t.reasonNote ? <span className="mt-0.5 block whitespace-pre-wrap text-fg-muted">{t.reasonNote}</span> : null}
            </Row>
            <Row label="Destination school">{t.destinationSchool || '—'}</Row>
            <Row label="Last attendance">{formatDate(t.lastAttendanceDate)}</Row>
            <Row label="Dues">
              <DuesNote />
              {t.dues.note ? <span className="block text-xs text-fg-subtle">{t.dues.note}</span> : null}
            </Row>
            {t.tcNumber ? <Row label="TC number">{t.tcNumber}</Row> : null}
            {t.tcIssuedOn ? <Row label="TC issued on">{formatDate(t.tcIssuedOn)}</Row> : null}
          </dl>
        </section>

        {t.approvalRequestId ? (
          <Link to={approvalHref(t.approvalRequestId)} className="inline-flex w-fit items-center gap-2 text-sm font-medium text-accent-fg underline underline-offset-2 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
            <ShieldCheck aria-hidden="true" className="size-4" />
            Open approval
          </Link>
        ) : null}

        <div className="mt-auto flex flex-wrap gap-2 border-t border-line-subtle pt-4">
          {has('complete') ? (
            <Button onClick={() => onAction('complete')}>
              <Check aria-hidden="true" className="size-4" />
              Complete transfer
            </Button>
          ) : null}
          {has('printCertificate') ? (
            <Link to={certificateHref(t.id)} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-medium text-on-accent shadow-soft hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
              <Printer aria-hidden="true" className="size-4" />
              Print TC
            </Link>
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
              Cancel transfer
            </Button>
          ) : null}
          {has('delete') ? (
            <Button variant="danger" onClick={() => onAction('delete')}>
              <Trash2 aria-hidden="true" className="size-4" />
              Delete
            </Button>
          ) : null}
          {actions.length <= 1 && !t.approvalRequestId ? (
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
