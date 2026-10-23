import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export function AccountantDashboard() {

  return (
    <div className="container-fluid px-4 py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">Finance Dashboard</h1>
          <p className="text-muted small mb-0">Fee management and financial reports</p>
        </div>
        <Badge variant="outline-success">Accountant</Badge>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-md-3">
          <Card variant="elevated" padding="md">
            <CardBody className="text-center">
              <div className="fs-1 fw-bold text-success">$125,430</div>
              <div className="text-muted small">Collected This Month</div>
            </CardBody>
          </Card>
        </div>
        <div className="col-md-3">
          <Card variant="elevated" padding="md">
            <CardBody className="text-center">
              <div className="fs-1 fw-bold text-warning">$23,450</div>
              <div className="text-muted small">Pending Payments</div>
            </CardBody>
          </Card>
        </div>
        <div className="col-md-3">
          <Card variant="elevated" padding="md">
            <CardBody className="text-center">
              <div className="fs-1 fw-bold text-info">1,234</div>
              <div className="text-muted small">Total Transactions</div>
            </CardBody>
          </Card>
        </div>
        <div className="col-md-3">
          <Card variant="elevated" padding="md">
            <CardBody className="text-center">
              <div className="fs-1 fw-bold text-primary">98.5%</div>
              <div className="text-muted small">Collection Rate</div>
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-md-6">
          <Card variant="bordered" accentColor="green" padding="md">
            <CardBody>
              <h5 className="fw-semibold mb-3">Fee Collection Status</h5>
              <ul className="list-unstyled mb-0">
                <li className="mb-2 d-flex justify-content-between p-2 bg-light rounded-4">
                  <span>Tuition Fees</span>
                  <strong className="text-success">$89,230</strong>
                </li>
                <li className="mb-2 d-flex justify-content-between p-2 bg-light rounded-4">
                  <span>Transport Fees</span>
                  <strong className="text-primary">$12,450</strong>
                </li>
                <li className="mb-2 d-flex justify-content-between p-2 bg-light rounded-4">
                  <span>Lab Fees</span>
                  <strong className="text-info">$8,750</strong>
                </li>
                <li className="d-flex justify-content-between p-2 bg-light rounded-4">
                  <span>Library Fees</span>
                  <strong className="text-warning">$5,200</strong>
                </li>
              </ul>
            </CardBody>
          </Card>
        </div>
        <div className="col-md-6">
          <Card variant="bordered" accentColor="blue" padding="md">
            <CardBody>
              <h5 className="fw-semibold mb-3">Quick Actions</h5>
              <ul className="list-unstyled mb-0">
                <li className="mb-2"><a href="#" className="text-decoration-none d-flex align-items-center gap-2"><i className="bi bi-plus-circle text-primary" /> Generate Fee Receipt</a></li>
                <li className="mb-2"><a href="#" className="text-decoration-none d-flex align-items-center gap-2"><i className="bi bi-file-earmark-text text-success" /> Export Collection Report</a></li>
                <li className="mb-2"><a href="#" className="text-decoration-none d-flex align-items-center gap-2"><i className="bi bi-exclamation-triangle text-warning" /> View Defaulters</a></li>
                <li className="mb-2"><a href="#" className="text-decoration-none d-flex align-items-center gap-2"><i className="bi bi-arrow-repeat text-info" /> Reconcile Accounts</a></li>
                <li><a href="#" className="text-decoration-none d-flex align-items-center gap-2"><i className="bi bi-gear text-secondary" /> Fee Structure Setup</a></li>
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}