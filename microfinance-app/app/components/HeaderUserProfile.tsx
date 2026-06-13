// @ts-nocheck
'use client';

import React, { useState, useEffect } from 'react';
import { authAPI } from '../../lib/api';

export default function HeaderUserProfile() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = await authAPI.getCurrentUser();
        setUser(userData);
      } catch {
        setUser(null);
      }
    };
    checkAuth();
  }, []);

  if (!user) return null;

  return (
    <div className="hidden sm:flex items-center gap-3 pl-3 border-l border-gray-200 dark:border-surface-border">
      <div className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center flex-shrink-0">
        <span className="text-xs font-semibold">{user.name.charAt(0).toUpperCase()}</span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-gray-800 dark:text-white truncate">{user.name}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.partner?.name || user.role}</p>
      </div>
    </div>
  );
}
