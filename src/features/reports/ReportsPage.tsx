import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export function ReportsPage() {
  return (
    <div className="container-fluid px-4 py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">Reports & Analytics</h1>
          <p className="text-muted small mb-0">Data analytics, reports, and insights</p>
        </div>
        <Badge variant="info">Reports</Badge>
      </div>
      <Card variant="elevated" padding="md">
        <div className="text-center py-5">
          <div className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3 bg-info bg-opacity-10 text-info" style={{ width: '64px', height: '64px' }}>
            <i className="bi bi-graph-up fs-1" />
          </div>
          <h4 className="fw-bold mb-2">Reports & Analytics</h4>
          <p className="text-muted mb-4">Custom reports, dashboards, and data visualization coming soon.</p>
          <Badge variant="outline-info">In Development</Badge>
        </div>
      </Card>
    </div>
  );
}