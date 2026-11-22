import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createTheme, resolveMode, toCssVariables, type Preset, type Theme, type ThemeMode } from '@shikshit/shared/tokens';

type Mode = Theme['mode'];

interface ThemeContextValue {
  /** The mode being painted (light or dark). */
  mode: Mode;
  /** What the user chose: light, dark or follow the device. */
  choice: ThemeMode;
  setChoice: (choice: ThemeMode) => void;
  /** Paints a look before it is saved (the Appearance screen's preview); null goes back to the institute's. */
  preview: (look: { accent: string; preset: Preset } | null) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const darkQuery = () => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null);

/** CSS variables that differ between looks. Everything else (spacing, sizes, motion) is the same in every preset. */
function lookVariables(theme: Theme): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(toCssVariables(theme))) {
    if (name.startsWith('--color-') || name.startsWith('--shadow-') || name.startsWith('--radius-')) out[name] = value;
  }
  // Tailwind reads the display family from --font-display (see tokens-css.ts)
  out['--font-display'] = theme.font.display;
  return out;
}

/**
 * Paints the institute's look (accent and preset, decision 0005) in the user's chosen mode. The static tokens.css holds
 * the classic look with the default accent; anything else is applied as variables on <html> at runtime.
 */
export function ThemeProvider({
  children,
  accent,
  preset = 'classic',
  initialChoice = 'system',
  onChoiceChange,
}: {
  children: ReactNode;
  accent?: string;
  preset?: Preset;
  initialChoice?: ThemeMode;
  /** Called when the user picks a mode, to save it (PUT /me/preferences). */
  onChoiceChange?: (choice: ThemeMode) => void;
}) {
  const [choice, setChoiceState] = useState<ThemeMode>(initialChoice);
  const [deviceDark, setDeviceDark] = useState(() => darkQuery()?.matches ?? false);
  const [previewLook, setPreviewLook] = useState<{ accent: string; preset: Preset } | null>(null);
  useEffect(() => setChoiceState(initialChoice), [initialChoice]);

  useEffect(() => {
    const q = darkQuery();
    if (!q) return;
    const onChange = (e: MediaQueryListEvent) => setDeviceDark(e.matches);
    q.addEventListener('change', onChange);
    return () => q.removeEventListener('change', onChange);
  }, []);

  const mode = resolveMode(choice, deviceDark);
  const look = previewLook ?? { accent, preset };

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', mode);
    const applied: string[] = [];
    if (look.accent || look.preset !== 'classic') {
      for (const [name, value] of Object.entries(lookVariables(createTheme(mode, look.accent, look.preset)))) {
        root.style.setProperty(name, value);
        applied.push(name);
      }
    }
    return () => applied.forEach((name) => root.style.removeProperty(name));
  }, [mode, look.accent, look.preset]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      mode,
      choice,
      setChoice: (c) => {
        setChoiceState(c);
        onChoiceChange?.(c);
      },
      preview: setPreviewLook,
    }),
    [mode, choice, onChoiceChange],
  );
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
