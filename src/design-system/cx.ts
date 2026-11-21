import { twMerge } from 'tailwind-merge';

/** Joins class names, skipping falsy values; a later Tailwind class wins over an earlier one of the same kind
 * (`cx('px-3', 'px-5')` gives `px-5`), so callers can override a component's defaults safely. */
export const cx = (...parts: Array<string | false | null | undefined>): string => twMerge(parts.filter(Boolean).join(' '));
