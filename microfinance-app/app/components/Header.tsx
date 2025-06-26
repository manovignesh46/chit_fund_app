// @ts-nocheck
'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { authAPI } from '../../lib/api';

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
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="px-4 py-3">
        <div className="flex justify-between items-center">
          {/* Left side: Menu toggle and title */}
          <div className="flex items-center">
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
            <h1 className="text-lg font-semibold text-gray-800">
              <span className="hidden sm:inline">AM Fincorp</span>
              <span className="sm:hidden">AM Fincorp</span>
            </h1>
          </div>

          {/* Right side: User Menu */}
          <div className="flex items-center">

            {user && (
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center space-x-1.5 bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded-lg transition duration-300 text-sm"
                  aria-label="Account menu"
                  title="Account menu"
                >
                  <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center">
                    <span className="text-xs font-semibold">{user.name.charAt(0)}</span>
                  </div>
                  <span className="hidden sm:block text-gray-700 font-medium text-xs">{user.name}</span>
                  <svg
                    className={`w-3 h-3 text-gray-500 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </button>

                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-xl z-50 border border-gray-200 overflow-hidden">
                    <div className="p-4 bg-gray-50 border-b border-gray-200">
                      <div className="flex items-center space-x-3">
                        <div className="bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center">
                          <span className="text-lg font-semibold">{user.name.charAt(0)}</span>
                        </div>
                        <div>
                          <p className="text-gray-800 font-medium">{user.name}</p>
                          <p className="text-gray-600 text-xs">{user.email}</p>
                        </div>
                      </div>
                      <div className="mt-2">
                        <span className="text-xs font-medium px-2 py-1 bg-blue-100 text-blue-800 rounded-full uppercase">{user.role}</span>
                      </div>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100 transition duration-300 flex items-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                        </svg>
                        <span>Logout</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
