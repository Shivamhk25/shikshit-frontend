import { Link } from 'react-router-dom';
import { useAuth } from '@/app/providers/AuthProvider';
import { useSignalR } from '@/hooks/useSignalR';
import { useState, useEffect, useRef } from 'react';
import { UserMenu } from './UserMenu';

export function Header() {
  const { isLoading } = useAuth();
  const { onNotification } = useSignalR();
  const [notifications, setNotifications] = useState<Array<{ id: string; message: string; read: boolean }>>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onNotification((notification) => {
      setNotifications(prev => [{ id: Date.now().toString(), message: notification.message || 'New notification', read: false }, ...prev]);
    });
    return unsubscribe;
  }, [onNotification]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  if (isLoading) {
    return (
      <nav className="bg-white shadow-sm fixed-top py-3 navbar navbar-expand-lg navbar-light" style={{ height: '70px' }}>
        <div className="px-4 px-lg-5 container-fluid">
          <div className="d-flex align-items-center gap-2">
            <div className="spinner-border spinner-border-sm text-primary" role="status" data-testid="loading-spinner" />
            <span className="fw-bold text-primary fs-4">pie360</span>
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-white shadow-sm fixed-top py-3 navbar navbar-expand-lg navbar-light" style={{ height: '70px' }}>
      <div className="px-4 px-lg-5 container-fluid">
        <Link
          className="fw-bold text-primary fs-4 p-0 m-0 me-4 d-flex align-items-center gap-2 navbar-brand"
          to="/dashboard"
          data-discover="true"
        >
          <img
            alt="pie360"
            height="30"
            draggable="false"
            src="/assets/pie360-logo.png"
            style={{ height: '30px', width: 'auto', flexShrink: 0, display: 'inline-block', verticalAlign: 'middle' }}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
          <span className="d-none d-md-inline">pie360</span>
        </Link>

        <button
          className="navbar-toggler collapsed"
          type="button"
          data-bs-toggle="collapse"
          data-bs-target="#main-nav"
          aria-controls="main-nav"
          aria-expanded="false"
          aria-label="Toggle navigation"
        >
          <span className="navbar-toggler-icon" />
        </button>

        <div className="navbar-collapse collapse" id="main-nav">
          <div className="me-auto navbar-nav" id="left-nav">
            {/* Injected by Navbar component */}
          </div>

          <div className="align-items-center gap-3 navbar-nav" id="right-nav">
            {/* Notifications */}
            <div className="position-relative" ref={notificationsRef}>
              <button
                className="btn btn-link text-dark p-2 position-relative"
                onClick={() => { setShowNotifications(!showNotifications); }}
                aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
              >
                <i className="bi bi-bell fs-5" />
                {unreadCount > 0 && (
                  <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="dropdown-menu dropdown-menu-end shadow-lg mt-2 w-100" style={{ maxWidth: '360px' }}>
                  <div className="d-flex justify-content-between align-items-center px-3 py-2 border-bottom">
                    <h6 className="mb-0 fw-semibold">Notifications</h6>
                    {notifications.length > 0 && (
                      <button
                        className="btn btn-link btn-sm text-decoration-none p-0"
                        onClick={() => setNotifications(prev => prev.map(n => ({ ...n, read: true })))}
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="p-0" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                    {notifications.length === 0 ? (
                      <div className="text-center text-muted py-4">No notifications</div>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          className={`dropdown-item py-2 px-3 ${!n.read ? 'bg-primary bg-opacity-10' : ''}`}
                        >
                          <small className="text-muted d-block">{new Date().toLocaleTimeString()}</small>
                          {n.message}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* User Menu */}
            <UserMenu />
          </div>
        </div>
      </div>
    </nav>
  );
}