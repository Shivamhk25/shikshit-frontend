import { createBrowserRouter } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import { RoleRoute } from './RoleRoute';
import { Navigate } from 'react-router-dom';

const lazyImport = async () => {
  const mod = await import('@/features/dashboard/DashboardPage');
  return { Component: mod.DashboardPage };
};

const lazyAdmin = async () => {
  const mod = await import('@/features/admin/AdminDashboardPage');
  return { Component: mod.AdminDashboardPage };
};

const lazyStudents = async () => {
  const mod = await import('@/features/students/StudentsPage');
  return { Component: mod.StudentsPage };
};

const lazyAcademics = async () => {
  const mod = await import('@/features/academics/AcademicsPage');
  return { Component: mod.AcademicsPage };
};

const lazyFinance = async () => {
  const mod = await import('@/features/finance/FinancePage');
  return { Component: mod.FinancePage };
};

const lazyHR = async () => {
  const mod = await import('@/features/hr/HRPage');
  return { Component: mod.HRPage };
};

const lazyReports = async () => {
  const mod = await import('@/features/reports/ReportsPage');
  return { Component: mod.ReportsPage };
};

const lazySettings = async () => {
  const mod = await import('@/features/settings/SettingsPage');
  return { Component: mod.SettingsPage };
};

const lazyLogin = async () => {
  const mod = await import('@/features/auth/LoginPage');
  return { Component: mod.LoginPage };
};

const lazyForgotPassword = async () => {
  const mod = await import('@/features/auth/ForgotPasswordPage');
  return { Component: mod.ForgotPasswordPage };
};

const lazyResetPassword = async () => {
  const mod = await import('@/features/auth/ResetPasswordPage');
  return { Component: mod.ResetPasswordPage };
};

export const router = createBrowserRouter([
  {
    path: '/',
    element: <ProtectedRoute />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      {
        path: 'dashboard',
        element: (
          <RoleRoute roles={['super_admin', 'institute_admin', 'principal', 'teacher', 'student', 'parent', 'accountant', 'registrar', 'hr']} />
        ),
        children: [
          { index: true, lazy: lazyImport },
        ],
      },
      {
        path: 'admin',
        element: <RoleRoute roles={['super_admin', 'institute_admin']} />,
        children: [
          { index: true, lazy: lazyAdmin },
        ],
      },
      {
        path: 'students',
        element: <RoleRoute roles={['super_admin', 'institute_admin', 'principal', 'registrar', 'teacher']} />,
        children: [
          { index: true, lazy: lazyStudents },
        ],
      },
      {
        path: 'academics',
        element: <RoleRoute roles={['super_admin', 'institute_admin', 'principal', 'teacher']} />,
        children: [
          { index: true, lazy: lazyAcademics },
        ],
      },
      {
        path: 'finance',
        element: <RoleRoute roles={['super_admin', 'institute_admin', 'accountant']} />,
        children: [
          { index: true, lazy: lazyFinance },
        ],
      },
      {
        path: 'hr',
        element: <RoleRoute roles={['super_admin', 'institute_admin', 'hr']} />,
        children: [
          { index: true, lazy: lazyHR },
        ],
      },
      {
        path: 'reports',
        element: <RoleRoute roles={['super_admin', 'institute_admin', 'principal', 'accountant']} />,
        children: [
          { index: true, lazy: lazyReports },
        ],
      },
      {
        path: 'settings',
        element: <RoleRoute roles={['super_admin', 'institute_admin']} />,
        children: [
          { index: true, lazy: lazySettings },
        ],
      },
    ],
  },
  {
    path: '/login',
    lazy: lazyLogin,
  },
  {
    path: '/forgot-password',
    lazy: lazyForgotPassword,
  },
  {
    path: '/reset-password',
    lazy: lazyResetPassword,
  },
  {
    path: '*',
    element: <div className="d-flex justify-content-center align-items-center min-vh-100"><h1>404 - Page Not Found</h1></div>,
  },
]);