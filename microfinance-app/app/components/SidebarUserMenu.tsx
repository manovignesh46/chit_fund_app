// @ts-nocheck
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { authAPI } from '../../lib/api';

interface SidebarUserMenuProps {
  showDetails: boolean;
  onClose: () => void;
}

export default function SidebarUserMenu({ showDetails, onClose }: SidebarUserMenuProps) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = await authAPI.getCurrentUser();
        setUser(userData);
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };
    checkAuth();
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

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
    <div ref={menuRef} className="relative w-full">
      {/* Popover — renders above the footer trigger */}
      {menuOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-surface-elevated border border-gray-200 dark:border-surface-border rounded-lg shadow-lg py-1 z-50">
          <Link
            href="/settings"
            onClick={() => {
              setMenuOpen(false);
              if (window.innerWidth < 1024) onClose();
            }}
            className="flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 dark:text-theme-secondary hover:bg-gray-100 dark:hover:bg-surface-hover hover:text-gray-900 dark:hover:text-theme-primary transition-colors"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Settings
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 dark:text-theme-secondary hover:bg-gray-100 dark:hover:bg-surface-hover hover:text-gray-900 dark:hover:text-theme-primary transition-colors"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Sign out
          </button>
        </div>
      )}

      {/* Footer trigger — always collapsed, click to open */}
      <button
        onClick={() => setMenuOpen((v) => !v)}
        className={`w-full flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-gray-100 dark:hover:bg-surface-hover transition-colors text-left ${menuOpen ? 'bg-gray-100 dark:bg-surface-hover' : ''}`}
      >
        <div className="bg-blue-600 text-white rounded-full w-9 h-9 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-semibold">{user.name.charAt(0).toUpperCase()}</span>
        </div>
        {showDetails && (
          <div className="flex-1 min-w-0 text-left">
            <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{user.name}</p>
            <p className="text-xs text-gray-500 dark:text-theme-muted truncate">{user.email}</p>
          </div>
        )}
        {showDetails && (
          <svg className={`w-4 h-4 flex-shrink-0 text-gray-400 transition-transform duration-150 ${menuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 15l7-7 7 7" />
          </svg>
        )}
      </button>
    </div>
  );
}
