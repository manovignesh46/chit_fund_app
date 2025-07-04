// @ts-nocheck
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authAPI } from '../../lib/api';

export default function SidebarUserMenu() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = await authAPI.getCurrentUser();
        setUser(userData);
      } catch (error) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  const handleLogout = async () => {
    try {
      await authAPI.logout();
      setUser(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('selectedPartnerId');
      }
      router.push('/login');
    } catch (error) {}
  };

  if (loading || !user) return null;

  return (
    <div className="w-full">
      <div className="flex items-center space-x-3 mb-2">
        <div className="bg-blue-600 text-white rounded-full w-10 h-10 flex items-center justify-center">
          <span className="text-lg font-semibold">{user.name.charAt(0)}</span>
        </div>
        <div>
          <p className="text-gray-800 font-medium">{user.name}</p>
          <p className="text-gray-600 text-xs">{user.email}</p>
          <span className="text-xs font-medium px-2 py-1 bg-blue-100 text-blue-800 rounded-full uppercase">{user.role}</span>
        </div>
      </div>
      <button
        onClick={handleLogout}
        className="w-full text-left px-4 py-2 text-red-600 hover:bg-gray-100 transition duration-300 flex items-center space-x-2 text-sm rounded"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
        </svg>
        <span>Logout</span>
      </button>
    </div>
  );
}
