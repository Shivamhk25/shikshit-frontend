import type { Session } from '@shikshit/shared/session';
import { ApiError } from '../../crud/client';

/** IAM-02 Roles (backend api/openapi/modules/iam-roles.yaml). */

export type Scope = 'tenant' | 'class_section';

export interface CatalogPermission {
  code: string;
  module: string;
  resource: string;
  action: string;
  sensitive: boolean;
}

export interface Role {
  id: string;
  code: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  holderCount: number;
  permissionCount: number;
  updatedAt: string;
}

export interface Grant {
  permission: string;
  scope: string;
}

export interface RoleDetail extends Role {
  grants: Grant[];
}

export interface RoleInput {
  name: string;
  description: string | null;
  grants: Grant[];
}

type Problem = { code?: string; detail?: string; errors?: { field: string; message: string }[] };

async function call<T>(session: Pick<Session, 'fetch'>, url: string, method = 'GET', body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await session.fetch(url, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new ApiError(0, 'network', {}, 'Cannot reach the server. Check your connection.');
  }
  if (!res.ok) {
    let p: Problem = {};
    try {
      p = (await res.json()) as Problem;
    } catch {
      /* not JSON */
    }
    const fields: Record<string, string> = {};
    for (const e of p.errors ?? []) fields[e.field] ??= e.message;
    throw new ApiError(res.status, p.code ?? 'error', fields, p.detail ?? (res.status === 403 ? 'You do not have permission to do this.' : 'Something went wrong. Please try again.'));
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export function createRolesApi(session: Pick<Session, 'fetch'>, base: string) {
  const items = <T>(p: Promise<{ items: T[] }>) => p.then((r) => r.items);
  return {
    catalog: () => items(call<{ items: CatalogPermission[] }>(session, `${base}/permissions/catalog`)),
    list: () => items(call<{ items: Role[] }>(session, `${base}/roles`)),
    get: (id: string) => call<RoleDetail>(session, `${base}/roles/${id}`),
    create: (input: RoleInput) => call<RoleDetail>(session, `${base}/roles`, 'POST', input),
    update: (id: string, input: RoleInput) => call<RoleDetail>(session, `${base}/roles/${id}`, 'PATCH', input),
    clone: (id: string, name: string) => call<RoleDetail>(session, `${base}/roles/${id}/clone`, 'POST', { name }),
    remove: (id: string) => call<void>(session, `${base}/roles/${id}`, 'DELETE'),
    userRoles: (userId: string) => items(call<{ items: Role[] }>(session, `${base}/users/${userId}/roles`)),
    setUserRoles: (userId: string, roleIds: string[]) => items(call<{ items: Role[] }>(session, `${base}/users/${userId}/roles`, 'PUT', { roleIds })),
  };
}
export type RolesApi = ReturnType<typeof createRolesApi>;

// ---- matrix model: pure, so it is unit-tested without a browser

/** Resources whose records the server can narrow to the holder's assigned class sections (backend scopedResources). */
export const CLASS_SECTION_RESOURCES = new Set(['stu.students']);

const MODULE_LABEL: Record<string, string> = {
  iam: 'Users and access',
  wfl: 'Approvals',
  onb: 'Onboarding',
  aca: 'Academic setup',
  adm: 'Admissions',
  stu: 'Students',
  fee: 'Fees',
  att: 'Attendance',
  exm: 'Exams',
  asg: 'Assignments',
  crt: 'Certificates',
};
const ACTION_ORDER = ['view', 'create', 'edit', 'delete', 'export', 'import', 'commit', 'rollback', 'review', 'approve', 'manage'];

export const moduleLabel = (m: string) => MODULE_LABEL[m] ?? m.toUpperCase();
export const words = (s: string) => {
  const t = s.replace(/_/g, ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

export interface MatrixRow {
  key: string; // module.resource
  label: string;
  sensitive: boolean;
  actions: Record<string, string>; // action -> permission code
  scopable: boolean;
}

export interface MatrixModule {
  module: string;
  label: string;
  actions: string[]; // the columns this module needs, in a fixed order
  rows: MatrixRow[];
}

/** Groups the catalog into modules, resources (rows) and actions (columns). */
export function buildMatrix(catalog: CatalogPermission[]): MatrixModule[] {
  const mods = new Map<string, MatrixModule>();
  for (const p of catalog) {
    let m = mods.get(p.module);
    if (!m) {
      m = { module: p.module, label: moduleLabel(p.module), actions: [], rows: [] };
      mods.set(p.module, m);
    }
    const key = `${p.module}.${p.resource}`;
    let row = m.rows.find((r) => r.key === key);
    if (!row) {
      row = { key, label: words(p.resource), sensitive: false, actions: {}, scopable: CLASS_SECTION_RESOURCES.has(key) };
      m.rows.push(row);
    }
    row.actions[p.action] = p.code;
    row.sensitive ||= p.sensitive;
    if (!m.actions.includes(p.action)) m.actions.push(p.action);
  }
  const rank = (a: string) => (ACTION_ORDER.indexOf(a) < 0 ? 99 : ACTION_ORDER.indexOf(a));
  return [...mods.values()].map((m) => ({ ...m, actions: [...m.actions].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b)), rows: [...m.rows].sort((a, b) => a.label.localeCompare(b.label)) }));
}

/** The editor state: which permissions are ticked, and one scope per resource row. */
export interface Selection {
  granted: Set<string>;
  rowScope: Record<string, Scope>;
}

export function selectionFrom(grants: Grant[]): Selection {
  const granted = new Set<string>();
  const rowScope: Record<string, Scope> = {};
  for (const g of grants) {
    granted.add(g.permission);
    const key = g.permission.slice(0, g.permission.lastIndexOf('.'));
    // A row shows the narrow scope only when every ticked action in it is narrow.
    if (g.scope === 'class_section' && rowScope[key] !== 'tenant') rowScope[key] = 'class_section';
    else rowScope[key] = 'tenant';
  }
  return { granted, rowScope };
}

/** Grants to send: each ticked permission, with its row's scope (whole school unless the row can be narrowed). */
export function grantsFrom(sel: Selection, matrix: MatrixModule[]): Grant[] {
  const scopable = new Set(matrix.flatMap((m) => m.rows.filter((r) => r.scopable).map((r) => r.key)));
  return [...sel.granted].sort().map((permission) => {
    const key = permission.slice(0, permission.lastIndexOf('.'));
    return { permission, scope: scopable.has(key) && sel.rowScope[key] === 'class_section' ? 'class_section' : 'tenant' };
  });
}

/** How the edit differs from what is saved, for the save bar. */
export function diff(before: Grant[], after: Grant[]): { added: number; removed: number; changed: number } {
  const was = new Map(before.map((g) => [g.permission, g.scope]));
  const now = new Map(after.map((g) => [g.permission, g.scope]));
  let added = 0;
  let changed = 0;
  for (const [p, s] of now) {
    if (!was.has(p)) added++;
    else if (was.get(p) !== s) changed++;
  }
  let removed = 0;
  for (const p of was.keys()) if (!now.has(p)) removed++;
  return { added, removed, changed };
}
