import React, { useRef, useEffect, useState, ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface DropdownItem {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
  header?: string;
}

interface DropdownProps {
  trigger: ReactNode;
  items: DropdownItem[];
  align?: 'start' | 'end';
  show?: boolean;
  onToggle?: (show: boolean) => void;
}

export function Dropdown({ trigger, items, align = 'end', show: controlledShow, onToggle }: DropdownProps) {
  const [uncontrolledShow, setUncontrolledShow] = useState(false);
  const isControlled = controlledShow !== undefined;
  const show = isControlled ? controlledShow : uncontrolledShow;
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const setShow = (value: boolean) => {
    if (!isControlled) setUncontrolledShow(value);
    onToggle?.(value);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShow(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && show) {
        setShow(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [show]);

  const triggerElement = typeof trigger === 'object' && trigger !== null && 'props' in trigger
    ? cloneElement(trigger as any, {
        ref: triggerRef,
        'aria-haspopup': 'true',
        'aria-expanded': show,
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          setShow(!show);
          (trigger as any).props?.onClick?.(e);
        },
      })
    : trigger;

  if (!show) return <>{triggerElement}</>;

  const dropdownContent = (
    <div
      ref={dropdownRef}
      className={`dropdown-menu dropdown-menu-${align} show shadow-lg`}
      role="menu"
      style={{ position: 'fixed', zIndex: 1050, minWidth: '200px' }}
    >
      {items.map((item, index) => {
        if (item.divider) return <hr key={`divider-${index}`} className="dropdown-divider" role="separator" />;
        if (item.header) return <h6 key={`header-${index}`} className="dropdown-header small text-muted px-3 py-2">{item.header}</h6>;
        return (
          <button
            key={index}
            type="button"
            className={`dropdown-item d-flex align-items-center gap-2 ${item.danger ? 'text-danger' : ''} ${item.disabled ? 'disabled' : ''}`}
            onClick={() => { if (!item.disabled) { item.onClick(); setShow(false); } }}
            disabled={item.disabled}
            role="menuitem"
            tabIndex={-1}
          >
            {item.icon && <span className="d-flex">{item.icon}</span>}
            {item.label}
          </button>
        );
      })}
    </div>
  );

  return (
    <>
      <div className="dropdown d-inline-block" style={{ position: 'relative' }}>
        {triggerElement}
      </div>
      {createPortal(dropdownContent, document.body)}
    </>
  );
}

function cloneElement(element: React.ReactElement, props: any) {
  return React.cloneElement(element, props);
}