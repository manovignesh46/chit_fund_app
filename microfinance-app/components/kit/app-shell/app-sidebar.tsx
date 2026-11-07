'use client';

import * as React from 'react';
import Link from 'next/link';
import { ShellTooltip } from './shell-tooltip';
import SidebarUserMenu from '@/app/components/SidebarUserMenu';
import { NAV_GROUPS, type NavItem } from './nav-config';
import { useSidebarCollapsed } from './sidebar-state';

export const SIDEBAR_ID = 'app-sidebar';

const linkClass =
  'flex h-9 items-center gap-3 rounded-md px-[11px] text-sm font-medium text-sidebar-foreground transition-colors ' +
  'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring ' +
  'aria-[current=page]:bg-primary-subtle aria-[current=page]:text-primary-text';

function SidebarLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  const Icon = item.icon;
  return (
    <ShellTooltip label={item.label} side="right" disabled={!collapsed}>
      <Link href={item.href} aria-current={active ? 'page' : undefined} className={linkClass}>
        <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
        <span className="truncate sidebar-collapsed:sr-only">{item.label}</span>
      </Link>
    </ShellTooltip>
  );
}

/**
 * Desktop sidebar (from `lg`): fixed, grouped, 16rem open or 3.5rem icons-only.
 * Width comes from --shell-sidebar-width (styles/theme/shell.css), which follows
 * <html data-sidebar>, so the restored state is right on first paint.
 */
export function AppSidebar({ activeId }: { activeId: string | null }) {
  const collapsed = useSidebarCollapsed();
  return (
    <div
      id={SIDEBAR_ID}
      className="fixed inset-y-0 left-0 z-30 hidden w-[var(--shell-sidebar-width)] flex-col border-r bg-sidebar text-sidebar-foreground transition-[width] duration-200 ease-out motion-reduce:transition-none lg:flex"
    >
      <div className="flex h-14 shrink-0 items-center border-b px-2.5">
        <Link
          href="/dashboard"
          className="flex min-w-0 items-center gap-2.5 rounded-md p-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
        >
          <span
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground"
          >
            AF
          </span>
          <span className="truncate text-sm font-semibold text-sidebar-accent-foreground sidebar-collapsed:sr-only">AM Fincorp</span>
        </Link>
      </div>

      <nav aria-label="Main" className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-3">
        {NAV_GROUPS.map((group, index) => (
          <div key={group.id} className="mb-4 last:mb-0 sidebar-collapsed:mb-2">
            {index > 0 ? <div aria-hidden="true" className="mx-1.5 mb-2 hidden h-px bg-border sidebar-collapsed:block" /> : null}
            <h2
              id={`nav-group-${group.id}`}
              className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sidebar-collapsed:sr-only"
            >
              {group.label}
            </h2>
            <ul aria-labelledby={`nav-group-${group.id}`} className="space-y-0.5">
              {group.items.map((item) => (
                <li key={item.id}>
                  <SidebarLink item={item} active={item.id === activeId} collapsed={collapsed} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t p-1.5">
        <SidebarUserMenu />
      </div>
    </div>
  );
}
