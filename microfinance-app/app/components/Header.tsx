// @ts-nocheck
'use client';

import React from 'react';
import { PartnerSelector } from '../contexts/PartnerContext';
import { usePathname } from 'next/navigation';
import NotificationBell from './NotificationBell';
import MessageBadge from './MessageBadge';

interface HeaderProps {
  onMenuToggle: () => void;
}

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/chit-funds': 'Chit Funds',
  '/loans': 'Loans',
  '/members': 'Members',
  '/partners': 'Partners',
  '/users': 'User Accounts',
  '/transactions': 'Transactions',
  '/financial-trends': 'Financial Trends',
  '/calendar': 'Calendar',
  '/activities': 'Activities',
  '/messages': 'Messages',
  '/notifications': 'Notifications',
  '/settings': 'Settings',
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  const match = Object.entries(PAGE_TITLES).find(([path]) => pathname.startsWith(path + '/'));
  return match ? match[1] : 'AM Fincorp';
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return null;
  }

  const pageTitle = getPageTitle(pathname);

  return (
    <header className="sticky top-0 z-50 bg-white dark:bg-surface-sidebar border-b border-gray-200 dark:border-surface-border h-16 min-h-16 flex items-center flex-shrink-0">
      <div className="px-4 sm:px-6 w-full">
        <div className="flex justify-between items-center h-12 min-h-12">
          <div className="flex items-center gap-3">
            <button
              onClick={onMenuToggle}
              className="lg:hidden p-1.5 rounded-md text-gray-500 hover:bg-gray-100 dark:hover:bg-surface-hover dark:text-theme-muted transition-colors"
              aria-label="Toggle sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            {/* Mobile: show company name. Desktop: show current page title (sidebar provides brand context) */}
            <h1 className="text-base font-semibold text-gray-900 dark:text-theme-heading">
              <span className="lg:hidden">AM Fincorp</span>
              <span className="hidden lg:inline">{pageTitle}</span>
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <MessageBadge />
            <NotificationBell />
            <div className="hidden md:block">
              <PartnerSelector variant="default" label="" className="flex flex-row items-center gap-2 !mb-0" />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
