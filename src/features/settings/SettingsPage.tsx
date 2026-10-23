import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export function SettingsPage() {
  return (
    <div className="container-fluid px-4 py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="h3 fw-bold mb-1">Settings</h1>
          <p className="text-muted small mb-0">System configuration and preferences</p>
        </div>
        <Badge variant="secondary">Settings</Badge>
      </div>
      <Card variant="elevated" padding="md">
        <div className="text-center py-5">
          <div className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3 bg-secondary bg-opacity-10 text-secondary" style={{ width: '64px', height: '64px' }}>
            <i className="bi bi-gear fs-1" />
          </div>
          <h4 className="fw-bold mb-2">System Settings</h4>
          <p className="text-muted mb-4">Configuration, integrations, and preferences coming soon.</p>
          <Badge variant="outline-secondary">In Development</Badge>
        </div>
      </Card>
    </div>
  );
}