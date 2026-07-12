'use client';

import React from 'react';

export type SortDirection = 'asc' | 'desc' | null;

interface SortableTableHeaderProps {
  label: string;
  sortKey: string;
  currentSortKey: string | null;
  currentSortDirection: SortDirection;
  onSort: (key: string) => void;
  className?: string;
  align?: 'left' | 'center' | 'right';
}

export default function SortableTableHeader({
  label,
  sortKey,
  currentSortKey,
  currentSortDirection,
  onSort,
  className = '',
  align = 'left',
}: SortableTableHeaderProps) {
  const isActive = currentSortKey === sortKey;
  const direction = isActive ? currentSortDirection : null;

  const textAlignClass = align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  const justifyClass = align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start';
  // A caller-supplied padding class (e.g. to match its own <td> padding) must win outright —
  // combining it with the default here would fall to Tailwind's stylesheet order, not intent.
  const hasCustomPadding = /(?:^|\s)(?:p|px|py)-\d/.test(className);
  const paddingClass = hasCustomPadding ? '' : 'px-2 sm:px-6 py-2 sm:py-3';

  return (
    <th
      scope="col"
      className={`${paddingClass} ${textAlignClass} text-xs font-medium text-gray-500 dark:text-theme-muted uppercase tracking-wider cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-hover transition-colors ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <div className={`flex items-center ${justifyClass} space-x-1`}>
        <span>{label}</span>
        <div className="flex flex-col">
          {direction === 'asc' ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          ) : direction === 'desc' ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-blue-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          )}
        </div>
      </div>
    </th>
  );
}

// Hook for managing sort state
export function useSortableData<T>(
  items: T[],
  config: { key: string | null; direction: SortDirection } = { key: null, direction: null }
) {
  const [sortConfig, setSortConfig] = React.useState(config);

  const sortedItems = React.useMemo(() => {
    if (!sortConfig.key || !sortConfig.direction) {
      return items;
    }

    const sorted = [...items].sort((a: any, b: any) => {
      // Handle nested properties (e.g., "borrower.name")
      const getNestedValue = (obj: any, path: string) => {
        return path.split('.').reduce((value, key) => value?.[key], obj);
      };

      const aValue = getNestedValue(a, sortConfig.key!);
      const bValue = getNestedValue(b, sortConfig.key!);

      // Handle null/undefined values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return 1;
      if (bValue == null) return -1;

      // Handle numbers
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Handle dates
      if (aValue instanceof Date && bValue instanceof Date) {
        return sortConfig.direction === 'asc'
          ? aValue.getTime() - bValue.getTime()
          : bValue.getTime() - aValue.getTime();
      }

      // Handle date strings
      const aDate = new Date(aValue);
      const bDate = new Date(bValue);
      if (!isNaN(aDate.getTime()) && !isNaN(bDate.getTime())) {
        return sortConfig.direction === 'asc'
          ? aDate.getTime() - bDate.getTime()
          : bDate.getTime() - aDate.getTime();
      }

      // Handle strings (case-insensitive)
      const aStr = String(aValue).toLowerCase();
      const bStr = String(bValue).toLowerCase();

      if (aStr < bStr) {
        return sortConfig.direction === 'asc' ? -1 : 1;
      }
      if (aStr > bStr) {
        return sortConfig.direction === 'asc' ? 1 : -1;
      }
      return 0;
    });

    return sorted;
  }, [items, sortConfig]);

  const requestSort = (key: string) => {
    let direction: SortDirection = 'asc';

    if (sortConfig.key === key) {
      if (sortConfig.direction === 'asc') {
        direction = 'desc';
      } else if (sortConfig.direction === 'desc') {
        direction = null;
      }
    }

    setSortConfig({ key: direction === null ? null : key, direction });
  };

  return {
    items: sortedItems,
    sortConfig,
    requestSort,
  };
}
