import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, FileX2, Info, Printer } from 'lucide-react';
import { Button, Card, buttonVariants, cx } from '../../design-system';
import { useAuth } from '../../shell/AuthProvider';
import { formatDate } from '../adm/dates';
import { certificateRows, createTransfersApi, TransfersError, type TransferCertificate } from './transfers';

type Load = { phase: 'loading' } | { phase: 'ready'; data: TransferCertificate } | { phase: 'blocked'; title: string; message: string } | { phase: 'error'; message: string };

/** The A4 certificate itself. Colours are fixed brand colours, not the theme's, so a dark-mode screen still prints dark ink on white. */
export function CertificatePaper({ certificate: c }: { certificate: TransferCertificate }) {
  const rows = certificateRows(c);
  return (
    <article aria-label={`Transfer certificate ${c.tcNumber}`} className="bg-white text-brand-ink-deep shadow-card [print-color-adjust:exact] print:shadow-none sm:min-h-[297mm] print:min-h-0 print:break-inside-avoid">
      <div className="h-full p-3 print:p-0 sm:p-6">
        <div className="flex h-full flex-col border-2 border-brand-ink p-1">
          <div className="flex h-full flex-1 flex-col border border-brand-gold px-5 py-8 sm:px-12 sm:py-12 print:px-10 print:py-6">
            <header className="text-center">
              <p className="font-display text-xl font-semibold uppercase tracking-[0.12em] sm:text-2xl">{c.schoolName}</p>
              <div aria-hidden="true" className="mx-auto mt-4 flex w-48 items-center gap-2">
                <span className="flex-1 border-t border-brand-gold" />
                <span className="size-1.5 rotate-45 border border-brand-gold" />
                <span className="flex-1 border-t border-brand-gold" />
              </div>
              <h1 className="mt-5 print:mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">Transfer Certificate</h1>
            </header>

            <dl className="mt-8 print:mt-5 flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-y border-brand-ink/25 py-3 text-sm">
              <div className="flex gap-2">
                <dt className="text-brand-ink">TC number</dt>
                <dd className="font-semibold tracking-wide">{c.tcNumber}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-brand-ink">Date of issue</dt>
                <dd className="font-semibold">{formatDate(c.issuedOn)}</dd>
              </div>
            </dl>

            <p className="mt-6 text-sm leading-relaxed">
              This is to certify that <strong className="font-semibold">{c.student.fullName}</strong> was a student of this school. The particulars below are taken from the school’s records.
            </p>

            <table className="mt-5 w-full border-collapse text-left text-sm">
              <caption className="sr-only">Particulars of the student</caption>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.label} className="break-inside-avoid border-b border-dotted border-brand-ink/30 align-top">
                    <td className="w-8 py-2.5 print:py-1.5 pr-2 text-brand-ink">{i + 1}.</td>
                    <th scope="row" className="w-2/5 py-2.5 print:py-1.5 pr-4 font-normal text-brand-ink">
                      {r.label}
                    </th>
                    <td className="py-2.5 font-medium print:py-1.5">
                      {r.value}
                      {r.note ? <span className="mt-0.5 block whitespace-pre-wrap font-normal text-brand-ink">{r.note}</span> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="mt-6 text-sm leading-relaxed text-brand-ink">Certified that the particulars above are correct according to the school records.</p>

            <div className="mt-auto pt-16 print:pt-8">
              <div className="grid grid-cols-3 items-end gap-6 text-center text-xs uppercase tracking-[0.1em] text-brand-ink">
                <p className="border-t border-brand-ink pt-2">Class teacher</p>
                <div className="flex justify-center">
                  <span className="flex size-20 items-center justify-center rounded-full border border-dashed border-brand-ink/40 px-2 text-[10px] leading-tight">School seal</span>
                </div>
                <p className="border-t border-brand-ink pt-2">Principal</p>
              </div>
              <p className="mt-8 print:mt-4 text-center text-[11px] tracking-wide text-brand-ink">
                {c.tcNumber} · {c.schoolName}
              </p>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

/** Prints a completed transfer's certificate. Only the certificate prints: the menu and buttons are hidden by the print styles. */
export function TransferCertificatePage() {
  const { transferId = '' } = useParams();
  const { session } = useAuth();
  const api = useMemo(() => createTransfersApi(session), [session]);
  const [load, setLoad] = useState<Load>({ phase: 'loading' });

  const fetchIt = useCallback(async () => {
    setLoad({ phase: 'loading' });
    try {
      setLoad({ phase: 'ready', data: await api.certificate(transferId) });
    } catch (e) {
      if (e instanceof TransfersError && e.code === 'not_completed') setLoad({ phase: 'blocked', title: 'No certificate yet', message: 'A transfer certificate is available once the transfer is completed.' });
      else if (e instanceof TransfersError && e.status === 404) setLoad({ phase: 'blocked', title: 'Transfer not found', message: 'This transfer no longer exists. Go back to the list and open it again.' });
      else if (e instanceof TransfersError && e.status === 403) setLoad({ phase: 'blocked', title: 'Not available', message: e.message });
      else setLoad({ phase: 'error', message: e instanceof TransfersError ? e.message : 'Something went wrong.' });
    }
  }, [api, transferId]);
  useEffect(() => {
    void fetchIt();
  }, [fetchIt]);

  // The browser names the saved PDF and the print header after the page title.
  const tc = load.phase === 'ready' ? load.data : null;
  useEffect(() => {
    if (!tc) return;
    const before = document.title;
    document.title = `${tc.tcNumber} · ${tc.student.fullName}`;
    return () => {
      document.title = before;
    };
  }, [tc]);

  return (
    <section className="mx-auto max-w-[210mm] space-y-5">
      <style>{'@page { size: A4; margin: 12mm; } @media print { html, body { background: var(--color-white) !important; } }'}</style>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link to="/transfers" className={cx(buttonVariants({ variant: 'ghost', size: 'md' }), '-ml-3')}>
          <ArrowLeft aria-hidden="true" className="size-4" />
          Back to transfers
        </Link>
        {load.phase === 'ready' ? (
          <div className="flex flex-wrap items-center gap-3">
            <p className="flex items-center gap-2 text-sm text-fg-muted">
              <Info aria-hidden="true" className="size-4" />
              PDF download will come later. Use Print, then “Save as PDF”.
            </p>
            <Button onClick={() => window.print()}>
              <Printer aria-hidden="true" className="size-4" />
              Print
            </Button>
          </div>
        ) : null}
      </div>

      {load.phase === 'loading' ? (
        <Card role="status" className="p-10 text-center text-fg-muted">
          Loading the certificate…
        </Card>
      ) : null}
      {load.phase === 'blocked' ? (
        <Card role="alert" className="mx-auto max-w-md space-y-3 p-8 text-center">
          <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-subtle text-fg-muted">
            <FileX2 aria-hidden="true" className="size-5" />
          </span>
          <h1 className="font-display text-2xl font-semibold text-fg">{load.title}</h1>
          <p className="text-sm text-fg-muted">{load.message}</p>
        </Card>
      ) : null}
      {load.phase === 'error' ? (
        <div role="alert" className="space-y-3 rounded-lg border border-danger-line bg-surface p-6 shadow-soft">
          <p className="text-fg">{load.message}</p>
          <Button variant="secondary" onClick={() => void fetchIt()}>
            Try again
          </Button>
        </div>
      ) : null}
      {load.phase === 'ready' ? <CertificatePaper certificate={load.data} /> : null}
    </section>
  );
}
