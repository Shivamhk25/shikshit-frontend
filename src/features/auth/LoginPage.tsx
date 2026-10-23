import { LoginForm } from '@/components/auth/LoginForm';
import { Card } from '@/components/ui/Card';

export function LoginPage() {
  return (
    <div className="d-flex col-lg-5 col-md-6">
      <Card variant="bordered" accentColor="blue" padding="md" className="w-100 d-flex flex-column">
        <div className="d-flex flex-column h-100">
          <div className="text-center mb-4">
            <img
              alt="pie360"
              height="40"
              src="/assets/pie360-mark.png"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div className="d-inline-flex align-items-center gap-1 mt-2">
              <span className="fw-bold" style={{ color: '#cc533a', fontSize: '1.5rem' }}>pie</span>
              <span className="fw-bold" style={{ color: '#73777f', fontSize: '1.5rem' }}>360</span>
            </div>
            <span className="badge badge-primary mt-2 small">Platform for Intelligent Education</span>
          </div>
          <p className="text-muted small text-center mb-4">
            Empowering institutions with AI-powered intelligence, automation, and connected management—all in one 360° platform.
          </p>

          <LoginForm onSuccess={() => {}} />

          <div className="mt-4 pt-3 border-top text-center">
            <p className="small text-muted mb-0">
              Don&apos;t have an account? Contact your administrator for access.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}