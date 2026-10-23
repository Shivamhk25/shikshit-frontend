import { useState, FormEvent, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Turnstile, type TurnstileRef } from '@/components/auth/Turnstile';
import { useAuth } from '@/app/providers/AuthProvider';

interface LoginFormProps {
  onSuccess?: () => void;
}

export function LoginForm({ onSuccess }: LoginFormProps = {}) {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const turnstileRef = useRef<TurnstileRef | null>(null);
  const from = (location.state as any)?.from?.pathname || '/dashboard';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Please enter both username and password');
      return;
    }

    if (!turnstileToken) {
      setError('Please complete the CAPTCHA');
      return;
    }

    try {
      await login(username, password, turnstileToken);
      onSuccess?.();
      navigate(from, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed. Please try again.';
      setError(message);
      turnstileRef.current?.reset();
    }
  };

  const handleTurnstileVerify = (token: string) => {
    setTurnstileToken(token);
  };

  return (
    <Card variant="bordered" accentColor="blue" padding="md" className="w-100 d-flex flex-column">
      <div className="text-center mb-4">
        <div className="rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '56px', height: '56px', backgroundColor: '#eef2ff' }}>
          <i className="bi bi-person-lock fs-4" style={{ color: '#4682b4' }} />
        </div>
        <h4 className="fw-bold mb-1">Welcome back</h4>
        <p className="text-muted small mb-0">Log in to continue to <span className="fw-semibold text-dark">pie360</span></p>
      </div>

      <hr className="my-2" />

      <div className="flex-grow-1 py-2">
        <form onSubmit={handleSubmit} className="w-100" noValidate>
          <div className="mb-3">
            <Input
              label="Username"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoComplete="username"
              autoFocus
              fullWidth
            />
          </div>

          <div className="mb-4">
            <Input
              label="Password"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
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

          <Button type="submit" variant="primary" size="lg" fullWidth loading={isLoading} className="mt-3">
            <i className="bi bi-box-arrow-in-right me-2" /> Log In
          </Button>
        </form>
      </div>

      <hr className="my-2" />

      <div className="d-flex justify-content-between align-items-center mt-2">
        <Link to="/forgot-password" className="text-decoration-none small text-muted d-flex align-items-center gap-1">
          <i className="bi bi-key" /> Forgot password?
        </Link>
      </div>
    </Card>
  );
}