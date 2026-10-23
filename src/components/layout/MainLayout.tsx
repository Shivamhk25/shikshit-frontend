import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import { useAuthState } from '../../app/providers/AuthProvider';

export function MainLayout() {
  const { isAuthenticated } = useAuthState();

  return (
    <div className="page-wrapper d-flex flex-column min-vh-100" id="root">
      <Header />
      <Navbar />
      <main className="flex-grow-1" style={{ paddingTop: isAuthenticated ? '90px' : '90px' }}>
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}

export function AuthLayout() {
  return (
    <div className="page-wrapper d-flex flex-column min-vh-100" id="root" style={{ background: 'linear-gradient(135deg, #eef2ff 0%, #f8f9fa 100%)' }}>
      <Header />
      <Navbar />
      <main className="flex-grow-1 d-flex align-items-center" style={{ paddingTop: '90px', paddingBottom: '40px' }}>
        <div className="container">
          <div className="row justify-content-center align-items-stretch g-4 w-100">
            <Outlet />
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}