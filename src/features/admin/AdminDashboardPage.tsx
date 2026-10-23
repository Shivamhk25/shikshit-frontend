import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export function AdminDashboardPage() {
  return (
    <div className="container-fluid px-4 py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">Admin Dashboard</h1>
          <p className="text-muted small mb-0">System administration overview</p>
        </div>
        <Badge variant="secondary">Super Admin</Badge>
      </div>
      <div className="row g-4">
        <div className="col-md-3">
          <Card variant="elevated" padding="md">
            <div className="text-center">
              <div className="fs-1 fw-bold text-primary">156</div>
              <div className="text-muted small">Total Institutions</div>
            </div>
          </Card>
        </div>
        <div className="col-md-3">
          <Card variant="elevated" padding="md">
            <div className="text-center">
              <div className="fs-1 fw-bold text-success">8,432</div>
              <div className="text-muted small">Active Users</div>
            </div>
          </Card>
        </div>
        <div className="col-md-3">
          <Card variant="elevated" padding="md">
            <div className="text-center">
              <div className="fs-1 fw-bold text-warning">23</div>
              <div className="text-muted small">Pending Requests</div>
            </div>
          </Card>
        </div>
        <div className="col-md-3">
          <Card variant="elevated" padding="md">
            <div className="text-center">
              <div className="fs-1 fw-bold text-info">99.9%</div>
              <div className="text-muted small">Uptime</div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}