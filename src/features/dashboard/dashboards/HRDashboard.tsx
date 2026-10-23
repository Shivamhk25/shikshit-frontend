import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export function HRDashboard() {

  return (
    <div className="container-fluid px-4 py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">HR Dashboard</h1>
          <p className="text-muted small mb-0">Staff management and payroll</p>
        </div>
        <Badge variant="outline-warning">HR</Badge>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-md-3">
          <Card variant="elevated" padding="md">
            <CardBody className="text-center">
              <div className="fs-1 fw-bold text-primary">156</div>
              <div className="text-muted small">Total Staff</div>
            </CardBody>
          </Card>
        </div>
        <div className="col-md-3">
          <Card variant="elevated" padding="md">
            <CardBody className="text-center">
              <div className="fs-1 fw-bold text-success">142</div>
              <div className="text-muted small">Active Employees</div>
            </CardBody>
          </Card>
        </div>
        <div className="col-md-3">
          <Card variant="elevated" padding="md">
            <CardBody className="text-center">
              <div className="fs-1 fw-bold text-warning">14</div>
              <div className="text-muted small">Open Positions</div>
            </CardBody>
          </Card>
        </div>
        <div className="col-md-3">
          <Card variant="elevated" padding="md">
            <CardBody className="text-center">
              <div className="fs-1 fw-bold text-info">$485,000</div>
              <div className="text-muted small">Monthly Payroll</div>
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-md-6">
          <Card variant="bordered" accentColor="blue" padding="md">
            <CardBody>
              <h5 className="fw-semibold mb-3">Staff by Department</h5>
              <ul className="list-unstyled mb-0">
                <li className="mb-2 d-flex justify-content-between p-2 bg-light rounded-4">
                  <span>Teaching Staff</span>
                  <strong>89</strong>
                </li>
                <li className="mb-2 d-flex justify-content-between p-2 bg-light rounded-4">
                  <span>Admin Staff</span>
                  <strong>34</strong>
                </li>
                <li className="mb-2 d-flex justify-content-between p-2 bg-light rounded-4">
                  <span>Support Staff</span>
                  <strong>19</strong>
                </li>
                <li className="d-flex justify-content-between p-2 bg-light rounded-4">
                  <span>Management</span>
                  <strong>14</strong>
                </li>
              </ul>
            </CardBody>
          </Card>
        </div>
        <div className="col-md-6">
          <Card variant="bordered" accentColor="orange" padding="md">
            <CardBody>
              <h5 className="fw-semibold mb-3">HR Actions</h5>
              <ul className="list-unstyled mb-0">
                <li className="mb-2"><a href="#" className="text-decoration-none d-flex align-items-center gap-2"><i className="bi bi-person-plus text-primary" /> New Hire</a></li>
                <li className="mb-2"><a href="#" className="text-decoration-none d-flex align-items-center gap-2"><i className="bi bi-calendar-check text-success" /> Leave Approvals</a></li>
                <li className="mb-2"><a href="#" className="text-decoration-none d-flex align-items-center gap-2"><i className="bi bi-cash-coin text-warning" /> Process Payroll</a></li>
                <li className="mb-2"><a href="#" className="text-decoration-none d-flex align-items-center gap-2"><i className="bi bi-award text-info" /> Performance Reviews</a></li>
                <li><a href="#" className="text-decoration-none d-flex align-items-center gap-2"><i className="bi bi-gear text-secondary" /> HR Policies</a></li>
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}