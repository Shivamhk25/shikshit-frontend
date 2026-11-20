import './styles/tailwind.css';

const root = document.getElementById('root')!;

// The legacy app is loaded only when asked for, so the new shell ships none of its code or styles.
if (import.meta.env.VITE_LEGACY_UI === '1') {
  void import('./legacy-entry').then((m) => m.mountLegacy(root));
} else {
  void import('./shell/entry').then((m) => m.mountShell(root));
}
