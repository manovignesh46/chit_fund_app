// @ts-nocheck
'use client';

import React from 'react';
import Link from 'next/link';
import { PartnerSelector } from '../contexts/PartnerContext';
import { usePathname } from 'next/navigation';
import NotificationBell from './NotificationBell';
import MessageBadge from './MessageBadge';

interface HeaderProps {
  onMenuToggle: () => void;
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return null;
  }

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
            <Link
              href="/dashboard"
              className="text-lg sm:text-xl font-bold text-gray-900 dark:text-theme-heading hover:opacity-80 transition-opacity"
            >
              AM Fincorp
            </Link>
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
