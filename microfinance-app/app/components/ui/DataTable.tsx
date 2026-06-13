'use client';

import React from 'react';

interface DataTableProps {
  children: React.ReactNode;
  minWidth?: number | string;
  className?: string;
}

/** Scrollable themed table wrapper — use on all data tables */
export function DataTable({ children, minWidth, className = '' }: DataTableProps) {
  const style = minWidth
    ? { minWidth: typeof minWidth === 'number' ? `${minWidth}px` : minWidth }
    : undefined;

  return (
    <div className="table-shell">
      <table className={`themed-table ${className}`.trim()} style={style}>
        {children}
      </table>
    </div>
  );
}

interface TableCardProps {
  children: React.ReactNode;
  className?: string;
}

/** Card container for a full table section (header + table + footer) */
export function TableCard({ children, className = '' }: TableCardProps) {
  return (
    <div className={`table-card ${className}`.trim()}>
      {children}
    </div>
  );
}

interface TableToolbarProps {
  children: React.ReactNode;
  className?: string;
}

export function TableToolbar({ children, className = '' }: TableToolbarProps) {
  return (
    <div className={`table-toolbar ${className}`.trim()}>
      {children}
    </div>
  );
}

interface TableFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function TableFooter({ children, className = '' }: TableFooterProps) {
  return (
    <div className={`table-footer ${className}`.trim()}>
      {children}
    </div>
  );
}

/** Standard th cell — use for non-sortable headers */
export function TableHeadCell({
  children,
  className = '',
  align = 'left',
}: {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
}) {
  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <th scope="col" className={`table-th ${alignClass} ${className}`.trim()}>
      {children}
    </th>
  );
}

/** Standard td cell */
export function TableCell({
  children,
  className = '',
  align = 'left',
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'right' | 'center';
  colSpan?: number;
}) {
  const alignClass =
    align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left';
  return (
    <td colSpan={colSpan} className={`table-td ${alignClass} ${className}`.trim()}>
      {children}
    </td>
  );
}

export default DataTable;
