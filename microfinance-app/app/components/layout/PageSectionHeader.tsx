'use client';

import React from 'react';

interface PageSectionHeaderProps {
  icon?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: string;
  actions?: React.ReactNode;
}

export default function PageSectionHeader({ icon, title, subtitle, actions }: PageSectionHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-gray-50 dark:bg-surface-elevated border border-gray-200 dark:border-surface-border flex items-center justify-center text-gray-400">
            {icon}
          </div>
        )}
        <div>
          {typeof title === 'string' ? (
            <h2 className="text-xl font-semibold text-gray-900 dark:text-theme-heading">{title}</h2>
          ) : (
            title
          )}
          {subtitle && <p className="text-sm text-gray-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
    </div>
  );
}
