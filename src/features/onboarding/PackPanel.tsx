import { Button, cx } from '../../design-system';
import type { ImportEntity, ImportPack, PackStep } from './importApi';

function stateText(s: PackStep, byEntity: Map<string, PackStep>): string {
  if (s.state === 'done') return `${s.count} ${s.count === 1 ? 'record' : 'records'}`;
  if (s.state === 'waiting') {
    const missing = s.requires.map((r) => byEntity.get(r)).filter((r) => r && r.state !== 'done').map((r) => r!.title.toLowerCase());
    return `Needs ${missing.join(' and ') || 'an earlier step'} first`;
  }
  return s.required ? 'Not started' : 'Optional, not started';
}

/**
 * The setup checklist of a pack: the steps in order with what each already has, the one to do next, and what is
 * still needed for the pack to be ready. Choosing a step only picks it in the form below; nothing is uploaded.
 */
export function PackPanel({ pack, entities, canImport, selected, onChoose }: { pack: ImportPack; entities: ImportEntity[]; canImport: boolean; selected: string; onChoose: (entity: string) => void }) {
  const byEntity = new Map(pack.steps.map((s) => [s.entity, s]));
  const required = pack.steps.filter((s) => s.required);
  const requiredDone = required.filter((s) => s.state === 'done').length;
  const importable = new Set(entities.map((e) => e.key));
  const pending = pack.rules.filter((r) => !r.checked);
  return (
    <section aria-labelledby="pack-h" className="flex flex-col gap-4 rounded-xl border border-line bg-surface p-6">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="pack-h" className="m-0 text-lg font-semibold text-fg">
            {pack.title} setup
          </h2>
          <p className="m-0 text-sm text-fg-muted">
            {requiredDone} of {required.length} required steps have data.
          </p>
        </div>
        <span className={cx('rounded-full px-3 py-1 text-sm font-medium', pack.ready ? 'bg-success-bg text-success' : 'bg-subtle text-fg-muted')}>{pack.ready ? 'Ready' : 'Not ready yet'}</span>
      </header>

      <ol className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
        {pack.steps.map((s) => (
          <li key={s.entity} className={cx('flex flex-col gap-2 rounded-lg border p-3', s.next ? 'border-accent bg-accent-subtle' : 'border-line bg-canvas', selected === s.entity && 'ring-2 ring-ring')}>
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cx('flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold', s.state === 'done' ? 'bg-success-bg text-success' : s.next ? 'bg-accent text-on-accent' : 'bg-subtle text-fg-muted')}
              >
                {s.state === 'done' ? '✓' : s.order}
              </span>
              <span className="font-medium text-fg">{s.title}</span>
              {s.next ? <span className="ml-auto text-xs font-medium text-accent-text">Next</span> : null}
            </div>
            <p className={cx('m-0 text-sm', s.state === 'waiting' ? 'text-warning' : 'text-fg-muted')}>{stateText(s, byEntity)}</p>
            {importable.has(s.entity) ? (
              <Button variant={s.next ? 'primary' : 'secondary'} size="sm" disabled={!canImport || s.state === 'waiting'} onClick={() => onChoose(s.entity)} aria-label={`${s.state === 'done' ? 'Import more' : 'Import'} ${s.title.toLowerCase()}`} className="self-start">
                {s.state === 'done' ? 'Import more' : 'Import'}
              </Button>
            ) : null}
          </li>
        ))}
      </ol>

      <div className="space-y-1">
        <p className="m-0 text-sm font-medium text-fg">Needed for ready</p>
        <ul className="m-0 list-none space-y-1 p-0 text-sm">
          {pack.rules.map((r) => (
            <li key={r.key} className={cx('flex items-start gap-2', r.met ? 'text-fg' : 'text-fg-muted')}>
              <span aria-hidden="true" className={cx('mt-0.5 w-4 shrink-0', r.met ? 'text-success' : 'text-fg-subtle')}>
                {r.met ? '✓' : '○'}
              </span>
              <span>
                {r.label}
                {!r.checked && r.detail ? <span className="block text-xs text-fg-subtle">{r.detail}</span> : null}
                <span className="sr-only">{r.met ? ', done' : r.checked ? ', not yet' : ', cannot be checked yet'}</span>
              </span>
            </li>
          ))}
        </ul>
        {pending.length > 0 ? <p className="m-0 pt-1 text-xs text-fg-subtle">The setup is not marked ready until every rule can be checked.</p> : null}
      </div>
    </section>
  );
}
