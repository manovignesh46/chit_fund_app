// @ts-nocheck
'use client';

import React, { useState, useEffect } from 'react';
import { PartnerSelector } from '../contexts/PartnerContext';
import { usePathname, useRouter } from 'next/navigation';
import { authAPI } from '../../lib/api';
import NotificationBell from './NotificationBell';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface HeaderProps {
  onMenuToggle: () => void;
}

export default function Header({ onMenuToggle }: HeaderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  // Skip auth check on login page
  const isLoginPage = pathname === '/login';

  useEffect(() => {
    if (isLoginPage) {
      setLoading(false);
      return;
    }

    const checkAuth = async () => {
      try {
        const userData = await authAPI.getCurrentUser();
        setUser(userData);
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [isLoginPage]);

  const handleLogout = async () => {
    try {
      await authAPI.logout();
      setUser(null);
      // Clear selected partner from localStorage to force partner selection on next login
      if (typeof window !== 'undefined') {
        localStorage.removeItem('selectedPartnerId');
      }
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (isLoginPage || loading) {
    return null;
  }

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 h-16 min-h-16 flex items-center">
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
              <span className="hidden sm:inline">AM Fincorp</span>
              <span className="sm:hidden">AM Fincorp</span>
            </h1>
          </div>

          {/* Right: Notifications and Partner Selector */}
          <div className="flex items-center gap-2 min-w-[180px] sm:pr-8 lg:pr-16 xl:pr-32 2xl:pr-64">
            <NotificationBell />
            <PartnerSelector variant="default" label="" className="flex flex-row items-center gap-2 !mb-0" />
          </div>
        </div>
      </div>
    </header>
  );
}
