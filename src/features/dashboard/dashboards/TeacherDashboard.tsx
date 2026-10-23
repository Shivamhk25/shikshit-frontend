import { Card, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';

export function TeacherDashboard() {

  return (
    <div className="container-fluid px-4 py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">Teacher Dashboard</h1>
          <p className="text-muted small mb-0">Your classes and assignments</p>
        </div>
        <Badge variant="outline-primary">Teacher</Badge>
      </div>

      <div className="row g-4 mb-4">
        <div className="col-md-4">
          <Card variant="elevated" padding="md">
            <CardBody>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="mb-0">My Classes Today</h6>
                <Badge variant="primary">3</Badge>
              </div>
              <ul className="list-unstyled mb-0">
                <li className="mb-2 d-flex justify-content-between">
                  <span>Mathematics 101 - Grade 10</span>
                  <small className="text-muted">9:00 AM</small>
                </li>
                <li className="mb-2 d-flex justify-content-between">
                  <span>Physics 201 - Grade 11</span>
                  <small className="text-muted">11:00 AM</small>
                </li>
                <li className="d-flex justify-content-between">
                  <span>Chemistry 101 - Grade 10</span>
                  <small className="text-muted">2:00 PM</small>
                </li>
              </ul>
            </CardBody>
          </Card>
        </div>
        <div className="col-md-4">
          <Card variant="elevated" padding="md">
            <CardBody>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="mb-0">Pending Grades</h6>
                <Badge variant="warning">7</Badge>
              </div>
              <ul className="list-unstyled mb-0">
                <li className="mb-2 d-flex justify-content-between">
                  <span>Calculus Quiz - Math 101</span>
                  <small className="text-muted">Due Today</small>
                </li>
                <li className="mb-2 d-flex justify-content-between">
                  <span>Lab Report - Physics 201</span>
                  <small className="text-muted">Due Tomorrow</small>
                </li>
                <li className="d-flex justify-content-between">
                  <span>Midterm - Chemistry 101</span>
                  <small className="text-muted">Due in 3 days</small>
                </li>
              </ul>
            </CardBody>
          </Card>
        </div>
        <div className="col-md-4">
          <Card variant="elevated" padding="md">
            <CardBody>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <h6 className="mb-0">Attendance</h6>
                <Badge variant="success">94%</Badge>
              </div>
              <div className="text-center">
                <div className="fs-2 fw-bold text-success">94%</div>
                <div className="text-muted small">This Week</div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <div className="row g-4">
        <div className="col-md-6">
          <Card variant="bordered" accentColor="blue" padding="md">
            <CardBody>
              <h5 className="fw-semibold mb-3">Upcoming Assignments</h5>
              <div className="d-grid gap-2">
                <Button variant="outline-primary" size="sm"><i className="bi bi-file-earmark-plus me-2" /> Create Assignment</Button>
                <Button variant="outline-secondary" size="sm"><i className="bi bi-clipboard-check me-2" /> Review Submissions</Button>
                <Button variant="outline-info" size="sm"><i className="bi bi-calendar-plus me-2" /> Schedule Quiz</Button>
              </div>
            </CardBody>
          </Card>
        </div>
        <div className="col-md-6">
          <Card variant="bordered" accentColor="orange" padding="md">
            <CardBody>
              <h5 className="fw-semibold mb-3">Announcements</h5>
              <ul className="list-unstyled mb-0">
                <li className="mb-2 p-2 bg-light rounded-4">
                  <strong>New Resource:</strong> Chapter 5 Notes uploaded
                </li>
                <li className="mb-2 p-2 bg-light rounded-4">
                  <strong>Reminder:</strong> Parent meeting Friday 3 PM
                </li>
                <li className="p-2 bg-light rounded-4">
                  <strong>Grade Deadline:</strong> Submit by Wednesday
                </li>
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}