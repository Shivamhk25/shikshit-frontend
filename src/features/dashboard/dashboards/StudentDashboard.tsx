import { useAuthState } from '@/app/providers/AuthProvider';
import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export function StudentDashboard() {
  const { user } = useAuthState();

  return (
    <div className="container-fluid px-4 py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">Student Dashboard</h1>
          <p className="text-muted small mb-0">Welcome back, {user?.fullName?.split(' ')[0]}</p>
        </div>
        <Badge variant="outline-primary">Student</Badge>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-md-4">
          <Card variant="elevated" padding="md">
            <CardBody>
              <h6 className="mb-3">Today's Schedule</h6>
              <ul className="list-unstyled mb-0">
                <li className="mb-3 p-3 bg-light rounded-4">
                  <div className="fw-medium">Mathematics 101</div>
                  <div className="small text-muted">9:00 AM - 10:30 AM • Room 101</div>
                </li>
                <li className="mb-3 p-3 bg-light rounded-4">
                  <div className="fw-medium">Physics 201</div>
                  <div className="small text-muted">11:00 AM - 12:30 PM • Lab 2</div>
                </li>
                <li className="p-3 bg-light rounded-4">
                  <div className="fw-medium">Chemistry 101</div>
                  <div className="small text-muted">2:00 PM - 3:30 PM • Room 205</div>
                </li>
              </ul>
            </CardBody>
          </Card>
        </div>
        <div className="col-md-4">
          <Card variant="elevated" padding="md">
            <CardBody>
              <h6 className="mb-3">Assignments Due</h6>
              <ul className="list-unstyled mb-0">
                <li className="mb-3 d-flex justify-content-between align-items-start">
                  <div>
                    <div className="fw-medium">Calculus Problem Set</div>
                    <div className="small text-muted">Mathematics 101</div>
                  </div>
                  <Badge variant="danger">Due Today</Badge>
                </li>
                <li className="mb-3 d-flex justify-content-between align-items-start">
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
        <div className="col-md-4">
          <Card variant="elevated" padding="md">
            <CardBody>
              <h6 className="mb-3">Grade Summary</h6>
              <div className="row g-3 text-center">
                <div className="col-4">
                  <div className="fs-3 fw-bold text-primary">A-</div>
                  <div className="small text-muted">Mathematics</div>
                </div>
                <div className="col-4">
                  <div className="fs-3 fw-bold text-success">B+</div>
                  <div className="small text-muted">Physics</div>
                </div>
                <div className="col-4">
                  <div className="fs-3 fw-bold text-warning">A</div>
                  <div className="small text-muted">Chemistry</div>
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
              <h5 className="fw-semibold mb-3">Quick Actions</h5>
              <div className="d-grid gap-2">
                <Button variant="outline-primary" size="sm"><i className="bi bi-book me-2" /> View Resources</Button>
                <Button variant="outline-secondary" size="sm"><i className="bi bi-chat me-2" /> Ask Teacher</Button>
                <Button variant="outline-info" size="sm"><i className="bi bi-calendar me-2" /> Check Timetable</Button>
              </div>
            </CardBody>
          </Card>
        </div>
        <div className="col-md-6">
          <Card variant="bordered" accentColor="green" padding="md">
            <CardBody>
              <h5 className="fw-semibold mb-3">Attendance</h5>
              <div className="text-center">
                <div className="fs-1 fw-bold text-success">97%</div>
                <div className="text-muted small">This Month</div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}