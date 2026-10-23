import { HTMLAttributes, forwardRef } from 'react';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'warning' | 'info' | 'light' | 'dark' | 'outline-primary' | 'outline-secondary' | 'outline-success' | 'outline-danger' | 'outline-warning' | 'outline-info' | 'outline-light' | 'outline-dark';
  pill?: boolean;
  dot?: boolean;
  dotColor?: string;
}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      variant = 'primary',
      pill = false,
      dot = false,
      dotColor,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const isOutline = variant.startsWith('outline-');
    const baseVariant = isOutline ? variant.replace('outline-', '') : variant;
    
    const solidVariantClasses = {
      primary: 'bg-primary',
      secondary: 'bg-secondary',
      success: 'bg-success',
      danger: 'bg-danger',
      warning: 'bg-warning text-dark',
      info: 'bg-info text-dark',
      light: 'bg-light text-dark',
      dark: 'bg-dark',
    };

    const outlineVariantClasses = {
      primary: 'bg-transparent border border-primary text-primary',
      secondary: 'bg-transparent border border-secondary text-secondary',
      success: 'bg-transparent border border-success text-success',
      danger: 'bg-transparent border border-danger text-danger',
      warning: 'bg-transparent border border-warning text-warning',
      info: 'bg-transparent border border-info text-info',
      light: 'bg-transparent border border-light text-light',
      dark: 'bg-transparent border border-dark text-dark',
    };

    const variantClasses = isOutline ? outlineVariantClasses : solidVariantClasses;

    const variantClass = variantClasses[baseVariant as keyof typeof variantClasses];
    
    return (
      <span
        ref={ref}
        className={`badge ${variantClass} ${pill ? 'rounded-pill' : 'rounded-4'} ${className}`}
        {...props}
      >
        {dot && (
          <span
            className="me-1 rounded-circle d-inline-block"
            style={{ width: '6px', height: '6px', backgroundColor: dotColor || 'currentColor', verticalAlign: 'middle' }}
            aria-hidden="true"
          />
        )}
        {children}
      </span>
    );
  }
);

Badge.displayName = 'Badge';