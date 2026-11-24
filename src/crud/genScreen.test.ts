import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** The generator (scripts/gen_screen.mjs) must reproduce the hand-written rooms screen, apart from known cosmetics. */
describe('gen_screen.mjs', () => {
  const norm = (s: string) =>
    s
      .replace(/typesLabel/g, 'label')
      .split('\n')
      .filter((l) => l.trim() && !l.startsWith('/**'))
      .map((l) => l.trim())
      .sort();

  it('regenerates the rooms descriptor and its test into a temp folder without touching the repo', () => {
    const out = mkdtempSync(join(tmpdir(), 'gen-screen-'));
    execFileSync('node', ['scripts/gen_screen.mjs', 'scripts/screens/rooms.json', '--out', out], { cwd: process.cwd() });
    const generated = readFileSync(join(out, 'rooms.ts'), 'utf8');
    const handWritten = readFileSync('src/features/aca/rooms.ts', 'utf8');
    expect(norm(generated)).toEqual(norm(handWritten));
    expect(readFileSync(join(out, 'rooms.descriptor.test.ts'), 'utf8')).toBe(readFileSync('src/features/aca/rooms.descriptor.test.ts', 'utf8'));
  });

  it('is idempotent: a second run into the same folder writes the same files', () => {
    const out = mkdtempSync(join(tmpdir(), 'gen-screen-'));
    const run = () => execFileSync('node', ['scripts/gen_screen.mjs', 'scripts/screens/rooms.json', '--out', out], { cwd: process.cwd() }).toString();
    run();
    const first = readFileSync(join(out, 'rooms.ts'), 'utf8');
    run();
    expect(readFileSync(join(out, 'rooms.ts'), 'utf8')).toBe(first);
  });
});
