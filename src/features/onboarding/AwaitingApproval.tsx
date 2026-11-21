import { useEffect, useState } from 'react';
import { Button } from '../../design-system';
import { formatDate } from './format';
import type { ImportApi, ImportBatch, ImportEntity } from './importApi';

/** Files other people uploaded that are waiting for the signed-in approver. The ones they uploaded themselves are left out. */
export function AwaitingApproval({ api, entities, userId, version, onOpen }: { api: ImportApi; entities: ImportEntity[]; userId: string; version: number; onOpen: (id: string) => void }) {
  const [items, setItems] = useState<ImportBatch[] | null>(null);
  useEffect(() => {
    let stop = false;
    api
      .batches(1, 20, { awaitingApproval: true })
      .then((p) => !stop && setItems(p.items.filter((b) => b.createdBy !== userId)))
      .catch(() => !stop && setItems([]));
    return () => {
      stop = true;
    };
  }, [api, userId, version]);
  if (!items || items.length === 0) return null;
  const title = (key: string) => entities.find((e) => e.key === key)?.title ?? key;
  return (
    <section aria-labelledby="awaiting-h" className="flex flex-col gap-3 rounded-xl border border-accent bg-accent-subtle p-6">
      <h2 id="awaiting-h" className="m-0 text-lg font-semibold text-fg">
        Waiting for your approval
      </h2>
      <ul className="m-0 list-none divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface p-0">
        {items.map((b) => (
          <li key={b.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="m-0 truncate font-medium text-fg">{b.fileName}</p>
              <p className="m-0 text-sm text-fg-muted">
                {title(b.entity)} · {b.validRows + b.warningRows} rows ready · {formatDate(b.createdAt)}
              </p>
            </div>
            <Button size="sm" onClick={() => onOpen(b.id)} aria-label={`Review ${b.fileName}`}>
              Review
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
