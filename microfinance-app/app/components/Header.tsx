// @ts-nocheck
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { authAPI } from '../../lib/api';
import { PartnerSelector } from '../contexts/PartnerContext';

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

export default function Header() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
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
    <header className="bg-blue-600 text-white">
      <div className="container mx-auto px-4 py-3">
        {/* Top row with title, partner selector, and user menu */}
        <div className="flex justify-between items-center">
          {/* Title and Mobile Menu Button */}
          <div className="flex items-center">
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="lg:hidden mr-3 p-2 rounded-md hover:bg-blue-700 transition-colors"
              aria-label="Toggle mobile menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                {showMobileMenu ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold">
              <span className="hidden sm:inline">Microfinance & Chit Fund Management</span>
              <span className="sm:hidden">MF & CF</span>
            </h1>
          </div>

          {/* Right side: Partner Selector and User Menu */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Partner Selector - Hidden on mobile, shown in mobile menu */}
            <div className="hidden sm:block w-32 md:w-48 lg:w-56">
              <PartnerSelector variant="header" />
            </div>

            {user && (
              <div className="relative">
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center space-x-1 bg-blue-700 hover:bg-blue-800 px-2 sm:px-3 py-1.5 rounded-lg transition duration-300 text-sm"
                  aria-label="Account menu"
                  title="Account menu"
                >
                  {/* User icon */}
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    ></path>
                  </svg>
                  <svg
                    className={`w-3 h-3 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
                  </svg>
                </button>

                {showDropdown && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl z-50 border border-gray-200 overflow-hidden">
                    <div className="p-4 bg-blue-50 border-b border-gray-200">
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
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
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

        {/* Desktop Navigation */}
        <nav className="hidden lg:block mt-3">
          <ul className="flex space-x-6">
            <li>
              <Link href="/dashboard" className={`hover:underline transition-colors ${pathname === '/dashboard' ? 'font-bold text-blue-200' : 'text-blue-100'}`}>
                Dashboard
              </Link>
            </li>
            <li>
              <Link href="/chit-funds" className={`hover:underline transition-colors ${pathname.startsWith('/chit-funds') ? 'font-bold text-blue-200' : 'text-blue-100'}`}>
                Chit Funds
              </Link>
            </li>
            <li>
              <Link href="/loans" className={`hover:underline transition-colors ${pathname.startsWith('/loans') ? 'font-bold text-blue-200' : 'text-blue-100'}`}>
                Loans
              </Link>
            </li>
            <li>
              <Link href="/members" className={`hover:underline transition-colors ${pathname.startsWith('/members') ? 'font-bold text-blue-200' : 'text-blue-100'}`}>
                Members
              </Link>
            </li>
            <li>
              <Link href="/partners" className={`hover:underline transition-colors ${pathname.startsWith('/partners') ? 'font-bold text-blue-200' : 'text-blue-100'}`}>
                Partners
              </Link>
            </li>
            <li>
              <Link href="/transactions" className={`hover:underline transition-colors ${pathname.startsWith('/transactions') ? 'font-bold text-blue-200' : 'text-blue-100'}`}>
                Transactions
              </Link>
            </li>
          </ul>
        </nav>

        {/* Mobile Navigation Menu */}
        {showMobileMenu && (
          <div className="lg:hidden mt-3 pb-3 border-t border-blue-500">
            {/* Partner Selector for Mobile */}
            <div className="mt-3 mb-4">
              <PartnerSelector variant="header" />
            </div>

            {/* Navigation Links */}
            <nav>
              <ul className="space-y-2">
                <li>
                  <Link
                    href="/dashboard"
                    className={`block py-2 px-3 rounded-md transition-colors ${pathname === '/dashboard' ? 'bg-blue-700 font-bold' : 'hover:bg-blue-700'}`}
                    onClick={() => setShowMobileMenu(false)}
                  >
                    Dashboard
                  </Link>
                </li>
                <li>
                  <Link
                    href="/chit-funds"
                    className={`block py-2 px-3 rounded-md transition-colors ${pathname.startsWith('/chit-funds') ? 'bg-blue-700 font-bold' : 'hover:bg-blue-700'}`}
                    onClick={() => setShowMobileMenu(false)}
                  >
                    Chit Funds
                  </Link>
                </li>
                <li>
                  <Link
                    href="/loans"
                    className={`block py-2 px-3 rounded-md transition-colors ${pathname.startsWith('/loans') ? 'bg-blue-700 font-bold' : 'hover:bg-blue-700'}`}
                    onClick={() => setShowMobileMenu(false)}
                  >
                    Loans
                  </Link>
                </li>
                <li>
                  <Link
                    href="/members"
                    className={`block py-2 px-3 rounded-md transition-colors ${pathname.startsWith('/members') ? 'bg-blue-700 font-bold' : 'hover:bg-blue-700'}`}
                    onClick={() => setShowMobileMenu(false)}
                  >
                    Members
                  </Link>
                </li>
                <li>
                  <Link
                    href="/partners"
                    className={`block py-2 px-3 rounded-md transition-colors ${pathname.startsWith('/partners') ? 'bg-blue-700 font-bold' : 'hover:bg-blue-700'}`}
                    onClick={() => setShowMobileMenu(false)}
                  >
                    Partners
                  </Link>
                </li>
                <li>
                  <Link
                    href="/transactions"
                    className={`block py-2 px-3 rounded-md transition-colors ${pathname.startsWith('/transactions') ? 'bg-blue-700 font-bold' : 'hover:bg-blue-700'}`}
                    onClick={() => setShowMobileMenu(false)}
                  >
                    Transactions
                  </Link>
                </li>
              </ul>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}
