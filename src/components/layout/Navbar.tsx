import { useLocation } from 'react-router-dom';
import { useAuthState, useNavigation } from '@/app/providers/AuthProvider';
import { useEffect, useRef } from 'react';
import type { NavItem } from '@/types/auth';

export function Navbar() {
  const { user, isAuthenticated } = useAuthState();
  const { navItems } = useNavigation();
  const location = useLocation();
  const leftNavRef = useRef<HTMLDivElement>(null);
  const rightNavRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      if (leftNavRef.current) leftNavRef.current.innerHTML = '';
      if (rightNavRef.current) rightNavRef.current.innerHTML = '';
      return;
    }

    // Build left navigation
    const leftHtml = navItems.left.map((item: NavItem) => {
      const isActive = location.pathname === item.href || location.pathname.startsWith(item.href + '/');
      const hasChildren = item.children && item.children.length > 0;

      if (hasChildren) {
        return `
          <li className="nav-item dropdown">
            <a className="nav-link dropdown-toggle ${isActive ? 'active' : ''}" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">
              <i className="${item.icon} me-2" /> ${item.label}
            </a>
            <ul className="dropdown-menu">
              ${item.children!.map((child: NavItem) => `
                <li>
                  <NavLink to="${child.href}" className="dropdown-item ${location.pathname === child.href ? 'active' : ''}">
                    <i className="${child.icon} me-2" /> ${child.label}
                  </NavLink>
                </li>
              `).join('')}
            </ul>
          </li>
        `;
      }

      return `
        <li className="nav-item">
          <NavLink to="${item.href}" className="nav-link ${isActive ? 'active' : ''}" end={${item.href === '/dashboard'}}>
            <i className="${item.icon} me-2" /> ${item.label}
          </NavLink>
        </li>
      `;
    }).join('');

    if (leftNavRef.current) {
      leftNavRef.current.innerHTML = `<ul className="navbar-nav">${leftHtml}</ul>`;
    }

    // Right nav is handled by Header component (notifications, user menu)
    if (rightNavRef.current) {
      rightNavRef.current.innerHTML = '';
    }
  }, [isAuthenticated, user, navItems, location]);

  if (!isAuthenticated) {
    return (
      <div className="navbar-collapse collapse" id="main-nav">
        <div className="me-auto navbar-nav" ref={leftNavRef} />
        <div className="align-items-center gap-3 navbar-nav" ref={rightNavRef} />
      </div>
    );
  }

  return (
    <div className="navbar-collapse collapse" id="main-nav">
      <div className="me-auto navbar-nav" ref={leftNavRef} />
      <div className="align-items-center gap-3 navbar-nav" ref={rightNavRef} />
    </div>
  );
}