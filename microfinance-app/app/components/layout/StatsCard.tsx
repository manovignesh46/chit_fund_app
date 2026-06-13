'use client';

import React from 'react';

interface StatsCardProps {
  label: string;
  value: string | number;
  sublabel?: string;
  icon?: React.ReactNode;
}

export default function StatsCard({ label, value, sublabel, icon }: StatsCardProps) {
  return (
    <div className="dark-card p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <p className="text-sm text-gray-400 truncate">{label}</p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-theme-heading mt-1">{value}</p>
          {sublabel && <p className="text-xs text-gray-500 mt-1">{sublabel}</p>}
        </div>
        {icon && (
          <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gray-50 dark:bg-surface-elevated border border-gray-200 dark:border-surface-border flex items-center justify-center text-gray-500">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
