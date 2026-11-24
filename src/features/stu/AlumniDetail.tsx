import type { ReactNode } from 'react';
import { Sheet, cx } from '../../design-system';
import { formatDate } from '../adm/dates';
import { exitNote, lastClassLine, UNKNOWN_EXIT, type Alumnus } from './alumni';

const TONE: Record<string, string> = {
  graduated: 'border-success-line bg-success-bg text-success',
  transferred: 'border-info-line bg-info-bg text-info',
  other: 'border-line bg-subtle text-fg-muted',
};

/** Why the student left, as a small pill. */
export function ReasonPill({ reason, label }: { reason: string; label: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium', TONE[reason] ?? TONE.other)}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
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

/** Everything the school keeps about one former student's leaving. It is read-only. */
export function AlumniDetail({ alumnus: a, onClose }: { alumnus: Alumnus; onClose: () => void }) {
  const note = exitNote(a);
  return (
    <Sheet open onClose={onClose} title={a.name} description={a.registrationCode}>
      <div className="flex flex-1 flex-col gap-6" data-testid="alumni-detail">
        <div>
          <ReasonPill reason={a.reason} label={a.reasonLabel} />
        </div>
        <section aria-labelledby="alumni-details" className="space-y-3">
          <h3 id="alumni-details" className="text-xs font-semibold uppercase tracking-[0.1em] text-fg-subtle">
            Details
          </h3>
          <dl className="grid grid-cols-[9rem_1fr] gap-x-4 gap-y-2 text-sm">
            <Row label="Last class">
              {lastClassLine(a)}
              {a.yearName ? <span className="block text-xs text-fg-subtle">{a.yearName}</span> : null}
            </Row>
            <Row label="Exit date">
              {a.exitDate ? formatDate(a.exitDate) : <span className="text-fg-muted">{UNKNOWN_EXIT}</span>}
              {note ? <span className="block text-xs text-fg-subtle">{note}</span> : null}
            </Row>
            <Row label="Admitted on">{formatDate(a.admissionDate)}</Row>
            {a.reason === 'transferred' ? (
              <>
                <Row label="TC number">{a.tcNumber ?? '—'}</Row>
                <Row label="Destination school">{a.destinationSchool || '—'}</Row>
                <Row label="Last attendance">{formatDate(a.lastAttendanceDate)}</Row>
              </>
            ) : null}
          </dl>
        </section>
        <p className="mt-auto border-t border-line-subtle pt-4 text-sm text-fg-subtle">This list is read-only. Alumni are made by promoting the last class or by completing a transfer.</p>
      </div>
    </Sheet>
  );
}
