import { useState, FormEvent, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Turnstile, type TurnstileRef } from '@/components/auth/Turnstile';
import { authApi } from '@/services/authApi';

export function ForgotPasswordPage() {
  const turnstileRef = useRef<TurnstileRef | null>(null);
  const [email, setEmail] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your email or username');
      return;
    }

    if (!turnstileToken) {
      setError('Please complete the CAPTCHA');
      return;
    }

    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSuccess(true);
      turnstileRef.current?.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset link');
      turnstileRef.current?.reset();
    } finally {
      setLoading(false);
    }
  };

  const handleTurnstileVerify = (token: string) => {
    setTurnstileToken(token);
  };

  if (success) {
    return (
      <div className="d-flex col-lg-5 col-md-6">
        <Card variant="bordered" accentColor="blue" padding="md" className="w-100 d-flex flex-column">
          <div className="text-center py-4">
            <div className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3 bg-success bg-opacity-10 text-success" style={{ width: '56px', height: '56px' }}>
              <i className="bi bi-check-lg fs-2" />
            </div>
            <h4 className="fw-bold mb-2">Check your email</h4>
            <p className="text-muted small mb-4">If an account exists for <strong>{email}</strong>, you&apos;ll receive a password reset link shortly.</p>
            <Link to="/login" className="text-decoration-none small">
              <i className="bi bi-arrow-left me-1" /> Back to login
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
          <h4 className="fw-bold mb-1">Forgot password?</h4>
          <p className="text-muted small mb-0">Enter your email or username and we&apos;ll send you a reset link.</p>
        </div>

        <hr className="my-2" />

        <div className="flex-grow-1 py-2">
          <form onSubmit={handleSubmit} className="w-100" noValidate>
            <div className="mb-3">
              <Input
                label="Email or Username"
                placeholder="Enter email or username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
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
              <i className="bi bi-send me-2" /> Send Reset Link
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