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

export default function Header({ onMenuToggle }: HeaderProps) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 bg-white shadow-sm border-b border-gray-200 h-16 min-h-16 flex items-center flex-shrink-0">
      <div className="px-4 w-full">
        <div className="flex justify-between items-center h-12 min-h-12">

          {/* Left: Menu toggle and title */}
          <div className="flex items-center gap-3">
            <button
              onClick={onMenuToggle}
              className="lg:hidden mr-2 p-1 rounded-md hover:bg-gray-100 transition-colors"
              aria-label="Toggle sidebar"
            >
              <svg
                className="w-4 h-4 text-gray-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h1 className="text-lg font-semibold text-gray-800 ml-2">
              AM Fincorp
            </h1>
          </div>

          {/* Right: Messages, Notifications, Partner */}
          <div className="flex items-center gap-3 sm:gap-4">
            <MessageBadge />
            <NotificationBell />
            <PartnerSelector variant="default" label="" className="flex flex-row items-center gap-2 !mb-0" />
          </div>
        </div>
      </div>
    </header>
  );
}
