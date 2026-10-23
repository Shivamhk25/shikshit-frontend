import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthState } from '../providers/AuthProvider';

interface RoleRouteProps {
  roles: string[];
}

export function RoleRoute({ roles }: RoleRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuthState();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!user || !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}