import { ButtonHTMLAttributes, forwardRef } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline-primary' | 'outline-secondary' | 'outline-success' | 'outline-warning' | 'outline-danger' | 'outline-info' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconPosition = 'left',
      fullWidth = false,
      className = '',
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const baseClasses = 'd-inline-flex align-items-center justify-content-center gap-2 fw-medium rounded-4 transition-all';
    const variantClasses = {
      primary: 'btn btn-primary',
      secondary: 'btn btn-secondary',
      'outline-primary': 'btn btn-outline-primary',
      'outline-secondary': 'btn btn-outline-secondary',
      'outline-success': 'btn btn-outline-success',
      'outline-warning': 'btn btn-outline-warning',
      'outline-danger': 'btn btn-outline-danger',
      'outline-info': 'btn btn-outline-info',
      danger: 'btn btn-danger',
      ghost: 'btn btn-link text-dark',
    };
    const sizeClasses = {
      sm: 'btn-sm px-3 py-1.5',
      md: 'px-4 py-2',
      lg: 'btn-lg px-5 py-2.5',
    };
    const widthClass = fullWidth ? 'w-100' : '';

    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${widthClass} ${className}`}
        disabled={isDisabled}
        aria-busy={loading}
        {...props}
      >
        {loading && (
          <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true">
            <span className="visually-hidden">Loading...</span>
          </span>
        )}
        {icon && iconPosition === 'left' && !loading && <span className="d-flex">{icon}</span>}
        <span className={loading ? 'visually-hidden' : ''}>{children}</span>
        {icon && iconPosition === 'right' && !loading && <span className="d-flex">{icon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';