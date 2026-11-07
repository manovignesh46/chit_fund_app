'use client';

/**
 * Desktop sidebar collapse state. The truth is the `data-sidebar` attribute on
 * <html>, which the inline theme script (app/theme/inline-script.ts) sets from
 * localStorage before first paint; all widths are CSS driven by that attribute, so
 * nothing shifts on load. React reads it through useSyncExternalStore (server and
 * hydration render: expanded) only for labels, tooltips and aria state.
 */
import * as React from 'react';
import { SIDEBAR_DATA_ATTRIBUTE, SIDEBAR_STORAGE_KEY } from '@/app/theme/config';

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

function readCollapsed(): boolean {
  return document.documentElement.getAttribute(SIDEBAR_DATA_ATTRIBUTE) === 'collapsed';
}

function apply(collapsed: boolean) {
  document.documentElement.setAttribute(SIDEBAR_DATA_ATTRIBUTE, collapsed ? 'collapsed' : 'expanded');
}

export function setSidebarCollapsed(collapsed: boolean): void {
  apply(collapsed);
  try {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? 'collapsed' : 'expanded');
  } catch {
    // storage blocked: the state still applies for this page view
  }
  notify();
}

export function toggleSidebarCollapsed(): void {
  setSidebarCollapsed(!readCollapsed());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Keep other tabs in step.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== SIDEBAR_STORAGE_KEY) return;
    apply(event.newValue === 'collapsed');
    notify();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** True when the desktop sidebar is collapsed to icons. False on the server and during hydration. */
export function useSidebarCollapsed(): boolean {
  return React.useSyncExternalStore(subscribe, readCollapsed, () => false);
}
