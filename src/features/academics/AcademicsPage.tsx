import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export function AcademicsPage() {
  return (
    <div className="container-fluid px-4 py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">Academics</h1>
          <p className="text-muted small mb-0">Courses, curriculum, and academic management</p>
        </div>
        <Badge variant="primary">Academics</Badge>
      </div>
      <Card variant="elevated" padding="md">
        <div className="text-center py-5">
          <div className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3 bg-primary bg-opacity-10 text-primary" style={{ width: '64px', height: '64px' }}>
            <i className="bi bi-book fs-1" />
          </div>
          <h4 className="fw-bold mb-2">Academic Management</h4>
          <p className="text-muted mb-4">Course management, curriculum planning, and scheduling coming soon.</p>
          <Badge variant="outline-primary">In Development</Badge>
        </div>
      </Card>
    </div>
  );
}