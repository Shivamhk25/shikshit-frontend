import type { Session } from '@shikshit/shared/session';

export interface ListParams {
  page: number;
  pageSize: number;
  sort?: string;
  q?: string;
  /** Extra query filters, e.g. { status: 'active' }. Empty values are left out. */
  filters?: Record<string, string>;
}

export interface PageResult<T> {
  items: T[];
  total: number;
}

/** A failed API call, reduced to what screens need: a stable code, and messages per field for form errors. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly fields: Record<string, string> = {},
    message = 'Something went wrong.',
  ) {
    super(message);
  }
}

interface Problem {
  code?: string;
  detail?: string;
  errors?: { field: string; message: string }[];
}

async function toError(res: Response): Promise<ApiError> {
  let p: Problem = {};
  try {
    p = (await res.json()) as Problem;
  } catch {
    /* not JSON */
  }
  const fields: Record<string, string> = {};
  for (const e of p.errors ?? []) fields[e.field] ??= e.message;
  const fallback = res.status === 403 ? 'You do not have permission to do this.' : res.status === 404 ? 'This item no longer exists.' : 'Something went wrong. Please try again.';
  return new ApiError(res.status, p.code ?? 'error', fields, p.detail ?? fallback);
}

/** Calls the standard list / create / replace / delete endpoints of a resource (see api/openapi modules). */
export function createCrudClient<T extends { id: string }, I>(session: Pick<Session, 'fetch'>, base: string, endpoint: string) {
  const url = `${base}${endpoint}`;
  const send = async (method: string, path: string, body?: unknown): Promise<Response> => {
    let res: Response;
    try {
      res = await session.fetch(`${url}${path}`, { method, headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new ApiError(0, 'network', {}, 'Cannot reach the server. Check your connection.');
    }
    if (!res.ok) throw await toError(res);
    return res;
  };

  return {
    async list(p: ListParams): Promise<PageResult<T>> {
      const qs = new URLSearchParams({ page: String(p.page), pageSize: String(p.pageSize) });
      if (p.sort) qs.set('sort', p.sort);
      if (p.q) qs.set('q', p.q);
      for (const [k, v] of Object.entries(p.filters ?? {})) if (v !== '') qs.set(k, v);
      const body = (await (await send('GET', `?${qs.toString()}`)).json()) as { items: T[]; page: { total: number } };
      return { items: body.items, total: body.page.total };
    },
    async create(input: I): Promise<T> {
      return (await (await send('POST', '', input)).json()) as T;
    },
    async update(id: string, input: I): Promise<T> {
      return (await (await send('PUT', `/${encodeURIComponent(id)}`, input)).json()) as T;
    },
    async remove(id: string): Promise<void> {
      await send('DELETE', `/${encodeURIComponent(id)}`);
    },
  };
}

export type CrudClient<T extends { id: string }, I> = ReturnType<typeof createCrudClient<T, I>>;
