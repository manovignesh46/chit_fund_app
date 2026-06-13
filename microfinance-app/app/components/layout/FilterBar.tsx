'use client';

import React from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface FilterOption {
  value: string;
  label: string;
}

interface FilterBarProps {
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  searchPlaceholder?: string;
  filters?: Array<{
    id: string;
    value: string;
    onChange: (value: string) => void;
    options: FilterOption[];
  }>;
}

export default function FilterBar({
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  filters = [],
}: FilterBarProps) {
  return (
    <div className="dark-card p-4 mb-4">
      <div className="flex flex-col sm:flex-row gap-3">
        {onSearchChange && (
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={searchPlaceholder}
              className="themed-input w-full pl-9 pr-4 py-2 text-sm"
            />
          </div>
        )}
        {filters.map((filter) => (
          <select
            key={filter.id}
            id={filter.id}
            value={filter.value}
            onChange={(e) => filter.onChange(e.target.value)}
            className="themed-input text-sm py-2 pl-3 pr-8 min-w-[140px]"
          >
            {filter.options.map((opt) => (
              <option key={opt.value} value={opt.value} className="bg-white dark:bg-surface-card">
                {opt.label}
              </option>
            ))}
          </select>
        ))}
      </div>
    </div>
  );
}
