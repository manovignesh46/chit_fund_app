'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { authAPI } from '@/lib/api';

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
            </ul>
          </nav>
        </div>

        {user && (
          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex items-center space-x-2 bg-blue-700 hover:bg-blue-800 px-4 py-2 rounded-lg transition duration-300"
            >
              <span>{user.name}</span>
              <svg
                className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path>
              </svg>
            </button>

            {showDropdown && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg z-10">
                <div className="p-4 border-b border-gray-200">
                  <p className="text-gray-800 font-medium">{user.name}</p>
                  <p className="text-gray-600 text-sm">{user.email}</p>
                  <p className="text-gray-500 text-xs mt-1 uppercase">{user.role}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100 rounded-b-lg transition duration-300"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  );
}
