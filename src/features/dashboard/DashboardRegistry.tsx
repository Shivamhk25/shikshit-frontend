import type { Role } from '@/types/auth';
import { DashboardPage } from './DashboardPage';

type DashboardComponent = React.ComponentType;

const dashboardRegistry: Record<Role, DashboardComponent> = {
  super_admin: DashboardPage,
  institute_admin: DashboardPage,
  principal: DashboardPage,
  teacher: DashboardPage,
  student: DashboardPage,
  parent: DashboardPage,
  accountant: DashboardPage,
  registrar: DashboardPage,
  hr: DashboardPage,
};

export function getDashboardForRole(role: Role): DashboardComponent {
  return dashboardRegistry[role] || DashboardPage;
}

export function useDashboard() {
  return { getDashboardForRole };
}