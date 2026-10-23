import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export function SuperAdminDashboard() {

  return (
    <div className="container-fluid px-4 py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">Super Admin Dashboard</h1>
          <p className="text-muted small mb-0">Platform-wide administration overview</p>
        </div>
        <Badge variant="outline-danger">Super Admin</Badge>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-md-3">
          <Card variant="elevated" padding="md">
            <CardBody className="text-center">
              <div className="fs-1 fw-bold text-primary">156</div>
              <div className="text-muted small">Total Institutions</div>
            </CardBody>
          </Card>
        </div>
        <div className="col-md-3">
          <Card variant="elevated" padding="md">
            <CardBody className="text-center">
              <div className="fs-1 fw-bold text-success">8,432</div>
              <div className="text-muted small">Active Users</div>
            </CardBody>
          </Card>
        </div>
        <div className="col-md-3">
          <Card variant="elevated" padding="md">
            <CardBody className="text-center">
              <div className="fs-1 fw-bold text-warning">23</div>
              <div className="text-muted small">Pending Approvals</div>
            </CardBody>
          </Card>
        </div>
        <div className="col-md-3">
          <Card variant="elevated" padding="md">
            <CardBody className="text-center">
              <div className="fs-1 fw-bold text-info">99.9%</div>
              <div className="text-muted small">Platform Uptime</div>
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-md-6">
          <Card variant="bordered" accentColor="blue" padding="md">
            <CardBody>
              <h5 className="fw-semibold mb-3">Quick Actions</h5>
              <div className="d-grid gap-2">
                <Button variant="primary" size="sm"><i className="bi bi-building-add me-2" /> Add Institution</Button>
                <Button variant="secondary" size="sm"><i className="bi bi-people me-2" /> Manage Users</Button>
                <Button variant="outline-primary" size="sm"><i className="bi bi-shield-lock me-2" /> Security Center</Button>
                <Button variant="outline-secondary" size="sm"><i className="bi bi-gear me-2" /> System Settings</Button>
              </div>
            </CardBody>
          </Card>
        </div>
        <div className="col-md-6">
          <Card variant="bordered" accentColor="orange" padding="md">
            <CardBody>
              <h5 className="fw-semibold mb-3">Recent Activity</h5>
              <ul className="list-unstyled mb-0">
                <li className="mb-2 d-flex justify-content-between align-items-center p-2 bg-light rounded-4">
                  <span><strong>New Institution:</strong> Greenfield Academy</span>
                  <small className="text-muted">2 min ago</small>
                </li>
                <li className="mb-2 d-flex justify-content-between align-items-center p-2 bg-light rounded-4">
                  <span><strong>User Registered:</strong> john.doe@school.edu</span>
                  <small className="text-muted">15 min ago</small>
                </li>
                <li className="mb-2 d-flex justify-content-between align-items-center p-2 bg-light rounded-4">
                  <span><strong>License Renewed:</strong> District 5 Schools</span>
                  <small className="text-muted">1 hour ago</small>
                </li>
                <li className="d-flex justify-content-between align-items-center p-2 bg-light rounded-4">
                  <span><strong>Security Alert:</strong> Failed login attempts</span>
                  <Badge variant="danger">High</Badge>
                </li>
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}