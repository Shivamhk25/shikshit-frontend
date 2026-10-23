import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export function RegistrarDashboard() {

  return (
    <div className="container-fluid px-4 py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">Registrar Dashboard</h1>
          <p className="text-muted small mb-0">Student records and admissions</p>
        </div>
        <Badge variant="outline-info">Registrar</Badge>
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
              <div className="text-muted small">New Admissions</div>
            </CardBody>
          </Card>
        </div>
        <div className="col-md-3">
          <Card variant="elevated" padding="md">
            <CardBody className="text-center">
              <div className="fs-1 fw-bold text-warning">23</div>
              <div className="text-muted small">Pending Documents</div>
            </CardBody>
          </Card>
        </div>
        <div className="col-md-3">
          <Card variant="elevated" padding="md">
            <CardBody className="text-center">
              <div className="fs-1 fw-bold text-info">156</div>
              <div className="text-muted small">Transcripts Issued</div>
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-md-6">
          <Card variant="bordered" accentColor="blue" padding="md">
            <CardBody>
              <h5 className="fw-semibold mb-3">Admissions Pipeline</h5>
              <ul className="list-unstyled mb-0">
                <li className="mb-2 d-flex justify-content-between p-2 bg-light rounded-4">
                  <span>Applications Received</span>
                  <Badge variant="primary">45</Badge>
                </li>
                <li className="mb-2 d-flex justify-content-between p-2 bg-light rounded-4">
                  <span>Under Review</span>
                  <Badge variant="warning">12</Badge>
                </li>
                <li className="mb-2 d-flex justify-content-between p-2 bg-light rounded-4">
                  <span>Accepted</span>
                  <Badge variant="success">28</Badge>
                </li>
                <li className="d-flex justify-content-between p-2 bg-light rounded-4">
                  <span>Waitlisted</span>
                  <Badge variant="info">5</Badge>
                </li>
              </ul>
            </CardBody>
          </Card>
        </div>
        <div className="col-md-6">
          <Card variant="bordered" accentColor="orange" padding="md">
            <CardBody>
              <h5 className="fw-semibold mb-3">Quick Actions</h5>
              <ul className="list-unstyled mb-0">
                <li className="mb-2"><a href="#" className="text-decoration-none d-flex align-items-center gap-2"><i className="bi bi-person-plus text-primary" /> New Student Record</a></li>
                <li className="mb-2"><a href="#" className="text-decoration-none d-flex align-items-center gap-2"><i className="bi bi-file-earmark-plus text-success" /> Process Admission</a></li>
                <li className="mb-2"><a href="#" className="text-decoration-none d-flex align-items-center gap-2"><i className="bi bi-file-earmark-text text-info" /> Generate Transcript</a></li>
                <li className="mb-2"><a href="#" className="text-decoration-none d-flex align-items-center gap-2"><i className="bi bi-search text-warning" /> Verify Documents</a></li>
                <li><a href="#" className="text-decoration-none d-flex align-items-center gap-2"><i className="bi bi-download text-secondary" /> Export Student List</a></li>
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}