// @ts-nocheck
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { authAPI } from '../../lib/api';

interface SidebarUserMenuProps {
  showDetails: boolean;
}

export default function SidebarUserMenu({ showDetails }: SidebarUserMenuProps) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await authAPI.logout();
      setUser(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('selectedPartnerId');
        localStorage.removeItem('selectedPartnerName');
      }
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading || !user) return null;

  return (
    <div className="w-full relative" ref={menuRef}>
      <button
        onClick={() => setShowMenu(!showMenu)}
        className={`w-full flex items-center rounded-lg hover:bg-gray-100 transition-colors ${
          showDetails ? 'gap-3 p-2' : 'justify-center p-2 lg:p-2'
        }`}
        aria-label="User menu"
      >
        <div className="bg-blue-600 text-white rounded-full w-9 h-9 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-semibold">{user.name.charAt(0).toUpperCase()}</span>
        </div>
        {showDetails && (
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium text-gray-800 truncate">{user.name}</p>
            <p className="text-xs text-gray-500 truncate">
              {user.partner?.name || user.role}
            </p>
          </div>
        )}
        {showDetails && (
          <svg
            className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${showMenu ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
          </svg>
        )}
      </button>

      {showMenu && (
        <div
          className={`absolute bottom-full mb-2 bg-white rounded-lg shadow-lg border border-gray-200 z-50 overflow-hidden ${
            showDetails ? 'left-0 right-0' : 'left-0 w-56'
          }`}
        >
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900 truncate">{user.name}</p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
            {user.partner && (
              <p className="text-xs text-blue-600 mt-1">{user.partner.name}</p>
            )}
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-gray-50 flex items-center gap-2 min-h-[44px]"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>
      )}
    </div>
  );
}
