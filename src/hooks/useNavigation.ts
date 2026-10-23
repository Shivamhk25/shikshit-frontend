import { useMemo } from 'react';
import { useAuthState } from '@/app/providers/AuthProvider';
import { getNavConfig } from '@/features/navigation/navConfig';
import type { NavConfig, NavItem, Role } from '@/types/auth';

export function useNavigation(): { navItems: NavConfig; filteredLeft: NavItem[]; filteredRight: NavItem[] } {
  const { user, isAuthenticated } = useAuthState();

  const navItems = useMemo((): NavConfig => {
    if (!isAuthenticated || !user) return { left: [], right: [] };
    return getNavConfig(user.role as Role);
  }, [isAuthenticated, user]);

  const filteredLeft = useMemo(() => navItems.left, [navItems]);
  const filteredRight = useMemo(() => navItems.right, [navItems]);

  return { navItems, filteredLeft, filteredRight };
}