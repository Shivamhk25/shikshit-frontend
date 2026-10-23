import type { NavConfig } from '@/types/auth';
import type { Role } from '@/types/auth';

export const navConfig: Record<Role, NavConfig> = {
  super_admin: {
    left: [
      { label: 'Dashboard', href: '/dashboard', icon: 'bi bi-speedometer2', roles: ['super_admin'] },
      { label: 'Students', href: '/students', icon: 'bi bi-people', roles: ['super_admin', 'institute_admin', 'principal', 'registrar', 'teacher'] },
      { label: 'Academics', href: '/academics', icon: 'bi bi-book', roles: ['super_admin', 'institute_admin', 'principal', 'teacher'] },
      { label: 'Finance', href: '/finance', icon: 'bi bi-cash-coin', roles: ['super_admin', 'institute_admin', 'accountant'] },
      { label: 'HR', href: '/hr', icon: 'bi bi-briefcase', roles: ['super_admin', 'institute_admin', 'hr'] },
      { label: 'Reports', href: '/reports', icon: 'bi bi-graph-up', roles: ['super_admin', 'institute_admin', 'principal', 'accountant'] },
      { label: 'Settings', href: '/settings', icon: 'bi bi-gear', roles: ['super_admin', 'institute_admin'] },
      { label: 'Admin', href: '/admin', icon: 'bi bi-shield-lock', roles: ['super_admin', 'institute_admin'] },
    ],
    right: [],
  },
  institute_admin: {
    left: [
      { label: 'Dashboard', href: '/dashboard', icon: 'bi bi-speedometer2', roles: ['institute_admin'] },
      { label: 'Students', href: '/students', icon: 'bi bi-people', roles: ['institute_admin', 'principal', 'registrar', 'teacher'] },
      { label: 'Academics', href: '/academics', icon: 'bi bi-book', roles: ['institute_admin', 'principal', 'teacher'] },
      { label: 'Finance', href: '/finance', icon: 'bi bi-cash-coin', roles: ['institute_admin', 'accountant'] },
      { label: 'HR', href: '/hr', icon: 'bi bi-briefcase', roles: ['institute_admin', 'hr'] },
      { label: 'Reports', href: '/reports', icon: 'bi bi-graph-up', roles: ['institute_admin', 'principal', 'accountant'] },
      { label: 'Settings', href: '/settings', icon: 'bi bi-gear', roles: ['institute_admin'] },
      { label: 'Admin', href: '/admin', icon: 'bi bi-shield-lock', roles: ['institute_admin'] },
    ],
    right: [],
  },
  principal: {
    left: [
      { label: 'Dashboard', href: '/dashboard', icon: 'bi bi-speedometer2', roles: ['principal'] },
      { label: 'Students', href: '/students', icon: 'bi bi-people', roles: ['principal', 'registrar', 'teacher'] },
      { label: 'Academics', href: '/academics', icon: 'bi bi-book', roles: ['principal', 'teacher'] },
      { label: 'Reports', href: '/reports', icon: 'bi bi-graph-up', roles: ['principal'] },
    ],
    right: [],
  },
  teacher: {
    left: [
      { label: 'Dashboard', href: '/dashboard', icon: 'bi bi-speedometer2', roles: ['teacher'] },
      { label: 'My Classes', href: '/teacher/classes', icon: 'bi bi-journal-bookmark', roles: ['teacher'] },
      { label: 'Grades', href: '/teacher/grades', icon: 'bi bi-award', roles: ['teacher'] },
      { label: 'Attendance', href: '/teacher/attendance', icon: 'bi bi-calendar-check', roles: ['teacher'] },
      { label: 'Assignments', href: '/teacher/assignments', icon: 'bi bi-file-earmark-text', roles: ['teacher'] },
    ],
    right: [],
  },
  student: {
    left: [
      { label: 'Dashboard', href: '/dashboard', icon: 'bi bi-speedometer2', roles: ['student'] },
      { label: 'Timetable', href: '/student/timetable', icon: 'bi bi-calendar-week', roles: ['student'] },
      { label: 'Grades', href: '/student/grades', icon: 'bi bi-award', roles: ['student'] },
      { label: 'Assignments', href: '/student/assignments', icon: 'bi bi-file-earmark-text', roles: ['student'] },
      { label: 'Fees', href: '/student/fees', icon: 'bi bi-credit-card', roles: ['student'] },
    ],
    right: [],
  },
  parent: {
    left: [
      { label: 'Dashboard', href: '/dashboard', icon: 'bi bi-speedometer2', roles: ['parent'] },
      { label: 'Children', href: '/parent/children', icon: 'bi bi-people', roles: ['parent'] },
      { label: 'Progress', href: '/parent/progress', icon: 'bi bi-graph-up', roles: ['parent'] },
      { label: 'Fees', href: '/parent/fees', icon: 'bi bi-credit-card', roles: ['parent'] },
      { label: 'Communication', href: '/parent/messages', icon: 'bi bi-chat', roles: ['parent'] },
    ],
    right: [],
  },
  accountant: {
    left: [
      { label: 'Dashboard', href: '/dashboard', icon: 'bi bi-speedometer2', roles: ['accountant'] },
      { label: 'Finance', href: '/finance', icon: 'bi bi-cash-coin', roles: ['accountant'] },
      { label: 'Reports', href: '/reports', icon: 'bi bi-graph-up', roles: ['accountant'] },
    ],
    right: [],
  },
  registrar: {
    left: [
      { label: 'Dashboard', href: '/dashboard', icon: 'bi bi-speedometer2', roles: ['registrar'] },
      { label: 'Students', href: '/students', icon: 'bi bi-people', roles: ['registrar'] },
      { label: 'Admissions', href: '/admissions', icon: 'bi bi-file-earmark-plus', roles: ['registrar'] },
      { label: 'Reports', href: '/reports', icon: 'bi bi-graph-up', roles: ['registrar'] },
    ],
    right: [],
  },
  hr: {
    left: [
      { label: 'Dashboard', href: '/dashboard', icon: 'bi bi-speedometer2', roles: ['hr'] },
      { label: 'Staff', href: '/hr/staff', icon: 'bi bi-people', roles: ['hr'] },
      { label: 'Payroll', href: '/hr/payroll', icon: 'bi bi-cash-coin', roles: ['hr'] },
      { label: 'Leave', href: '/hr/leave', icon: 'bi bi-calendar-check', roles: ['hr'] },
    ],
    right: [],
  },
};

export function getNavConfig(role: Role): NavConfig {
  return navConfig[role] || { left: [], right: [] };
}