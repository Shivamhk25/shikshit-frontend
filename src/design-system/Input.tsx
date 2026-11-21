import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cx } from './cx';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  error?: string;
  hint?: string;
  /** An icon shown inside the field, before the text. */
  leading?: ReactNode;
  /** For passwords: a button that shows or hides what was typed. */
  revealable?: boolean;
  fieldSize?: 'md' | 'lg';
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, error, hint, id, className, leading, revealable, type, fieldSize = 'md', ...rest },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const [shown, setShown] = useState(false);
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-fg">
        {label}
      </label>
      <div className="relative">
        {leading ? <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-fg-subtle [&>svg]:size-4">{leading}</span> : null}
        <input
          ref={ref}
          id={inputId}
          type={revealable && shown ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cx(
            'w-full rounded-md border bg-surface text-md text-fg shadow-soft placeholder:text-fg-subtle transition-[border-color,box-shadow] duration-150',
            'hover:border-line-strong focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle',
            fieldSize === 'lg' ? 'h-12' : 'h-10',
            leading ? 'pl-10' : 'pl-3',
            revealable ? 'pr-11' : 'pr-3',
            error ? 'border-danger' : 'border-line',
            className,
          )}
          {...rest}
        />
        {revealable ? (
          <button
            type="button"
            onClick={() => setShown(!shown)}
            aria-label={shown ? 'Hide password' : 'Show password'}
            aria-pressed={shown}
            className="absolute inset-y-0 right-1 my-1 flex w-9 items-center justify-center rounded text-fg-subtle hover:text-fg"
          >
            {shown ? <EyeOff aria-hidden="true" className="size-4" /> : <Eye aria-hidden="true" className="size-4" />}
          </button>
        ) : null}
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${inputId}-hint`} className="text-sm text-fg-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
