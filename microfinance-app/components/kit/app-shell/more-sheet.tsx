'use client';

import * as React from 'react';
import Link from 'next/link';
import { LogOut, Monitor, Moon, Sun } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useTheme, THEME_OPTION_META, THEME_PREFERENCES, type ThemePreference } from '@/app/theme';
import { PartnerSelector, usePartner } from '@/app/contexts/PartnerContext';
import { initialOf, useSignOut } from '@/app/components/SidebarUserMenu';
import { NAV_GROUPS } from './nav-config';

const THEME_ICONS: Record<ThemePreference, typeof Sun> = { light: Sun, dark: Moon, system: Monitor };

export interface MoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  activeId: string | null;
  /** Gets focus back when the sheet closes (the More button: the sheet has no Radix trigger). */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

/** Phone "More": every section, the active partner, theme and sign-out, in a bottom sheet. Loaded lazily. */
export default function MoreSheet({ open, onOpenChange, activeId, returnFocusRef }: MoreSheetProps) {
  const { currentUser } = usePartner();
  const { preference, setPreference } = useTheme();
  const { signOut, pending } = useSignOut();
  const close = () => onOpenChange(false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusRef?.current?.focus();
        }}
        className="px-0 pt-4 sm:mx-auto sm:max-w-xl sm:rounded-t-xl sm:border-x">
        <SheetHeader className="px-4 pr-14 text-left">
          <SheetTitle className="text-base">Menu</SheetTitle>
        </SheetHeader>

        {currentUser ? (
          <div className="mx-4 mt-3 flex items-center gap-3 rounded-lg bg-muted px-3 py-2.5">
            <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
              {initialOf(currentUser.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{currentUser.name}</p>
              <p className="truncate text-xs text-muted-foreground">{currentUser.email}</p>
            </div>
          </div>
        ) : null}

        <div className="mx-4 mt-3 md:hidden">
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Active partner</p>
          <PartnerSelector variant="sidebar" label="" className="[&_select]:h-11" />
        </div>

        <nav aria-label="All sections" className="mt-2 px-2">
          {NAV_GROUPS.map((group) => (
            <section key={group.id} aria-labelledby={`more-group-${group.id}`} className="mt-3">
              <h2 id={`more-group-${group.id}`} className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </h2>
              <ul className="grid grid-cols-2 gap-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = item.id === activeId;
                  return (
                    <li key={item.id}>
                      <Link
                        href={item.href}
                        onClick={close}
                        aria-current={active ? 'page' : undefined}
                        className="flex h-11 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-[current=page]:bg-primary-subtle aria-[current=page]:text-primary-text"
                      >
                        <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-muted-foreground [[aria-current=page]>&]:text-primary-text" />
                        <span className="truncate">{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </nav>

        <div className="mx-4 mt-5" role="group" aria-labelledby="more-theme-label">
          <p id="more-theme-label" className="mb-1.5 text-xs font-medium text-muted-foreground">
            Theme
          </p>
          <div className="grid grid-cols-3 gap-1 rounded-lg bg-muted p-1">
            {THEME_PREFERENCES.map((value) => {
              const Icon = THEME_ICONS[value];
              const selected = preference === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setPreference(value)}
                  className="flex h-10 items-center justify-center gap-1.5 rounded-md text-sm font-medium text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-sm"
                >
                  <Icon aria-hidden="true" className="h-4 w-4" />
                  {THEME_OPTION_META[value].label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mx-4 mt-5 border-t pt-3">
          <button
            type="button"
            onClick={signOut}
            disabled={pending}
            className="flex h-11 w-full items-center justify-center gap-2 rounded-md border text-sm font-medium text-destructive-text transition-colors hover:bg-destructive-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
          >
            <LogOut aria-hidden="true" className="h-4 w-4" />
            {pending ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
