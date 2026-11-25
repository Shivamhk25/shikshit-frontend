#!/usr/bin/env node
// Generates a CrudPage screen from a JSON spec (decision 0025, item 2). No dependencies.
//
//   node scripts/gen_screen.mjs scripts/screens/<name>.json            write descriptor + test and wire the screen
//   node scripts/gen_screen.mjs scripts/screens/<name>.json --out DIR  write only the two generated files into DIR
//
// Writes src/features/<module>/<name>.ts and <name>.descriptor.test.ts, then adds, only when missing (safe to rerun):
// registry.ts entry, ShellApp.tsx import + route, navIcons.ts icon + blurb, and in scripts/ui/review.mjs the menu
// entry, permissions, a mocked list endpoint and one screen (the review runs every screen at desktop and phone width).
// Spec fields: see scripts/screens/rooms.json. Business rules (what a field means) stay the author's to decide.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const outAt = args.indexOf('--out');
const outDir = outAt >= 0 ? resolve(args[outAt + 1]) : null;
const specPath = args.find((a, i) => !a.startsWith('--') && (outAt < 0 || i !== outAt + 1));
if (!specPath) {
  console.error('usage: node scripts/gen_screen.mjs <spec.json> [--out DIR]');
  process.exit(2);
}
const spec = JSON.parse(readFileSync(resolve(specPath), 'utf8'));
for (const k of ['name', 'Type', 'module', 'screenId', 'title', 'singular', 'endpoint', 'permission', 'icon', 'blurb', 'defaultSort', 'searchPlaceholder', 'label', 'fields', 'columns', 'review']) {
  if (spec[k] === undefined) throw new Error(`spec is missing "${k}"`);
}
const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const consts = spec.consts ?? {};
const labelFn = (c) => `${c.toLowerCase()}Label`;
const tsType = (f) => {
  const base = f.kind === 'number' ? 'number' : f.kind === 'checkbox' ? 'boolean' : f.enum ? f.enum.map((e) => q(e.value)).join(' | ') : 'string';
  return f.nullable ? `${base} | null` : base;
};
const opts = (list, pad) => `[\n${list.map((o) => `${pad}  { value: ${q(o.value)}, label: ${q(o.label)} },`).join('\n')}\n${pad}]`;

// ---- descriptor
function fieldLine(f) {
  const p = [`key: ${q(f.key)}`, `label: ${q(f.label)}`, `kind: ${q(f.kind)}`];
  if (f.required) p.push('required: true');
  if (f.maxLength) p.push(`maxLength: ${f.maxLength}`);
  if (f.min !== undefined) p.push(`min: ${f.min}`);
  if (f.max !== undefined) p.push(`max: ${f.max}`);
  if (f.step !== undefined) p.push(`step: ${f.step}`);
  if (f.default !== undefined) p.push(`defaultValue: ${typeof f.default === 'string' ? q(f.default) : f.default}`);
  if (f.hint) p.push(`hint: ${q(f.hint)}`);
  if (f.optionsConst) p.push(`options: ${f.optionsConst}`);
  if (f.remote) p.push(`remote: ${JSON.stringify(f.remote).replace(/"([a-zA-Z]+)":/g, '$1: ').replace(/"/g, "'").replace(/,/g, ', ')}`);
  const flat = `    { ${p.join(', ')}${f.options ? '' : ' },'}`;
  if (!f.options) return flat.length <= 150 ? flat : `    {\n${p.map((x) => `      ${x},`).join('\n')}\n    },`;
  return `    {\n${p.map((x) => `      ${x},`).join('\n')}\n      options: ${opts(f.options, '      ')},\n    },`;
}
const toFormExpr = (f) => (f.kind === 'number' || f.kind === 'checkbox' || !f.nullable ? `r.${f.key}` : `r.${f.key} ?? ''`);
function toInputExpr(f) {
  const v = `v.${f.key}`;
  if (f.kind === 'checkbox') return `${v} === true`;
  if (f.kind === 'number') return f.nullable ? `${v} === '' ? null : Number(${v})` : f.required ? `Number(${v})` : `Number(${v} || 0)`;
  if (f.nullable) return `orNull(${v})`;
  return typeof f.default === 'string' && !f.required ? `text(${v}) || ${q(f.default)}` : f.default !== undefined ? `text(${v}) || ${q(f.default)}` : `text(${v})`;
}
function columnLine(c) {
  const f = spec.fields.find((x) => x.key === c.key);
  const p = [`key: ${q(c.key)}`, `label: ${q(c.label)}`];
  if (c.sort) p.push(`sort: ${q(c.sort)}`);
  if (c.render === 'dash') p.push(`render: (r) => r.${c.key} ?? '—'`);
  else if (c.render === 'active') p.push(`render: (r) => (r.${c.key} === 'active' ? 'Active' : 'Inactive')`);
  else if (c.render?.startsWith('options:')) p.push(`render: (r) => ${labelFn(c.render.slice(8))}(r.${c.key})`);
  else if (c.render === 'yesno') p.push(`render: (r) => (r.${c.key} ? 'Yes' : 'No')`);
  else if (f?.nullable && f.kind === 'number') p.push(`render: (r) => (r.${c.key} === null ? '—' : String(r.${c.key}))`);
  return `    { ${p.join(', ')} },`;
}
function descriptor() {
  const perm = spec.permission;
  const out = [];
  out.push(`import type { CrudDescriptor, FormValues } from '../../crud/descriptor';`, '');
  out.push(`export interface ${spec.Type} {`, '  id: string;', ...spec.fields.map((f) => `  ${f.key}: ${tsType(f)};`), '}', '');
  for (const [c, list] of Object.entries(consts)) out.push(`const ${c} = ${opts(list, '')};`);
  for (const [c] of Object.entries(consts)) if (spec.columns.some((x) => x.render === `options:${c}`)) out.push(`const ${labelFn(c)} = (v: string | null) => ${c}.find((t) => t.value === v)?.label ?? '—';`);
  out.push(`const text = (v: string | number | boolean | undefined) => String(v ?? '').trim();`);
  if (spec.fields.some((f) => f.nullable && f.kind !== 'number' && f.kind !== 'checkbox')) out.push(`const orNull = (v: string | number | boolean | undefined) => text(v) || null;`);
  out.push('', `/** ${spec.doc ?? spec.title}. Generated by scripts/gen_screen.mjs from scripts/screens/${spec.name}.json. */`);
  out.push(`export const ${spec.name}Descriptor: CrudDescriptor<${spec.Type}> = {`);
  out.push(`  singular: ${q(spec.singular)},`, `  title: ${q(spec.title)},`, `  endpoint: ${q(spec.endpoint)},`);
  out.push(`  permissions: { view: ${q(perm + '.view')}, create: ${q(perm + '.create')}, edit: ${q(perm + '.edit')}, delete: ${q(perm + '.delete')} },`);
  out.push(`  defaultSort: ${q(spec.defaultSort)},`, `  searchPlaceholder: ${q(spec.searchPlaceholder)},`, `  label: (r) => r.${spec.label},`);
  out.push('  columns: [', ...spec.columns.map(columnLine), '  ],');
  out.push('  fields: [', ...spec.fields.map(fieldLine), '  ],');
  if (spec.filters?.length) {
    out.push('  filters: [');
    for (const f of spec.filters) out.push(`    { key: ${q(f.key)}, label: ${q(f.label)}, kind: ${q(f.kind)}${f.options ? `, options: ${opts(f.options, '    ')}` : ''} },`);
    out.push('  ],');
  }
  if (spec.rowActions?.length) {
    out.push('  rowActions: [');
    for (const a of spec.rowActions) {
      out.push('    {', `      key: ${q(a.key)},`, `      label: ${q(a.label)},`, `      permission: ${q(a.permission)},`);
      if (a.visibleWhen) out.push(`      visible: (r) => r.${a.visibleWhen.key} === ${q(a.visibleWhen.equals)},`);
      out.push(`      endpoint: (r) => \`${spec.endpoint}/\${r.id}/${a.path}\`,`);
      out.push(`      confirm: (r) => ({ title: \`${a.confirmTitle.replace('{label}', '${r.' + spec.label + '}')}\`, body: ${q(a.confirmBody)} }),`);
      out.push(`      success: () => ${q(a.success)},`, '    },');
    }
    out.push('  ],');
  }
  out.push(`  toForm: (r): FormValues => ({`, ...spec.fields.map((f) => `    ${f.key}: ${toFormExpr(f)},`), '  }),');
  out.push(`  toInput: (v) => ({`, ...spec.fields.map((f) => `    ${f.key}: ${toInputExpr(f)},`), '  }),', '};', '');
  return out.join('\n');
}

// ---- descriptor test
function descriptorTest() {
  const d = `${spec.name}Descriptor`;
  const row = JSON.stringify({ id: 'id-1', ...spec.review.rows[0] });
  return `import { describe, expect, it } from 'vitest';
import { blankValues } from '../../crud/descriptor';
import { registry } from '../../shell/registry';
import { NAV_ICONS } from '../../shell/navIcons';
import { ${d}, type ${spec.Type} } from './${spec.name}';

const row = ${row} as ${spec.Type};

describe('${spec.name} descriptor', () => {
  it('uses the ${spec.permission} permissions and the ${spec.endpoint} endpoint', () => {
    expect(${d}.endpoint).toBe(${q(spec.endpoint)});
    expect(Object.values(${d}.permissions)).toEqual(['view', 'create', 'edit', 'delete'].map((a) => \`${spec.permission}.\${a}\`));
  });

  it('sends exactly the form fields, and a row round-trips through the form', () => {
    const keys = ${d}.fields.map((f) => f.key).sort();
    expect(Object.keys(${d}.toInput(blankValues(${d}.fields))).sort()).toEqual(keys);
    expect(Object.keys(${d}.toForm(row)).sort()).toEqual(keys);
    expect(${d}.toInput(${d}.toForm(row))).toMatchObject(${JSON.stringify(Object.fromEntries(spec.fields.filter((f) => f.kind !== 'number' || !f.nullable).slice(0, 3).map((f) => [f.key, spec.review.rows[0][f.key]])))});
  });

  it('shows every column for a row and labels it for the delete question', () => {
    for (const c of ${d}.columns) expect(String(c.render ? c.render(row) : row[c.key as keyof ${spec.Type}] ?? '')).not.toBe('undefined');
    expect(${d}.label(row)).toBe(row.${spec.label});
  });

  it('is registered with its permission, path and icon', () => {
    expect(registry.${spec.screenId}?.permission).toBe(${q(spec.permission + '.view')});
    expect(registry.${spec.screenId}?.web?.path).toBe(${q(spec.webPath ?? spec.endpoint)});
    expect(NAV_ICONS.${spec.screenId}).toBeDefined();
  });
});
`;
}

// ---- wiring (each step only when missing)
const changed = [];
function edit(rel, fn) {
  const file = join(ROOT, rel);
  const before = readFileSync(file, 'utf8');
  const after = fn(before);
  if (after !== before) {
    writeFileSync(file, after);
    changed.push(rel);
  }
}
function before(src, anchor, text, rel) {
  const i = src.indexOf(anchor);
  if (i < 0) throw new Error(`${rel}: anchor not found: ${anchor.slice(0, 60)}`);
  return src.slice(0, i) + text + src.slice(i);
}
function wire() {
  const id = spec.screenId;
  const path = spec.webPath ?? spec.endpoint;
  const seg = path.replace(/^\//, '');
  const d = `${spec.name}Descriptor`;
  edit('src/shell/registry.ts', (s) => {
    if (s.includes(`screenId: '${id}'`)) return s;
    const mobile = spec.mobileRoute ? `, mobile: { route: ${q(spec.mobileRoute)} }` : '';
    return before(s, "  { screenId: 'approvals'", `  { screenId: '${id}', title: ${q(spec.title)}, permission: ${q(spec.permission + '.view')}, module: ${q(spec.module)}, parity: ${q(spec.parity ?? 'Web-only')}, web: { path: ${q(path)} }${mobile} },\n`, 'registry.ts');
  });
  edit('src/shell/ShellApp.tsx', (s) => {
    let o = s;
    if (o.includes(`path="${seg}"`)) return o; // the screen already has a route (hand-written page): leave it alone
    if (!o.includes(`from '../features/${spec.module}/${spec.name}'`)) o = before(o, '\nfunction Gate()', `import { ${d} } from '../features/${spec.module}/${spec.name}';\n`, 'ShellApp.tsx');
    {
      o = before(o, '          <Route path="*"', `          <Route\n            path="${seg}"\n            element={\n              <RequirePermission path="${path}">\n                <ResourcePage descriptor={${d}} />\n              </RequirePermission>\n            }\n          />\n`, 'ShellApp.tsx');
    }
    return o;
  });
  edit('src/shell/navIcons.ts', (s) => {
    let o = s;
    if (!new RegExp(`[ ,{]${spec.icon}[,\\s]`).test(o.slice(0, o.indexOf("from 'lucide-react'")))) o = o.replace('type LucideIcon,', `${spec.icon}, type LucideIcon,`);
    if (!o.includes(`\n  ${id}: ${spec.icon},`) && !new RegExp(`\\n  ${id}: [A-Za-z0-9]+,`).test(o.slice(0, o.indexOf('NAV_BLURBS')))) o = before(o, '  profile: UserRound,', `  ${id}: ${spec.icon},\n`, 'navIcons.ts');
    const b = o.indexOf('NAV_BLURBS');
    if (!new RegExp(`\\n  ${id}: '`).test(o.slice(b))) {
      const end = o.indexOf('\n};', b) + 1;
      o = o.slice(0, end) + `  ${id}: ${q(spec.blurb)},\n` + o.slice(end);
    }
    return o;
  });
  edit('scripts/ui/review.mjs', (s) => {
    let o = s;
    const slug = path.replace(/^\//, '');
    if (!o.includes(`screenId: '${id}'`)) o = before(o, "  { screenId: 'approvals'", `  { screenId: '${id}', label: ${q(spec.title)}, order: ${spec.review.order ?? 50} },\n`, 'review.mjs');
    if (!o.includes(`'${spec.permission}.view'`)) o = before(o, "const admission = (n, o)", `permissions.push(${['view', 'create', 'edit', 'delete'].map((a) => q(`${spec.permission}.${a}`)).join(', ')});\n`, 'review.mjs');
    if (!o.includes(`path === '${spec.endpoint}')`)) {
      const items = JSON.stringify(spec.review.rows.map((r, i) => ({ id: `${spec.name}${i + 1}`, ...r })));
      o = before(o, "    if (path === '/enquiry-discussions') {", `    if (path === '${spec.endpoint}') return json(200, { items: ${items}, page: { number: 1, size: 25, total: ${spec.review.rows.length} } });\n`, 'review.mjs');
    }
    if (!o.includes(`name: '${slug}'`)) o = before(o, "  { name: 'palette'", `  { name: '${slug}', path: ${q(path)}, signedIn: true, ready: ${q('text=' + spec.review.rows[0][spec.label])} },\n  { name: '${slug}-add', path: ${q(path)}, signedIn: true, ready: ${q('text=' + spec.review.rows[0][spec.label])}, then: (p) => p.getByRole('button', { name: ${q('Add ' + spec.singular)} }).click().then(() => p.waitForSelector('role=dialog')) },\n`, 'review.mjs');
    return o;
  });
}

const files = { [`${spec.name}.ts`]: descriptor(), [`${spec.name}.descriptor.test.ts`]: descriptorTest() };
const dir = outDir ?? join(ROOT, 'src/features', spec.module);
mkdirSync(dir, { recursive: true });
for (const [name, body] of Object.entries(files)) {
  const f = join(dir, name);
  if (!outDir && existsSync(f) && readFileSync(f, 'utf8') === body) continue;
  writeFileSync(f, body);
  changed.push(outDir ? f : `src/features/${spec.module}/${name}`);
}
if (!outDir) wire();
console.log(changed.length ? `wrote:\n  ${changed.join('\n  ')}` : 'nothing to change (already generated and wired)');
