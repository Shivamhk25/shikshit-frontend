import { Fragment, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'fullscreen';
  hideCloseButton?: boolean;
  centered?: boolean;
  scrollable?: boolean;
  footer?: React.ReactNode;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  hideCloseButton = false,
  centered = false,
  scrollable = false,
  footer,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;
      document.body.style.overflow = 'hidden';
      modalRef.current?.focus();
    } else {
      document.body.style.overflow = '';
      previousActiveElement.current?.focus();
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'modal-sm',
    md: '',
    lg: 'modal-lg',
    xl: 'modal-xl',
    fullscreen: 'modal-fullscreen',
  };

  const modalContent = (
    <div
      className="modal fade show"
      style={{ display: 'block' }}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      ref={modalRef}
    >
      <div
        className={`modal-dialog ${sizeClasses[size]} ${centered ? 'modal-dialog-centered' : ''} ${scrollable ? 'modal-dialog-scrollable' : ''}`}
        role="document"
      >
        <div className="modal-content rounded-4 shadow-lg border-0">
          {(title || !hideCloseButton) && (
            <div className="modal-header border-0 pb-0">
              {title && <h5 className="modal-title fw-semibold" id="modal-title">{title}</h5>}
              {!hideCloseButton && (
                <button
                  type="button"
                  className="btn-close btn-close-white"
                  onClick={onClose}
                  aria-label="Close"
                />
              )}
            </div>
          )}
          <div className="modal-body px-4 pt-2">{children}</div>
          {footer && (
            <div className="modal-footer border-0 pt-0 px-4 pb-4">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(
    <Fragment>
      <div className="modal-backdrop fade show" onClick={onClose} />
      {modalContent}
    </Fragment>,
    document.body
  );
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm',
  message = 'Are you sure?',
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  loading = false,
}: {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'primary' | 'danger' | 'secondary';
  loading?: boolean;
}) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} size="sm">
      <p className="text-muted mb-0">{message}</p>
      <Modal.Footer>
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          {cancelText}
        </Button>
        <Button variant={variant} onClick={onConfirm} loading={loading}>
          {confirmText}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

Modal.Footer = ({ children }: { children: React.ReactNode }) => (
  <div className="modal-footer border-0 pt-0 px-4 pb-4">{children}</div>
);