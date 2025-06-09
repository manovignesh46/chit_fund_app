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
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (isLoginPage || loading) {
    return null;
  }

  return (
    <header className="bg-blue-600 text-white p-4">
      <div className="container mx-auto flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Microfinance & Chit Fund Management</h1>
          <nav className="mt-2">
            <ul className="flex space-x-4">
              <li>
                <Link href="/dashboard" className={`hover:underline ${pathname === '/dashboard' ? 'font-bold' : ''}`}>
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/chit-funds" className={`hover:underline ${pathname.startsWith('/chit-funds') ? 'font-bold' : ''}`}>
                  Chit Funds
                </Link>
              </li>
              <li>
                <Link href="/loans" className={`hover:underline ${pathname.startsWith('/loans') ? 'font-bold' : ''}`}>
                  Loans
                </Link>
              </li>
              <li>
                <Link href="/members" className={`hover:underline ${pathname.startsWith('/members') ? 'font-bold' : ''}`}>
                  Members
                </Link>
              </li>
              <li>
                <Link href="/partners" className={`hover:underline ${pathname.startsWith('/partners') ? 'font-bold' : ''}`}>
                  Partners
                </Link>
              </li>
              <li>
                <Link href="/transactions" className={`hover:underline ${pathname.startsWith('/transactions') ? 'font-bold' : ''}`}>
                  Transactions
                </Link>
              </li>
            </ul>
          </nav>
        </div>

        {/* Partner Selector */}
        <div className="flex-1 max-w-xs mx-4">
          <PartnerSelector variant="header" />
        </div>

        {user && (
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center space-x-1 bg-blue-700 hover:bg-blue-800 px-3 py-1.5 rounded-lg transition duration-300 text-sm"
              aria-label="Account menu"
              title="Account menu"
            >
              {/* User icon instead of name */}
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
              <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl z-10 border border-gray-200 overflow-hidden">
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
    </header>
  );
}
