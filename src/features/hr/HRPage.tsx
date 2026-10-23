import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export function HRPage() {
  return (
    <div className="container-fluid px-4 py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">Human Resources</h1>
          <p className="text-muted small mb-0">Staff management, payroll, and HR operations</p>
        </div>
        <Badge variant="warning">HR</Badge>
      </div>
      <Card variant="elevated" padding="md">
        <div className="text-center py-5">
          <div className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3 bg-warning bg-opacity-10 text-warning" style={{ width: '64px', height: '64px' }}>
            <i className="bi bi-briefcase fs-1" />
          </div>
          <h4 className="fw-bold mb-2">HR Management</h4>
          <p className="text-muted mb-4">Staff directory, payroll, leave management coming soon.</p>
          <Badge variant="outline-warning">In Development</Badge>
        </div>
      </Card>
    </div>
  );
}