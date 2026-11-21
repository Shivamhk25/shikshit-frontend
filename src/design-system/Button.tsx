import { forwardRef, type ButtonHTMLAttributes } from 'react';
import type { VariantProps } from 'class-variance-authority';
import { buttonVariants } from './buttonVariants';
import { Loader2 } from 'lucide-react';
import { cx } from './cx';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, loading = false, disabled, className, type = 'button', children, ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={cx(buttonVariants({ variant, size }), className)} {...rest}>
      {loading ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : null}
      {children}
    </button>
  );
});
