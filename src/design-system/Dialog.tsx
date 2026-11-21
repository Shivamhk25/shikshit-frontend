import type { ReactNode } from 'react';
import * as D from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cx } from './cx';

const overlay = 'fixed inset-0 z-40 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-[fade-in_160ms_ease-out]';

/**
 * A panel that slides in from the right for forms (add, edit). Built on Radix Dialog: focus is trapped inside and
 * returned to the trigger on close, the page behind does not scroll, and Escape or a click outside closes it.
 */
export function Sheet({ open, onClose, title, description, children }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode }) {
  return (
    <D.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <D.Portal>
        <D.Overlay className={overlay} />
        <D.Content
          className="fixed inset-y-0 right-0 z-50 flex h-full w-full max-w-md flex-col gap-5 overflow-y-auto border-l border-line-subtle bg-surface p-8 shadow-float outline-none data-[state=open]:animate-[sheet-in_220ms_cubic-bezier(0.2,0,0,1)]"
        >
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <D.Title className="font-display text-2xl font-semibold text-fg">{title}</D.Title>
              {description ? <D.Description className="text-sm text-fg-muted">{description}</D.Description> : <D.Description className="sr-only">{title}</D.Description>}
            </div>
            <D.Close className="-mr-2 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-md text-fg-subtle hover:bg-subtle hover:text-fg" aria-label="Close">
              <X aria-hidden="true" className="size-4" />
            </D.Close>
          </div>
          {children}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

/** A small centred dialog that asks before something that cannot be undone. Read out as an alert dialog. */
export function ConfirmDialog({ open, onClose, title, children, className }: { open: boolean; onClose: () => void; title: string; children: ReactNode; className?: string }) {
  return (
    <D.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <D.Portal>
        <D.Overlay className={overlay} />
        <D.Content
          role="alertdialog"
          aria-label={title}
          className={cx(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-lg border border-line-subtle bg-surface p-7 shadow-float outline-none data-[state=open]:animate-[pop-in_160ms_ease-out]',
            className,
          )}
        >
          <D.Title className="font-display text-xl font-semibold text-fg">{title}</D.Title>
          <D.Description asChild>
            <div>{children}</div>
          </D.Description>
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
