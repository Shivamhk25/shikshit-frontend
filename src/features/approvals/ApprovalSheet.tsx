import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Check, CircleDot, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button, ConfirmDialog, Sheet, cx } from '../../design-system';
import { ApiError } from '../../crud/client';
import type { ApprovalDetail, ApprovalsApi } from './approvalsApi';
import { EVENT_LABEL, STATUS_LABEL, STATUS_TONE, money, stepText, when } from './logic';

export const STALE_MESSAGE = 'Someone else already decided this, or it moved to another step. This is the latest.';
const COMMENT_MAX = 1000;

export function StatusChip({ status }: { status: keyof typeof STATUS_LABEL }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium', STATUS_TONE[status])}>
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {STATUS_LABEL[status]}
    </span>
  );
}

/**
 * One request in a side sheet: what it is, who has decided each step, the history with comments, and the actions this
 * person may take. A decision carries the step they were looking at, so a request that moved on is refused by the
 * server (409) and shown again as it is now, with a plain message.
 */
export function ApprovalSheet({ api, id, onClose, onChanged }: { api: ApprovalsApi; id: string; onClose: () => void; onChanged: () => void }) {
  const [detail, setDetail] = useState<ApprovalDetail | null>(null);
  const [problem, setProblem] = useState('');
  const [notice, setNotice] = useState('');
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState('');
  const [busy, setBusy] = useState<'approve' | 'reject' | 'cancel' | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const live = useRef(true);
  const commentId = useId();

  const load = useCallback(async () => {
    try {
      const d = await api.get(id);
      if (!live.current) return;
      setDetail(d);
      setProblem('');
    } catch (e) {
      if (!live.current) return;
      setProblem(e instanceof ApiError && e.status === 404 ? 'This request is not available any more.' : e instanceof Error ? e.message : 'Something went wrong.');
    }
  }, [api, id]);

  useEffect(() => {
    live.current = true;
    void load();
    return () => void (live.current = false);
  }, [load]);

  /** Run a decision; on 409 show the request as it is now. */
  const act = async (kind: 'approve' | 'reject' | 'cancel', run: () => Promise<ApprovalDetail>, done: string) => {
    setBusy(kind);
    setNotice('');
    try {
      const d = await run();
      if (!live.current) return;
      setDetail(d);
      setComment('');
      setConfirmingCancel(false);
      toast.success(done);
      onChanged();
    } catch (e) {
      if (!live.current) return;
      setConfirmingCancel(false);
      if (e instanceof ApiError && e.status === 409) {
        setNotice(STALE_MESSAGE);
        setComment('');
        setCommentError('');
        await load();
        onChanged();
      } else {
        setNotice(e instanceof Error ? e.message : 'Something went wrong.');
      }
    } finally {
      if (live.current) setBusy(null);
    }
  };

  const approve = () => detail && void act('approve', () => api.approve(detail.id, { step: detail.currentStep, ...(comment.trim() ? { comment: comment.trim() } : {}) }), 'Approved.');
  const reject = () => {
    if (!detail) return;
    if (!comment.trim()) {
      setCommentError('Say why you are rejecting this, so the person who asked knows.');
      return;
    }
    void act('reject', () => api.reject(detail.id, { step: detail.currentStep, comment: comment.trim() }), 'Rejected.');
  };

  return (
    <Sheet open onClose={onClose} title={detail?.typeTitle ?? 'Approval request'} description={detail ? `Requested by ${detail.requesterName}` : undefined}>
      {problem ? (
        <div role="alert" className="space-y-3 rounded-lg border border-danger-line p-4">
          <p className="text-sm text-fg">{problem}</p>
          <Button size="sm" variant="secondary" onClick={() => void load()}>
            Try again
          </Button>
        </div>
      ) : !detail ? (
        <p role="status" className="text-sm text-fg-muted">
          Loading…
        </p>
      ) : (
        <div className="space-y-6">
          <div role="status" className="sr-only">
            {notice}
          </div>
          {notice ? (
            <p className="rounded-md border border-warning-line bg-warning-bg px-3 py-2.5 text-sm text-fg" aria-hidden="true">
              {notice}
            </p>
          ) : null}

          <section aria-label="Summary" className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <StatusChip status={detail.status} />
              {money(detail.amount) ? <span className="text-sm font-semibold text-fg">{money(detail.amount)}</span> : null}
            </div>
            <p className="text-fg">{detail.summary}</p>
            <p className="text-xs text-fg-subtle">Sent {when(detail.createdAt)}</p>
          </section>

          <section aria-labelledby={`${commentId}-steps`}>
            <h3 id={`${commentId}-steps`} className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-fg-subtle">
              Steps
            </h3>
            <ol className="space-y-0">
              {detail.steps.map((s, i) => {
                const current = detail.status === 'pending' && s.step === detail.currentStep;
                return (
                  <li key={s.step} className="relative flex gap-3 pb-4 last:pb-0" aria-current={current ? 'step' : undefined}>
                    {i < detail.steps.length - 1 ? <span aria-hidden="true" className="absolute left-[11px] top-6 h-[calc(100%-1.25rem)] w-px bg-line" /> : null}
                    <span
                      aria-hidden="true"
                      className={cx(
                        'relative z-[1] mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border',
                        s.status === 'approved' && 'border-success-line bg-success-bg text-success',
                        s.status === 'rejected' && 'border-danger-line bg-danger-bg text-danger',
                        s.status === 'pending' && (current ? 'border-warning-line bg-warning-bg text-warning' : 'border-line bg-surface text-fg-subtle'),
                      )}
                    >
                      {s.status === 'approved' ? <Check className="size-3.5" /> : s.status === 'rejected' ? <X className="size-3.5" /> : <CircleDot className="size-3.5" />}
                    </span>
                    <span className="min-w-0 text-sm">
                      <span className="block font-medium text-fg">
                        {s.step}. {s.name}
                      </span>
                      <span className="block text-fg-muted">
                        {s.status === 'pending' ? (current ? 'Waiting for a decision' : 'Not reached yet') : `${s.status === 'approved' ? 'Approved' : 'Rejected'} by ${s.decidedBy ?? 'someone'}${s.decidedAt ? ` · ${when(s.decidedAt)}` : ''}`}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>

          {detail.canDecide ? (
            <section aria-labelledby={`${commentId}-decide`} className="space-y-3 rounded-lg border border-line-subtle bg-canvas p-4">
              <h3 id={`${commentId}-decide`} className="font-display text-lg font-semibold text-fg">
                Your decision
              </h3>
              <p className="text-sm text-fg-muted">
                Step {stepText(detail)}: {detail.stepName}
              </p>
              {detail.delegatedFromName ? (
                <p className="rounded-md border border-line-subtle bg-surface px-3 py-2 text-sm text-fg">
                  You are deciding for <span className="font-medium">{detail.delegatedFromName}</span>, who handed their approvals to you. The history will say so.
                </p>
              ) : null}
              <div className="flex flex-col gap-1.5">
                <label htmlFor={commentId} className="text-sm font-medium text-fg">
                  Comment <span className="font-normal text-fg-subtle">(needed to reject)</span>
                </label>
                <textarea
                  id={commentId}
                  rows={3}
                  maxLength={COMMENT_MAX}
                  value={comment}
                  aria-invalid={commentError ? true : undefined}
                  aria-describedby={commentError ? `${commentId}-error` : undefined}
                  onChange={(e) => {
                    setComment(e.target.value);
                    if (commentError) setCommentError('');
                  }}
                  className={cx(
                    'w-full resize-y rounded-md border bg-surface px-3 py-2 text-md text-fg shadow-soft placeholder:text-fg-subtle hover:border-line-strong focus-visible:border-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-accent-subtle',
                    commentError ? 'border-danger' : 'border-line',
                  )}
                />
                {commentError ? (
                  <p id={`${commentId}-error`} role="alert" className="text-sm text-danger">
                    {commentError}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button loading={busy === 'approve'} disabled={busy !== null} onClick={approve}>
                  Approve
                </Button>
                <Button variant="danger" loading={busy === 'reject'} disabled={busy !== null} onClick={reject}>
                  Reject
                </Button>
              </div>
            </section>
          ) : null}

          <section aria-labelledby={`${commentId}-history`}>
            <h3 id={`${commentId}-history`} className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-fg-subtle">
              History
            </h3>
            <ol className="space-y-4">
              {detail.events.map((ev, i) => (
                <li key={`${ev.createdAt}-${i}`} className="text-sm">
                  <p className="text-fg">
                    <span className="font-medium">{ev.actorName}</span> {EVENT_LABEL[ev.action]}
                    {ev.step !== null && ev.action !== 'submitted' && ev.action !== 'cancelled' ? ` at step ${ev.step}` : ''}
                    {ev.onBehalfOfName ? (
                      <span className="text-fg-muted">
                        {' '}
                        on behalf of <span className="font-medium text-fg">{ev.onBehalfOfName}</span>
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-fg-subtle">{when(ev.createdAt)}</p>
                  {ev.comment ? <blockquote className="mt-1.5 whitespace-pre-wrap border-l-2 border-brand-gold pl-3 text-fg-muted">{ev.comment}</blockquote> : null}
                </li>
              ))}
            </ol>
          </section>

          {detail.canCancel ? (
            <div className="border-t border-line-subtle pt-4">
              <Button variant="danger" disabled={busy !== null} onClick={() => setConfirmingCancel(true)}>
                Withdraw request
              </Button>
            </div>
          ) : null}
        </div>
      )}

      {detail && confirmingCancel ? (
        <ConfirmDialog open title="Withdraw this request?" onClose={() => setConfirmingCancel(false)}>
          <p className="text-sm text-fg-muted">The people who were going to decide it will no longer see it. You can send a new request later.</p>
          <div className="mt-5 flex gap-2">
            <Button variant="destructive" loading={busy === 'cancel'} onClick={() => void act('cancel', () => api.cancel(detail.id), 'Request withdrawn.')}>
              Withdraw request
            </Button>
            <Button variant="secondary" onClick={() => setConfirmingCancel(false)}>
              Keep it
            </Button>
          </div>
        </ConfirmDialog>
      ) : null}
    </Sheet>
  );
}
