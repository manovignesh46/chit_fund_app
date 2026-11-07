'use client';

import * as React from 'react';
import { PanelLeft } from 'lucide-react';
import { ShellTooltip } from './shell-tooltip';
import MessageBadge from '@/app/components/MessageBadge';
import NotificationBell from '@/app/components/NotificationBell';
import { PartnerSelector } from '@/app/contexts/PartnerContext';
import { Breadcrumbs } from './breadcrumbs';
import { SIDEBAR_ID } from './app-sidebar';
import { toggleSidebarCollapsed, useSidebarCollapsed } from './sidebar-state';

function SidebarToggle() {
  const collapsed = useSidebarCollapsed();
  const label = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
  return (
    <ShellTooltip
      side="bottom"
      label={
        <>
          {label} <span className="ml-1 opacity-70">Ctrl+B</span>
        </>
      }
    >
      <button
        type="button"
        onClick={toggleSidebarCollapsed}
        aria-label={label}
        aria-controls={SIDEBAR_ID}
        aria-expanded={!collapsed}
        aria-keyshortcuts="Control+B Meta+B"
        className="-ml-1 hidden h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:inline-flex"
      >
        <PanelLeft aria-hidden="true" className="h-[18px] w-[18px]" />
      </button>
    </ShellTooltip>
  );
}

/** Sticky 56px top bar: sidebar toggle (desktop), breadcrumbs, messages, notifications, partner. */
export function TopBar() {
  return (
    <header className="sticky top-0 z-40 flex h-[var(--topbar-height)] shrink-0 items-center gap-2 border-b bg-sidebar px-2 sm:px-4">
      <SidebarToggle />
      <Breadcrumbs />
      <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1.5">
        <MessageBadge />
        <NotificationBell />
        {/* Space reserved while partners load, so the icons do not jump left (CLS). */}
        <div className="ml-1 hidden min-w-[160px] items-center justify-end md:flex">
          <PartnerSelector variant="default" label="" className="!mb-0" />
        </div>
      </div>
    </header>
  );
}
