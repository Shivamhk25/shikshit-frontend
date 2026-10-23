import { useState, FormEvent, useEffect, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Turnstile, type TurnstileRef } from '@/components/auth/Turnstile';
import { authApi } from '@/services/authApi';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const turnstileRef = useRef<TurnstileRef | null>(null);
  const token = searchParams.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validToken, setValidToken] = useState<boolean | null>(null);

  useEffect(() => {
    if (!token) {
      setValidToken(false);
    } else {
      // Token validation would happen on submit
      setValidToken(true);
    }
  }, [token]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!password) {
      setError('Please enter a new password');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (!turnstileToken) {
      setError('Please complete the CAPTCHA');
      return;
    }

    setLoading(true);
    try {
      await authApi.resetPassword(token, password);
      setSuccess(true);
      turnstileRef.current?.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
      turnstileRef.current?.reset();
    } finally {
      setLoading(false);
    }
  };

  const handleTurnstileVerify = (token: string) => {
    setTurnstileToken(token);
  };

  if (!validToken) {
    return (
      <div className="d-flex col-lg-5 col-md-6">
        <Card variant="bordered" accentColor="blue" padding="md" className="w-100 d-flex flex-column">
          <div className="text-center py-4">
            <div className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3 bg-danger bg-opacity-10 text-danger" style={{ width: '56px', height: '56px' }}>
              <i className="bi bi-exclamation-triangle fs-2" />
            </div>
            <h4 className="fw-bold mb-2">Invalid or expired reset link</h4>
            <p className="text-muted small mb-4">This password reset link is invalid or has expired. Please request a new one.</p>
            <Link to="/forgot-password" className="btn btn-primary">
              <i className="bi bi-key me-2" /> Request New Link
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="d-flex col-lg-5 col-md-6">
        <Card variant="bordered" accentColor="blue" padding="md" className="w-100 d-flex flex-column">
          <div className="text-center py-4">
            <div className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3 bg-success bg-opacity-10 text-success" style={{ width: '56px', height: '56px' }}>
              <i className="bi bi-check-lg fs-2" />
            </div>
            <h4 className="fw-bold mb-2">Password reset successful</h4>
            <p className="text-muted small mb-4">Your password has been updated. You can now log in with your new password.</p>
            <Link to="/login" className="btn btn-primary">
              <i className="bi bi-box-arrow-in-right me-2" /> Log In
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="d-flex col-lg-5 col-md-6">
      <Card variant="bordered" accentColor="blue" padding="md" className="w-100 d-flex flex-column">
        <div className="text-center mb-4">
          <div className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '56px', height: '56px', backgroundColor: '#eef2ff' }}>
            <i className="bi bi-key fs-4" style={{ color: '#4682b4' }} />
          </div>
          <h4 className="fw-bold mb-1">Set new password</h4>
          <p className="text-muted small mb-0">Your new password must be different from previously used passwords.</p>
        </div>

        <hr className="my-2" />

        <div className="flex-grow-1 py-2">
          <form onSubmit={handleSubmit} className="w-100" noValidate>
            <div className="mb-3">
              <Input
                label="New Password"
                type="password"
                placeholder="Enter new password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                showPasswordToggle
                fullWidth
                helperText="Must be at least 8 characters"
              />
            </div>

            <div className="mb-3">
              <Input
                label="Confirm Password"
                type="password"
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                showPasswordToggle
                fullWidth
              />
            </div>

            <Turnstile ref={turnstileRef} onVerify={handleTurnstileVerify} theme="light" size="normal" />

            {error && (
              <div className="alert alert-danger py-2 mt-3" role="alert">
                <i className="bi bi-exclamation-triangle me-2" /> {error}
              </div>
            )}

            <Button type="submit" variant="primary" size="lg" fullWidth loading={loading} className="mt-3">
              <i className="bi bi-check-circle me-2" /> Reset Password
            </Button>
          </form>
        </div>

        <hr className="my-2" />

        <div className="text-center">
          <Link to="/login" className="text-decoration-none small text-muted d-flex align-items-center justify-content-center gap-1">
            <i className="bi bi-arrow-left" /> Back to login
          </Link>
        </div>
      </Card>
    </div>
  );
}