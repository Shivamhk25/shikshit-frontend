import { HTMLAttributes, forwardRef } from 'react';

interface LogoProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'full' | 'icon' | 'text';
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
}

export const Logo = forwardRef<HTMLSpanElement, LogoProps>(
  (
    {
      variant = 'full',
      size = 'md',
      showTagline = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const sizeStyles = {
      sm: { logoHeight: '24px', fontSize: '1.125rem', taglineSize: '0.625rem' },
      md: { logoHeight: '30px', fontSize: '1.5rem', taglineSize: '0.75rem' },
      lg: { logoHeight: '40px', fontSize: '2rem', taglineSize: '0.875rem' },
    };

    const style = sizeStyles[size];

    if (variant === 'icon') {
      return (
        <span ref={ref} className={className} {...props}>
          <img
            alt="pie360"
            draggable="false"
            src="/assets/pie360-logo.png"
            style={{ height: style.logoHeight, width: 'auto', flexShrink: 0, display: 'inline-block', verticalAlign: 'middle' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        </span>
      );
    }

    return (
      <span
        ref={ref}
        className={`d-inline-flex align-items-center gap-2 ${className}`}
        style={{ fontSize: style.fontSize }}
        {...props}
      >
        <img
          alt="pie360"
          draggable="false"
          src="/assets/pie360-logo.png"
          style={{ height: style.logoHeight, width: 'auto', flexShrink: 0, display: 'inline-block', verticalAlign: 'middle' }}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
        {variant === 'full' || variant === 'text' && (
          <>
            <span className="fw-bold" style={{ color: '#cc533a' }}>pie</span><span className="fw-bold" style={{ color: '#73777f' }}>360</span>
            {showTagline && (
              <span className="ms-1 px-1 py-0.5 rounded-4 small fw-medium" style={{ backgroundColor: '#eef2ff', color: '#4682b4', fontSize: style.taglineSize }}>
                Platform for Intelligent Education
              </span>
            )}
          </>
        )}
      </span>
    );
  }
);

Logo.displayName = 'Logo';