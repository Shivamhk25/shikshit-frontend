/* Writes (or with --check, verifies) src/styles/tokens.css. Run through vite-node: `npm run tokens:gen`. */
import { readFileSync, writeFileSync } from 'node:fs';
import { renderTokensCss } from '../src/design-system/tokens-css';

const target = new URL('../src/styles/tokens.css', import.meta.url);
const next = renderTokensCss();

if (process.argv.includes('--check')) {
  let current = '';
  try {
    current = readFileSync(target, 'utf8');
  } catch {
    /* missing counts as stale */
  }
  if (current !== next) {
    console.error('src/styles/tokens.css is out of date. Run `npm run tokens:gen` and commit the result.');
    process.exit(1);
  }
  console.log('tokens.css is up to date');
} else {
  writeFileSync(target, next);
  console.log('wrote src/styles/tokens.css');
}
