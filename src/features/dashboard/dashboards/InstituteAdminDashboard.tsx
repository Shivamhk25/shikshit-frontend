import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export function InstituteAdminDashboard() {

  return (
    <div className="container-fluid px-4 py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">Institute Dashboard</h1>
          <p className="text-muted small mb-0">Manage your institution</p>
        </div>
        <Badge variant="outline-warning">Institute Admin</Badge>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-md-3">
          <Card variant="elevated" padding="md">
            <CardBody className="text-center">
              <div className="fs-1 fw-bold text-primary">1,234</div>
              <div className="text-muted small">Total Students</div>
            </CardBody>
          </Card>
        </div>
        <div className="col-md-3">
          <Card variant="elevated" padding="md">
            <CardBody className="text-center">
              <div className="fs-1 fw-bold text-success">89</div>
              <div className="text-muted small">Active Classes</div>
            </CardBody>
          </Card>
        </div>
        <div className="col-md-3">
          <Card variant="elevated" padding="md">
            <CardBody className="text-center">
              <div className="fs-1 fw-bold text-warning">12</div>
              <div className="text-muted small">Pending Admissions</div>
            </CardBody>
          </Card>
        </div>
        <div className="col-md-3">
          <Card variant="elevated" padding="md">
            <CardBody className="text-center">
              <div className="fs-1 fw-bold text-info">$45,230</div>
              <div className="text-muted small">Revenue This Month</div>
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
                <Button variant="primary" size="sm"><i className="bi bi-person-plus me-2" /> Admit Student</Button>
                <Button variant="secondary" size="sm"><i className="bi bi-book me-2" /> Create Course</Button>
                <Button variant="outline-primary" size="sm"><i className="bi bi-calendar-plus me-2" /> Schedule Exam</Button>
                <Button variant="outline-secondary" size="sm"><i className="bi bi-credit-card me-2" /> Collect Fees</Button>
              </div>
            </CardBody>
          </Card>
        </div>
        <div className="col-md-6">
          <Card variant="bordered" accentColor="orange" padding="md">
            <CardBody>
              <h5 className="fw-semibold mb-3">Upcoming Events</h5>
              <ul className="list-unstyled mb-0">
                <li className="mb-2 d-flex justify-content-between align-items-center p-2 bg-light rounded-4">
                  <span><strong>Parent-Teacher Meeting</strong></span>
                  <small className="text-muted">Tomorrow, 10:00 AM</small>
                </li>
                <li className="mb-2 d-flex justify-content-between align-items-center p-2 bg-light rounded-4">
                  <span><strong>Board Exam Starts</strong></span>
                  <small className="text-muted">In 5 days</small>
                </li>
                <li className="mb-2 d-flex justify-content-between align-items-center p-2 bg-light rounded-4">
                  <span><strong>Fee Collection Drive</strong></span>
                  <small className="text-muted">This Friday</small>
                </li>
                <li className="d-flex justify-content-between align-items-center p-2 bg-light rounded-4">
                  <span><strong>Staff Meeting</strong></span>
                  <small className="text-muted">Monday, 9:00 AM</small>
                </li>
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}