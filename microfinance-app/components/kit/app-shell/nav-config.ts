/**
 * Navigation and route map for the app shell: the single source of truth for the
 * sidebar groups, the phone bottom bar, the More sheet, the active nav item and the
 * breadcrumb trail. No React here, so it can be unit-tested and read by any page.
 *
 * - NAV_GROUPS: sidebar sections, in order. `bottomBar` puts an item on the phone bar.
 * - ROUTES: every page pattern with its breadcrumb label and parent. The active nav
 *   item is the nav item whose href is the root of the matched route's parent chain,
 *   so `/chit-funds/auction-history` (parent: Auction Plan) highlights Auction Plan
 *   and `/loans/12/repayments` highlights Loans.
 */
import type { LucideIcon } from 'lucide-react';
import {
  ArrowLeftRight,
  Bell,
  CalendarClock,
  CalendarDays,
  FileStack,
  Gavel,
  HandCoins,
  Handshake,
  History,
  LayoutDashboard,
  MessageSquare,
  PiggyBank,
  Settings,
  TrendingUp,
  UserCog,
  Users,
} from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  /** Label on the phone bottom bar, where space is short. */
  shortLabel?: string;
  href: string;
  icon: LucideIcon;
  /** Shown as one of the four phone bottom-bar slots (the fifth is More). */
  bottomBar?: boolean;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'overview',
    label: 'Overview',
    items: [
      { id: 'dashboard', label: 'Dashboard', shortLabel: 'Home', href: '/dashboard', icon: LayoutDashboard, bottomBar: true },
      { id: 'calendar', label: 'Calendar', href: '/calendar', icon: CalendarDays },
      { id: 'activities', label: 'Activities', href: '/activities', icon: History },
    ],
  },
  {
    id: 'chit-funds',
    label: 'Chit Funds',
    items: [
      { id: 'chit-funds', label: 'Chit Funds', href: '/chit-funds', icon: PiggyBank, bottomBar: true },
      { id: 'templates', label: 'Templates', href: '/chit-fund-templates', icon: FileStack },
      { id: 'auction-plan', label: 'Auction Plan', href: '/chit-funds/projection', icon: Gavel },
    ],
  },
  {
    id: 'lending',
    label: 'Lending',
    items: [
      { id: 'loans', label: 'Loans', href: '/loans', icon: HandCoins, bottomBar: true },
      { id: 'dues', label: 'Dues Tracker', shortLabel: 'Dues', href: '/dues', icon: CalendarClock, bottomBar: true },
    ],
  },
  {
    id: 'people',
    label: 'People',
    items: [{ id: 'members', label: 'Members', href: '/members', icon: Users }],
  },
  {
    id: 'money',
    label: 'Money',
    items: [
      { id: 'transactions', label: 'Transactions', href: '/transactions', icon: ArrowLeftRight },
      { id: 'trends', label: 'Trends', href: '/financial-trends', icon: TrendingUp },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    items: [
      { id: 'users', label: 'Users', href: '/users', icon: UserCog },
      { id: 'partners', label: 'Partners', href: '/partners', icon: Handshake },
      { id: 'settings', label: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

/** Top-bar destinations (icons with live unread badges), not in the sidebar. */
export const TOP_BAR_ITEMS: NavItem[] = [
  { id: 'messages', label: 'Messages', href: '/messages', icon: MessageSquare },
  { id: 'notifications', label: 'Notifications', href: '/notifications', icon: Bell },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((group) => group.items);
export const BOTTOM_BAR_ITEMS: NavItem[] = NAV_ITEMS.filter((item) => item.bottomBar);

export type RouteParams = Record<string, string>;

export interface RouteDef {
  /** Path pattern; `:name` matches one segment. */
  pattern: string;
  /** Breadcrumb label. A function receives the route params (the fallback until a page sets a real name). */
  label: string | ((params: RouteParams) => string);
  /** Parent pattern for the trail. Default: the pattern minus its last segment, if that is a route. `null` = a root. */
  parent?: string | null;
  /** False when the pattern has no page of its own (the crumb renders as text). */
  link?: boolean;
  /** 'full': the page fills the viewport between the bars and the document does not scroll (chat). */
  layout?: 'full';
  /**
   * Query string appended to the parent's crumb link (and the phone back chevron) when
   * this route is open, e.g. 'tab=contributions' so going back from a fund's
   * contributions page reopens the fund on its Contributions tab, not Overview.
   */
  parentQuery?: string;
}

export const ROUTES: RouteDef[] = [
  { pattern: '/dashboard', label: 'Dashboard' },
  { pattern: '/calendar', label: 'Calendar' },
  { pattern: '/activities', label: 'Activities' },

  { pattern: '/chit-funds', label: 'Chit Funds' },
  { pattern: '/chit-funds/new', label: 'New chit fund' },
  { pattern: '/chit-funds/projection', label: 'Auction Plan', parent: null },
  // Linked only from the Auction Plan page, so they sit under it.
  { pattern: '/chit-funds/auction-bookings', label: 'Auction bookings', parent: '/chit-funds/projection' },
  { pattern: '/chit-funds/auction-history', label: 'Auction history', parent: '/chit-funds/projection' },
  { pattern: '/chit-funds/:id', label: (p) => `Chit fund #${p.id}` },
  { pattern: '/chit-funds/:id/edit', label: 'Edit' },
  { pattern: '/chit-funds/:id/members', label: 'Members' },
  { pattern: '/chit-funds/:id/members/:memberId', label: (p) => `Member #${p.memberId}`, link: false },
  { pattern: '/chit-funds/:id/members/:memberId/contributions', label: 'Contributions' },
  { pattern: '/chit-funds/:id/contributions', label: 'Contributions', parentQuery: 'tab=contributions' },
  { pattern: '/chit-funds/:id/auctions', label: 'Auctions', parentQuery: 'tab=auctions' },
  { pattern: '/chit-funds/:id/assign-member', label: 'Assign member' },

  { pattern: '/chit-fund-templates', label: 'Templates' },
  { pattern: '/chit-fund-templates/new', label: 'New template' },
  { pattern: '/chit-fund-templates/:id', label: (p) => `Template #${p.id}` },
  { pattern: '/chit-fund-templates/:id/edit', label: 'Edit' },

  { pattern: '/loans', label: 'Loans' },
  { pattern: '/loans/new', label: 'New loan' },
  { pattern: '/loans/:id', label: (p) => `Loan #${p.id}` },
  { pattern: '/loans/:id/edit', label: 'Edit' },
  { pattern: '/loans/:id/repayments', label: 'Repayments', parentQuery: 'tab=schedule' },
  { pattern: '/loans/:id/repayments/new', label: 'New repayment' },
  { pattern: '/loans/:id/payment-schedules', label: 'Payment schedules', parentQuery: 'tab=schedule' },
  { pattern: '/dues', label: 'Dues Tracker' },

  { pattern: '/members', label: 'Members' },
  { pattern: '/members/:id', label: (p) => `Member #${p.id}` },
  { pattern: '/members/:id/assign-chit-fund', label: 'Assign chit fund', parentQuery: 'tab=chit-funds' },

  { pattern: '/transactions', label: 'Transactions' },
  { pattern: '/financial-trends', label: 'Trends' },

  { pattern: '/users', label: 'Users' },
  { pattern: '/partners', label: 'Partners' },
  { pattern: '/settings', label: 'Settings' },

  { pattern: '/messages', label: 'Messages', layout: 'full' },
  { pattern: '/notifications', label: 'Notifications' },
  { pattern: '/styleguide', label: 'Styleguide' },
];

const ROUTE_BY_PATTERN = new Map(ROUTES.map((route) => [route.pattern, route]));
const NAV_BY_HREF = new Map([...NAV_ITEMS, ...TOP_BAR_ITEMS].map((item) => [item.href, item]));

const segmentsOf = (path: string) => path.split('/').filter(Boolean);

/** The shell is not shown on the login page. */
export function isShellless(pathname: string | null | undefined): boolean {
  return pathname === '/login' || !!pathname?.startsWith('/login/');
}

function normalise(pathname: string | null | undefined): string {
  if (!pathname || pathname === '/') return '/dashboard';
  return pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
}

export interface RouteMatch {
  route: RouteDef;
  params: RouteParams;
}

/** Most specific route for a path (static segments beat `:params`), or null. */
export function matchRoute(pathname: string | null | undefined): RouteMatch | null {
  const parts = segmentsOf(normalise(pathname));
  let best: RouteMatch | null = null;
  let bestScore = -1;
  for (const route of ROUTES) {
    const pattern = segmentsOf(route.pattern);
    if (pattern.length !== parts.length) continue;
    const params: RouteParams = {};
    let score = 0;
    let ok = true;
    for (let i = 0; i < pattern.length; i++) {
      if (pattern[i].startsWith(':')) {
        params[pattern[i].slice(1)] = decodeURIComponent(parts[i]);
      } else if (pattern[i] === parts[i]) {
        score++;
      } else {
        ok = false;
        break;
      }
    }
    if (ok && score > bestScore) {
      best = { route, params };
      bestScore = score;
    }
  }
  return best;
}

function parentPattern(route: RouteDef): string | null {
  if (route.parent !== undefined) return route.parent;
  const parts = segmentsOf(route.pattern);
  while (parts.length > 1) {
    parts.pop();
    const candidate = '/' + parts.join('/');
    if (ROUTE_BY_PATTERN.has(candidate)) return candidate;
  }
  return null;
}

const fill = (pattern: string, params: RouteParams) =>
  pattern.replace(/:([A-Za-z]+)/g, (_, name: string) => encodeURIComponent(params[name] ?? name));

export interface Crumb {
  /** The concrete path of this level (also the key for page-supplied labels). */
  path: string;
  /** Link target, or null when the level has no page. */
  href: string | null;
  label: string;
  /** True while the label is the generic fallback for a dynamic segment. */
  fallback: boolean;
}

/**
 * Breadcrumb trail for a path, root first. `labels` maps concrete paths to names a
 * page supplied (see useBreadcrumbLabel); dynamic levels fall back to "Loan #12".
 * An unknown path gives the nearest nav section plus "Page not found".
 */
export function getBreadcrumbs(pathname: string | null | undefined, labels: Record<string, string> = {}): Crumb[] {
  const match = matchRoute(pathname);
  if (!match) {
    const section = findNavItemByPrefix(normalise(pathname));
    const notFound: Crumb = { path: normalise(pathname), href: null, label: 'Page not found', fallback: false };
    return section ? [{ path: section.href, href: section.href, label: section.label, fallback: false }, notFound] : [notFound];
  }
  const chain: Crumb[] = [];
  let route: RouteDef | null = match.route;
  let guard = 0;
  // Set by the child level just processed: its parent's link carries this query (e.g. the tab).
  let childQuery: string | undefined;
  while (route && guard++ < 10) {
    const path = fill(route.pattern, match.params);
    const supplied = labels[path];
    const dynamic = typeof route.label === 'function';
    const label = supplied || (typeof route.label === 'function' ? route.label(match.params) : route.label);
    const href = route.link === false ? null : childQuery ? `${path}?${childQuery}` : path;
    chain.unshift({ path, href, label, fallback: dynamic && !supplied });
    childQuery = route.parentQuery;
    const parent = parentPattern(route);
    route = parent ? ROUTE_BY_PATTERN.get(parent) ?? null : null;
  }
  return chain;
}

function findNavItemByPrefix(path: string): NavItem | null {
  let best: NavItem | null = null;
  for (const item of [...NAV_ITEMS, ...TOP_BAR_ITEMS]) {
    if ((path === item.href || path.startsWith(item.href + '/')) && (!best || item.href.length > best.href.length)) best = item;
  }
  return best;
}

/**
 * The one nav item (sidebar or top bar) that is active for a path: the item whose
 * href is the root of the route's parent chain; for unknown paths, the longest
 * nav href that is a segment prefix of the path.
 */
export function getActiveNavItem(pathname: string | null | undefined): NavItem | null {
  const match = matchRoute(pathname);
  if (!match) return findNavItemByPrefix(normalise(pathname));
  let route: RouteDef = match.route;
  let guard = 0;
  for (let parent = parentPattern(route); parent && guard++ < 10; parent = parentPattern(route)) {
    route = ROUTE_BY_PATTERN.get(parent) ?? route;
  }
  return NAV_BY_HREF.get(route.pattern) ?? null;
}

/** 'full' for pages that fill the viewport between the bars (see RouteDef.layout). */
export function getRouteLayout(pathname: string | null | undefined): 'page' | 'full' {
  return matchRoute(pathname)?.route.layout === 'full' ? 'full' : 'page';
}
