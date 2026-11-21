import { cx } from './cx';

export interface KpiCardProps {
  label: string;
  value: string;
  /** Change versus the previous period, e.g. "+4.2%". Colour follows `trend`. */
  delta?: string;
  trend?: 'up' | 'down' | 'flat';
  className?: string;
}

const TREND: Record<NonNullable<KpiCardProps['trend']>, string> = {
  up: 'text-success',
  down: 'text-danger',
  flat: 'text-fg-muted',
};

export function KpiCard({ label, value, delta, trend = 'flat', className }: KpiCardProps) {
  return (
    <section className={cx('rounded-lg border border-line bg-surface p-4', className)} aria-label={label}>
      <p className="text-sm text-fg-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-fg">{value}</p>
      {delta ? <p className={cx('mt-1 text-sm', TREND[trend])}>{delta}</p> : null}
    </section>
  );
}
