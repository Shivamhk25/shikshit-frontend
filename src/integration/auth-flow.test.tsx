import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { store } from '@/app/store';
import { AuthProvider } from '@/app/providers/AuthProvider';
import { SignalRProvider } from '@/app/providers/SignalRProvider';
import { LoginForm } from '@/components/auth/LoginForm';
import { Header } from '@/components/layout/Header';

const renderWithProviders = (component: React.ReactNode) => {
  return render(
    <Provider store={store}>
      <BrowserRouter>
        <AuthProvider>
          <SignalRProvider>
            {component}
          </SignalRProvider>
        </AuthProvider>
      </BrowserRouter>
    </Provider>
  );
};

describe('Auth Flow Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('LoginForm', () => {
    it('renders login form with username, password, and CAPTCHA', () => {
      renderWithProviders(<LoginForm />);

      expect(screen.getByLabelText(/username/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/enter password/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument();
    });

    it('shows validation errors for empty fields', async () => {
      renderWithProviders(<LoginForm />);

      fireEvent.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(screen.getByText(/please enter both username and password/i)).toBeInTheDocument();
      });
    });

    it('shows error when CAPTCHA not completed', async () => {
      renderWithProviders(<LoginForm />);

      fireEvent.change(screen.getByLabelText(/username/i), { target: { value: 'testuser' } });
      fireEvent.change(screen.getByPlaceholderText(/enter password/i), { target: { value: 'password123' } });
      fireEvent.click(screen.getByRole('button', { name: /log in/i }));

      await waitFor(() => {
        expect(screen.getByText(/please complete the captcha/i)).toBeInTheDocument();
      });
    });
  });
});

describe('Layout Integration Tests', () => {
  describe('Header', () => {
    it('renders brand logo and navigation', () => {
      renderWithProviders(<Header />);

      expect(screen.getByText('pie360')).toBeInTheDocument();
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });

    it('renders header with brand logo', () => {
      renderWithProviders(<Header />);

      expect(screen.getByText('pie360')).toBeInTheDocument();
      expect(screen.getByRole('navigation')).toBeInTheDocument();
    });
  });
});