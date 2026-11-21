import { ApiError } from '../../crud/client';
import type { Session } from '@shikshit/shared/session';

export type Strategy = 'insert' | 'update' | 'upsert';
export type CommitMode = 'all_or_nothing' | 'skip_invalid';
export type BatchStatus = 'uploaded' | 'validating' | 'validated' | 'committing' | 'committed' | 'rolling_back' | 'rolled_back' | 'failed';
export type RowStatus = 'pending' | 'valid' | 'warning' | 'error' | 'committed' | 'skipped' | 'reverted' | 'revert_failed';

export interface ImportColumn {
  key: string;
  label: string;
  required: boolean;
  kind: string;
  hint?: string;
  example?: string;
  allowed?: string[];
}

export interface ImportEntity {
  key: string;
  title: string;
  domain: string;
  templateVersion: number;
  columns: ImportColumn[];
}

export interface ImportProblem {
  column?: string;
  code: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ImportBatch {
  id: string;
  entity: string;
  strategy: Strategy;
  commitMode: CommitMode;
  status: BatchStatus;
  fileName: string;
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  committedRows: number;
  revertedRows: number;
  progressDone: number;
  progressTotal: number;
  failure: string | null;
  createdAt: string;
  committedAt: string | null;
  rollbackDeadline: string | null;
  fileProblems?: ImportProblem[];
}

export interface ImportRow {
  rowNo: number;
  status: RowStatus;
  action: 'create' | 'update' | null;
  cells: Record<string, string>;
  problems: ImportProblem[];
}

export interface PackStep {
  entity: string;
  title: string;
  order: number;
  count: number;
  state: 'done' | 'todo' | 'waiting';
  required: boolean;
  requires: string[];
  next: boolean;
}

export interface PackRule {
  key: string;
  label: string;
  met: boolean;
  checked: boolean;
  detail?: string;
}

export interface ImportPack {
  key: string;
  title: string;
  domain: string;
  ready: boolean;
  steps: PackStep[];
  rules: PackRule[];
}

export interface Paged<T> {
  items: T[];
  total: number;
}

/** Statuses after which a batch stops changing by itself, so polling can stop. */
export const SETTLED: BatchStatus[] = ['validated', 'committed', 'rolled_back', 'failed'];

async function toError(res: Response): Promise<ApiError> {
  let p: { code?: string; detail?: string; errors?: { field: string; message: string }[] } = {};
  try {
    p = (await res.json()) as typeof p;
  } catch {
    /* not JSON */
  }
  const fields: Record<string, string> = {};
  for (const e of p.errors ?? []) fields[e.field] ??= e.message;
  const fallback =
    res.status === 413 ? 'The file is too large.' : res.status === 403 ? 'You do not have permission to do this.' : res.status === 404 ? 'This item no longer exists.' : 'Something went wrong. Please try again.';
  return new ApiError(res.status, p.code ?? 'error', fields, p.detail ?? Object.values(fields)[0] ?? fallback);
}

/** Calls the /onboarding import operations. Every call is authenticated and renews the access token on its own. */
export function createImportApi(session: Pick<Session, 'fetch'>, base: string) {
  const call = async (path: string, init?: RequestInit): Promise<Response> => {
    let res: Response;
    try {
      res = await session.fetch(`${base}/onboarding${path}`, init);
    } catch {
      throw new ApiError(0, 'network', {}, 'Cannot reach the server. Check your connection.');
    }
    if (!res.ok) throw await toError(res);
    return res;
  };
  const json = async <T>(path: string, init?: RequestInit): Promise<T> => (await call(path, init)).json() as Promise<T>;

  return {
    async entities(): Promise<ImportEntity[]> {
      return (await json<{ items: ImportEntity[] }>('/entities')).items;
    },
    pack(key: string): Promise<ImportPack> {
      return json<ImportPack>(`/packs/${encodeURIComponent(key)}`);
    },
    template(entity: string): Promise<Blob> {
      return call(`/templates/${encodeURIComponent(entity)}`).then((r) => r.blob());
    },
    upload(input: { entity: string; strategy: Strategy; commitMode: CommitMode; file: File }): Promise<ImportBatch> {
      const form = new FormData();
      form.set('entity', input.entity);
      form.set('strategy', input.strategy);
      form.set('commitMode', input.commitMode);
      form.set('file', input.file, input.file.name);
      return json<ImportBatch>('/imports', { method: 'POST', body: form });
    },
    batch(id: string): Promise<ImportBatch> {
      return json<ImportBatch>(`/imports/${encodeURIComponent(id)}`);
    },
    async batches(page = 1, pageSize = 10): Promise<Paged<ImportBatch>> {
      const b = await json<{ items: ImportBatch[]; page: { total: number } }>(`/imports?page=${page}&pageSize=${pageSize}`);
      return { items: b.items, total: b.page.total };
    },
    async rows(id: string, opts: { page: number; pageSize: number; status?: RowStatus }): Promise<Paged<ImportRow>> {
      const qs = new URLSearchParams({ page: String(opts.page), pageSize: String(opts.pageSize) });
      if (opts.status) qs.set('status', opts.status);
      const b = await json<{ items: ImportRow[]; page: { total: number } }>(`/imports/${encodeURIComponent(id)}/rows?${qs.toString()}`);
      return { items: b.items, total: b.page.total };
    },
    errorsFile(id: string): Promise<Blob> {
      return call(`/imports/${encodeURIComponent(id)}/errors.csv`).then((r) => r.blob());
    },
    commit(id: string): Promise<ImportBatch> {
      return json<ImportBatch>(`/imports/${encodeURIComponent(id)}/commit`, { method: 'POST' });
    },
    rollback(id: string): Promise<ImportBatch> {
      return json<ImportBatch>(`/imports/${encodeURIComponent(id)}/rollback`, { method: 'POST' });
    },
  };
}

export type ImportApi = ReturnType<typeof createImportApi>;
