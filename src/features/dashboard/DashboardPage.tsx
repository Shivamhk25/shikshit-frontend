import { useAuthState } from '@/app/providers/AuthProvider';
import { SuperAdminDashboard } from './dashboards/SuperAdminDashboard';
import { InstituteAdminDashboard } from './dashboards/InstituteAdminDashboard';
import { PrincipalDashboard } from './dashboards/PrincipalDashboard';
import { TeacherDashboard } from './dashboards/TeacherDashboard';
import { StudentDashboard } from './dashboards/StudentDashboard';
import { ParentDashboard } from './dashboards/ParentDashboard';
import { AccountantDashboard } from './dashboards/AccountantDashboard';
import { RegistrarDashboard } from './dashboards/RegistrarDashboard';
import { HRDashboard } from './dashboards/HRDashboard';
import { Badge } from '@/components/ui/Badge';

export function DashboardPage() {
  const { user, isLoading } = useAuthState();

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center min-vh-100">
        <div className="spinner-border text-primary" role="status" />
      </div>
    );
  }

  if (!user) return null;

  const renderDashboard = () => {
    const role: string = user.role;
    if (role === 'super_admin') return <SuperAdminDashboard />;
    if (role === 'institute_admin') return <InstituteAdminDashboard />;
    if (role === 'principal') return <PrincipalDashboard />;
    if (role === 'teacher') return <TeacherDashboard />;
    if (role === 'student') return <StudentDashboard />;
    if (role === 'parent') return <ParentDashboard />;
    if (role === 'accountant') return <AccountantDashboard />;
    if (role === 'registrar') return <RegistrarDashboard />;
    if (role === 'hr') return <HRDashboard />;
    // Fallback for unknown roles
    return (
      <div className="text-center py-5">
        <div className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3 bg-primary bg-opacity-10 text-primary" style={{ width: '64px', height: '64px' }}>
          <i className="bi bi-speedometer2 fs-1" />
        </div>
        <h4 className="fw-bold mb-2">Welcome, {user.fullName}</h4>
        <p className="text-muted mb-4">Your {role.replace('_', ' ')} dashboard is being prepared.</p>
        <Badge variant="secondary">{role.replace('_', ' ')}</Badge>
      </div>
    );
  };

  return (
    <div className="container-fluid px-4 py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">Dashboard</h1>
          <p className="text-muted small mb-0">Welcome back, {user?.fullName}</p>
        </div>
        <div className="d-flex gap-2">
          <Badge variant="outline-primary">{user?.role?.replace('_', ' ')}</Badge>
        </div>
      </div>
      {renderDashboard()}
    </div>
  );
}