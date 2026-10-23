import { InputHTMLAttributes, forwardRef, useId, useState } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  showPasswordToggle?: boolean;
  fullWidth?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      error,
      helperText,
      icon,
      iconPosition = 'left',
      showPasswordToggle = false,
      fullWidth = false,
      className = '',
      id: providedId,
      type = 'text',
      disabled,
      required,
      ...props
    },
    ref
  ) => {
    const generatedId = useId();
    const id = providedId || generatedId;
    const errorId = `${id}-error`;
    const helperId = `${id}-helper`;
    const [showPassword, setShowPassword] = useState(false);

    const inputType = showPasswordToggle && showPassword ? 'text' : type;
    const hasError = !!error;

    return (
      <div className={fullWidth ? 'w-100' : ''}>
        {label && (
          <label htmlFor={id} className="form-label small fw-semibold mb-1">
            {label}
            {required && <span className="text-danger ms-1" aria-hidden="true">*</span>}
          </label>
        )}
        <div className="position-relative">
          {icon && iconPosition === 'left' && (
            <span className="position-absolute top-50 start-0 translate-middle-y ms-3 text-muted" aria-hidden="true">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={id}
            type={inputType}
            className={`form-control ${hasError ? 'is-invalid' : ''} ${icon && iconPosition === 'left' ? 'ps-5' : ''} ${showPasswordToggle ? 'pe-5' : ''} ${className}`}
            disabled={disabled}
            required={required}
            aria-invalid={hasError}
            aria-describedby={hasError ? errorId : helperText ? helperId : undefined}
            {...props}
          />
          {showPasswordToggle && (
            <button
              type="button"
              className="btn btn-link text-muted p-0 position-absolute top-50 end-0 translate-middle-y me-3"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              aria-pressed={showPassword}
              tabIndex={-1}
            >
              <i className={`bi ${showPassword ? 'bi-eye-slash' : 'bi-eye'} fs-6`} />
            </button>
          )}
          {icon && iconPosition === 'right' && !showPasswordToggle && (
            <span className="position-absolute top-50 end-0 translate-middle-y me-3 text-muted" aria-hidden="true">
              {icon}
            </span>
          )}
        </div>
        {hasError && (
          <div id={errorId} className="invalid-feedback d-block" role="alert">
            {error}
          </div>
        )}
        {helperText && !hasError && (
          <div id={helperId} className="form-text text-muted mt-1">
            {helperText}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';