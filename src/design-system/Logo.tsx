import { cx } from './cx';

/**
 * The Shikshit mark: an open book under a rising arc, gold on deep ink. Drawn here, owned by Shikshit; no other
 * brand's artwork is used anywhere in the product.
 */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-label="Shikshit" className={className}>
      <rect width="40" height="40" rx="10" fill="var(--color-brand-ink)" />
      <path d="M12 12.5a9 9 0 0 1 16 0" fill="none" stroke="var(--color-brand-gold)" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M9.5 16.5c3.8-1.4 7.2-.9 10.5 1.6v11.4c-3.3-2.5-6.7-3-10.5-1.6Z" fill="var(--color-brand-gold-soft)" />
      <path d="M30.5 16.5c-3.8-1.4-7.2-.9-10.5 1.6v11.4c3.3-2.5 6.7-3 10.5-1.6Z" fill="#FFFFFF" />
    </svg>
  );
}

/** Mark and wordmark. `tone="light"` is for dark brand panels. */
export function Logo({ tone = 'dark', size = 36, className }: { tone?: 'dark' | 'light'; size?: number; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-3', className)}>
      <LogoMark size={size} />
      <span className={cx('font-display text-2xl font-semibold tracking-tight', tone === 'light' ? 'text-white' : 'text-fg')} aria-hidden="true">
        Shikshit
      </span>
    </span>
  );
}
