import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export function ParentDashboard() {

  return (
    <div className="container-fluid px-4 py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">Parent Dashboard</h1>
          <p className="text-muted small mb-0">Your children's progress</p>
        </div>
        <Badge variant="outline-success">Parent</Badge>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-md-6">
          <Card variant="elevated" padding="md">
            <CardBody>
              <h6 className="mb-3">Children</h6>
              <ul className="list-unstyled mb-0">
                <li className="mb-3 d-flex align-items-center gap-3">
                  <div className="rounded-circle bg-primary bg-opacity-10 text-primary d-flex align-items-center justify-content-center" style={{ width: '48px', height: '48px' }}>
                    <i className="bi bi-person-fill fs-4" />
                  </div>
                  <div>
                    <div className="fw-medium">Emma Johnson</div>
                    <div className="small text-muted">Grade 10 • Roll: 20240123</div>
                  </div>
                </li>
                <li className="d-flex align-items-center gap-3">
                  <div className="rounded-circle bg-success bg-opacity-10 text-success d-flex align-items-center justify-content-center" style={{ width: '48px', height: '48px' }}>
                    <i className="bi bi-person-fill fs-4" />
                  </div>
                  <div>
                    <div className="fw-medium">Liam Johnson</div>
                    <div className="small text-muted">Grade 7 • Roll: 20270456</div>
                  </div>
                </li>
              </ul>
            </CardBody>
          </Card>
        </div>
        <div className="col-md-6">
          <Card variant="elevated" padding="md">
            <CardBody>
              <h6 className="mb-3">Quick Overview</h6>
              <div className="row g-3 text-center">
                <div className="col-6">
                  <div className="fs-2 fw-bold text-success">96%</div>
                  <div className="small text-muted">Emma Attendance</div>
                </div>
                <div className="col-6">
                  <div className="fs-2 fw-bold text-primary">94%</div>
                  <div className="small text-muted">Liam Attendance</div>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-md-6">
          <Card variant="bordered" accentColor="blue" padding="md">
            <CardBody>
              <h5 className="fw-semibold mb-3">Emma's Assignments Due</h5>
              <ul className="list-unstyled mb-0">
                <li className="mb-2 d-flex justify-content-between align-items-start">
                  <div>
                    <div className="fw-medium">Calculus Problem Set</div>
                    <div className="small text-muted">Mathematics 101</div>
                  </div>
                  <Badge variant="danger">Due Today</Badge>
                </li>
                <li className="mb-2 d-flex justify-content-between align-items-start">
                  <div>
                    <div className="fw-medium">Lab Report</div>
                    <div className="small text-muted">Physics 201</div>
                  </div>
                  <Badge variant="warning">Due Tomorrow</Badge>
                </li>
                <li className="d-flex justify-content-between align-items-start">
                  <div>
                    <div className="fw-medium">Essay: Organic Chemistry</div>
                    <div className="small text-muted">Chemistry 101</div>
                  </div>
                  <Badge variant="info">Due in 3 days</Badge>
                </li>
              </ul>
            </CardBody>
          </Card>
        </div>
        <div className="col-md-6">
          <Card variant="bordered" accentColor="orange" padding="md">
            <CardBody>
              <h5 className="fw-semibold mb-3">Upcoming Events</h5>
              <ul className="list-unstyled mb-0">
                <li className="mb-2 p-2 bg-light rounded-4">
                  <strong>Parent-Teacher Conference</strong><br />
                  <small className="text-muted">Next Tuesday, 4:00 PM</small>
                </li>
                <li className="mb-2 p-2 bg-light rounded-4">
                  <strong>Science Fair</strong><br />
                  <small className="text-muted">March 15th</small>
                </li>
                <li className="p-2 bg-light rounded-4">
                  <strong>Spring Break</strong><br />
                  <small className="text-muted">March 25-29</small>
                </li>
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}