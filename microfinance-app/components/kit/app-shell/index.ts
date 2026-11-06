export { AppShell } from './app-shell';
export { useBreadcrumbLabel } from './breadcrumb-labels';
export { useSidebarCollapsed, setSidebarCollapsed, toggleSidebarCollapsed } from './sidebar-state';
export {
  NAV_GROUPS,
  NAV_ITEMS,
  BOTTOM_BAR_ITEMS,
  TOP_BAR_ITEMS,
  ROUTES,
  getActiveNavItem,
  getBreadcrumbs,
  getRouteLayout,
  matchRoute,
} from './nav-config';
export type { NavGroup, NavItem, RouteDef, Crumb } from './nav-config';
