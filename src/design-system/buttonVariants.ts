import { cva } from 'class-variance-authority';

/** Class names for every button style. Kept apart from Button so links styled as buttons can use them too. */
export const buttonVariants = cva(
  [
    'inline-flex select-none items-center justify-center gap-2 rounded-md font-medium tracking-[0.005em] transition-[background-color,border-color,color,box-shadow] duration-150',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    'disabled:cursor-not-allowed disabled:opacity-55',
  ],
  {
    variants: {
      variant: {
        primary: 'bg-accent text-on-accent shadow-soft hover:bg-accent-hover active:bg-accent-active',
        secondary: 'border border-line bg-surface text-fg shadow-soft hover:border-line-strong hover:bg-subtle',
        ghost: 'bg-transparent text-fg-muted hover:bg-subtle hover:text-fg',
        danger: 'border border-danger-line bg-surface text-danger hover:bg-danger-bg',
        destructive: 'bg-danger text-white shadow-soft hover:opacity-90',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-sm',
        lg: 'h-12 px-5 text-md',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);
