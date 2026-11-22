import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button, Input, KpiCard, ThemeProvider, useTheme } from './index';
import { renderTokensCss } from './tokens-css';

describe('tokens.css', () => {
  it('matches what @shikshit/shared generates (run `npm run tokens:gen` if this fails)', () => {
    const onDisk = readFileSync(resolve(__dirname, '../styles/tokens.css'), 'utf8');
    expect(onDisk).toBe(renderTokensCss());
  });
});

describe('Button', () => {
  it('fires onClick and is disabled while loading', async () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Save</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(<Button loading onClick={onClick}>Save</Button>);
    const btn = screen.getByRole('button', { name: 'Save' });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('aria-busy', 'true');
  });
});

describe('Input', () => {
  it('labels the field and links the error message', () => {
    render(<Input label="Email" error="Required" />);
    const field = screen.getByLabelText('Email');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAccessibleDescription('Required');
  });
});

describe('KpiCard', () => {
  it('shows label, value and delta', () => {
    render(<KpiCard label="Attendance" value="94%" delta="+2%" trend="up" />);
    expect(screen.getByLabelText('Attendance')).toHaveTextContent('94%');
    expect(screen.getByText('+2%')).toHaveClass('text-success');
  });
});

describe('ThemeProvider', () => {
  function Toggle() {
    const { mode, setChoice } = useTheme();
    return <button onClick={() => setChoice(mode === 'light' ? 'dark' : 'light')}>toggle</button>;
  }

  it('sets data-theme, switches mode, and applies then removes a brand accent', async () => {
    const saved: string[] = [];
    const { unmount } = render(
      <ThemeProvider accent="#E11D48" initialChoice="light" onChoiceChange={(c) => saved.push(c)}>
        <Toggle />
      </ThemeProvider>,
    );
    const root = document.documentElement;
    expect(root.getAttribute('data-theme')).toBe('light');
    expect(root.style.getPropertyValue('--color-accent-default')).not.toBe('');

    await userEvent.click(screen.getByText('toggle'));
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(saved).toEqual(['dark']);

    unmount();
    expect(root.style.getPropertyValue('--color-accent-default')).toBe('');
  });

  it('paints a preset: modern changes the display font and corner radii, classic leaves the static tokens alone', () => {
    const root = document.documentElement;
    const { unmount } = render(
      <ThemeProvider preset="modern" initialChoice="light">
        <span />
      </ThemeProvider>,
    );
    expect(root.style.getPropertyValue('--font-display')).toContain('Inter');
    expect(root.style.getPropertyValue('--radius-md')).not.toBe('');
    unmount();
    render(
      <ThemeProvider initialChoice="light">
        <span />
      </ThemeProvider>,
    );
    expect(root.style.getPropertyValue('--font-display')).toBe('');
  });

  it('follows the device when the user chose system', () => {
    const mm = vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() });
    vi.stubGlobal('matchMedia', mm);
    render(
      <ThemeProvider initialChoice="system">
        <span />
      </ThemeProvider>,
    );
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    vi.unstubAllGlobals();
  });

  it('throws when useTheme is used outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Toggle />)).toThrow(/ThemeProvider/);
    spy.mockRestore();
  });
});
