import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createTheme, toCssVariables, type Theme } from '@shikshit/shared/tokens';

type ThemeMode = Theme['mode'];

interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Applies the colour mode to <html data-theme> and, when an institute has its own brand colour, overrides the
 * accent variables at runtime. Without an accent the defaults in tokens.css apply.
 */
export function ThemeProvider({
  children,
  initialMode = 'light',
  accent,
}: {
  children: ReactNode;
  initialMode?: ThemeMode;
  accent?: string;
}) {
  const [mode, setMode] = useState<ThemeMode>(initialMode);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', mode);
    const applied: string[] = [];
    if (accent) {
      const vars = toCssVariables(createTheme(mode, accent));
      for (const [name, value] of Object.entries(vars)) {
        if (name.startsWith('--color-accent-') || name === '--color-focus-ring') {
          root.style.setProperty(name, value);
          applied.push(name);
        }
      }
    }
    return () => applied.forEach((name) => root.style.removeProperty(name));
  }, [mode, accent]);

  const value = useMemo(() => ({ mode, setMode }), [mode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
