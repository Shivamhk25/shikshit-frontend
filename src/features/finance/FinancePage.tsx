import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export function FinancePage() {
  return (
    <div className="container-fluid px-4 py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">Finance</h1>
          <p className="text-muted small mb-0">Fee management, billing, and financial reports</p>
        </div>
        <Badge variant="success">Finance</Badge>
      </div>
      <Card variant="elevated" padding="md">
        <div className="text-center py-5">
          <div className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3 bg-success bg-opacity-10 text-success" style={{ width: '64px', height: '64px' }}>
            <i className="bi bi-cash-coin fs-1" />
          </div>
          <h4 className="fw-bold mb-2">Finance Management</h4>
          <p className="text-muted mb-4">Fee collection, invoicing, and financial reporting coming soon.</p>
          <Badge variant="outline-success">In Development</Badge>
        </div>
      </Card>
    </div>
  );
}