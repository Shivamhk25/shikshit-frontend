import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';

interface DropdownItem {
  label?: string;
  onClick?: () => void;
  icon?: React.ReactNode;
  danger?: boolean;
  divider?: boolean;
}

export function UserMenu() {
  const { user, logout, isLoading } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
      if (buttonRef.current && !buttonRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleMenu = () => setShowMenu(!showMenu);

  const menuItems: DropdownItem[] = [
    { label: 'Profile', onClick: () => { navigate('/profile'); setShowMenu(false); }, icon: <i className="bi bi-person" /> },
    { label: 'Settings', onClick: () => { navigate('/settings'); setShowMenu(false); }, icon: <i className="bi bi-gear" /> },
    { divider: true },
    { label: 'Logout', onClick: handleLogout, icon: <i className="bi bi-box-arrow-right" />, danger: true },
  ];

  if (isLoading) {
    return (
      <button className="btn btn-link text-dark p-2 d-flex align-items-center gap-2" disabled>
        <div className="spinner-border spinner-border-sm text-primary" role="status" />
      </button>
    );
  }

  if (!user) return null;

  const initials = user.fullName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="position-relative d-inline-block" ref={menuRef}>
      <button
        ref={buttonRef}
        className="btn btn-link text-dark p-2 d-flex align-items-center gap-2"
        onClick={toggleMenu}
        aria-label="User menu"
        aria-expanded={showMenu}
        aria-haspopup="true"
      >
        <Avatar size="md" name={user.fullName} src={user.avatarUrl} />
        <span className="fw-medium d-none d-md-inline">{user.fullName || user.username}</span>
        <i className={`bi bi-chevron-down fs-6 transition-transform ${showMenu ? 'rotate-180' : ''}`} style={{ transformOrigin: 'center' }} />
      </button>

      {showMenu && (
        <div className="dropdown-menu dropdown-menu-end shadow-lg mt-2" style={{ minWidth: '240px', position: 'fixed', zIndex: 1050 }}>
          <div className="px-3 py-2 border-bottom">
            <div className="fw-semibold">{user.fullName || user.username}</div>
            <small className="text-muted text-capitalize">{user.role?.replace('_', ' ')}</small>
            <Badge variant="outline-primary" className="mt-1">{initials}</Badge>
          </div>
          {menuItems.map((item, index) => {
            if (item.divider) {
              return <hr key={`divider-${index}`} className="dropdown-divider" role="separator" />;
            }
            return (
              <button
                key={index}
                type="button"
                className={`dropdown-item d-flex align-items-center gap-2 ${item.danger ? 'text-danger' : ''}`}
                onClick={item.onClick}
                disabled={isLoading}
                role="menuitem"
                tabIndex={-1}
              >
                {item.icon && <span className="d-flex">{item.icon}</span>}
                {item.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}