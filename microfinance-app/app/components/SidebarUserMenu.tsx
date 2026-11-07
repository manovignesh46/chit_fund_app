'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChevronsUpDown, LogOut, Settings } from 'lucide-react';
import { authAPI } from '../../lib/api';
import { invalidateDashboardCache } from '../../lib/dashboardCache';
import { usePartner } from '../contexts/PartnerContext';

/**
 * Sign out and drop everything cached for this user: the SWR cache (authAPI.logout
 * and the /login route both clear it), the dashboard summary in localStorage, and
 * the saved partner. Shared by the sidebar footer and the phone More sheet.
 */
export function useSignOut() {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const signOut = React.useCallback(async () => {
    setPending(true);
    try {
      await authAPI.logout();
      // Do not leave this user's cached dashboard figures for the next login.
      invalidateDashboardCache();
      try {
        localStorage.removeItem('selectedPartnerId');
        localStorage.removeItem('selectedPartnerName');
      } catch {
        // storage blocked
      }
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      setPending(false);
    }
  }, [router]);
  return { signOut, pending };
}

/** First letter of the user's name, for the avatar. */
export function initialOf(name: string | undefined | null): string {
  return (name || '?').trim().charAt(0).toUpperCase() || '?';
}

/**
 * Sidebar footer: avatar with name and email (labels hidden when the sidebar is
 * collapsed), opening a small menu with Settings and Sign out. Escape or a click
 * outside closes it and focus returns to the trigger.
 */
export default function SidebarUserMenu() {
  const { currentUser } = usePartner();
  const { signOut, pending } = useSignOut();
  const [open, setOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const menuId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    menuRef.current?.querySelector<HTMLElement>('a,button')?.focus();
    const onPointer = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!currentUser) return <div className="h-12" aria-hidden="true" />;

  const itemClass =
    'flex w-full items-center gap-2.5 rounded-sm px-3 py-2.5 text-sm text-popover-foreground transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none';

  return (
    <div ref={rootRef} className="relative">
      {open ? (
        <div
          ref={menuRef}
          id={menuId}
          className="absolute bottom-full left-0 z-50 mb-2 w-56 rounded-lg border bg-popover p-1 shadow-lg"
        >
          <div className="border-b px-3 pb-2 pt-1.5">
            <p className="truncate text-sm font-medium text-popover-foreground">{currentUser.name}</p>
            <p className="truncate text-xs text-muted-foreground">{currentUser.email}</p>
          </div>
          <Link href="/settings" onClick={() => setOpen(false)} className={`${itemClass} mt-1`}>
            <Settings aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
            Settings
          </Link>
          <button type="button" onClick={signOut} disabled={pending} className={itemClass}>
            <LogOut aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
            {pending ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      ) : null}

      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={`Account: ${currentUser.name}`}
        onClick={() => setOpen((value) => !value)}
        className={`flex h-12 w-full items-center gap-3 rounded-md px-1.5 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring ${
          open ? 'bg-sidebar-accent' : ''
        }`}
      >
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
        >
          {initialOf(currentUser.name)}
        </span>
        <span className="min-w-0 flex-1 sidebar-collapsed:hidden">
          <span className="block truncate text-sm font-medium text-sidebar-accent-foreground">{currentUser.name}</span>
          <span className="block truncate text-xs text-muted-foreground">{currentUser.email}</span>
        </span>
        <ChevronsUpDown aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground sidebar-collapsed:hidden" />
      </button>
    </div>
  );
}
