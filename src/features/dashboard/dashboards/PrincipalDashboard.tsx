import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export function PrincipalDashboard() {

  return (
    <div className="container-fluid px-4 py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">Principal Dashboard</h1>
          <p className="text-muted small mb-0">School leadership overview</p>
        </div>
        <Badge variant="outline-info">Principal</Badge>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-md-3">
          <Card variant="elevated" padding="md">
            <CardBody className="text-center">
              <div className="fs-1 fw-bold text-primary">1,234</div>
              <div className="text-muted small">Students Enrolled</div>
            </CardBody>
          </Card>
        </div>
        <div className="col-md-3">
          <Card variant="elevated" padding="md">
            <CardBody className="text-center">
              <div className="fs-1 fw-bold text-success">94%</div>
              <div className="text-muted small">Attendance Rate</div>
            </CardBody>
          </Card>
        </div>
        <div className="col-md-3">
          <Card variant="elevated" padding="md">
            <CardBody className="text-center">
              <div className="fs-1 fw-bold text-warning">23</div>
              <div className="text-muted small">Teacher Vacancies</div>
            </CardBody>
          </Card>
        </div>
        <div className="col-md-3">
          <Card variant="elevated" padding="md">
            <CardBody className="text-center">
              <div className="fs-1 fw-bold text-info">87%</div>
              <div className="text-muted small">Parent Satisfaction</div>
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-md-6">
          <Card variant="bordered" accentColor="blue" padding="md">
            <CardBody>
              <h5 className="fw-semibold mb-3">Academic Performance</h5>
              <div className="row g-3 text-center">
                <div className="col-4">
                  <div className="fs-2 fw-bold text-success">A</div>
                  <div className="small text-muted">Grade 10 Avg</div>
                </div>
                <div className="col-4">
                  <div className="fs-2 fw-bold text-primary">B+</div>
                  <div className="small text-muted">Grade 11 Avg</div>
                </div>
                <div className="col-4">
                  <div className="fs-2 fw-bold text-warning">A-</div>
                  <div className="small text-muted">Grade 12 Avg</div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
        <div className="col-md-6">
          <Card variant="bordered" accentColor="green" padding="md">
            <CardBody>
              <h5 className="fw-semibold mb-3">Key Metrics</h5>
              <ul className="list-unstyled mb-0">
                <li className="mb-2 d-flex justify-content-between p-2 bg-light rounded-4">
                  <span>Graduation Rate</span>
                  <strong className="text-success">98%</strong>
                </li>
                <li className="mb-2 d-flex justify-content-between p-2 bg-light rounded-4">
                  <span>College Acceptance</span>
                  <strong className="text-primary">92%</strong>
                </li>
                <li className="mb-2 d-flex justify-content-between p-2 bg-light rounded-4">
                  <span>Discipline Incidents</span>
                  <strong className="text-warning">3 this month</strong>
                </li>
                <li className="d-flex justify-content-between p-2 bg-light rounded-4">
                  <span>Teacher Retention</span>
                  <strong className="text-info">89%</strong>
                </li>
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}