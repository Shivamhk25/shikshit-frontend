import './styles/tailwind.css';

const root = document.getElementById('root')!;
void import('./shell/entry').then((m) => m.mountShell(root));
