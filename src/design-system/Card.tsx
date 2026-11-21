import type { HTMLAttributes, ReactNode } from 'react';
import { cx } from './cx';

/** A surface for grouped content: white on the warm canvas, a hairline border and a soft lift. */
export function Card({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('rounded-lg border border-line-subtle bg-surface shadow-card', className)} {...rest} />;
}

/** The title row of a page: an eyebrow, a serif title, an optional description and actions on the right. */
export function PageHeader({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 pb-2">
      <div className="space-y-1.5">
        {eyebrow ? (
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-accent-fg">
            <span aria-hidden="true" className="h-px w-6 bg-brand-gold" />
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-3xl font-semibold tracking-tight text-fg">{title}</h1>
        {description ? <p className="max-w-2xl text-sm text-fg-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
