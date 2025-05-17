// @ts-nocheck
'use client';

import React from 'react';
import SkeletonLoader from './SkeletonLoader';
import { TableSkeleton } from './SkeletonLoader';

/**
 * Skeleton for the list header with search, filter, and action buttons
 */
export function ListHeaderSkeleton({
  title = 'List',
  showSearch = true,
  showFilter = true,
  actionButtons = 2,
}: {
  title?: string;
  showSearch?: boolean;
  showFilter?: boolean;
  actionButtons?: number;
}) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
      <SkeletonLoader height="2rem" width="10rem" />
      <div className="flex flex-wrap gap-3 w-full sm:w-auto">
        {showSearch && (
          <SkeletonLoader height="2.5rem" width="16rem" borderRadius="0.375rem" />
        )}
        {showFilter && (
          <SkeletonLoader height="2.5rem" width="10rem" borderRadius="0.375rem" />
        )}
        <div className="flex space-x-3">
          {Array.from({ length: actionButtons }).map((_, index) => (
            <SkeletonLoader
              key={index}
              height="2.5rem"
              width="8rem"
              borderRadius="0.375rem"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for the pagination controls
 */
export function PaginationSkeleton() {
  return (
    <div className="flex justify-between items-center mt-6">
      <div className="flex items-center space-x-2">
        <SkeletonLoader height="2rem" width="6rem" borderRadius="0.375rem" />
        <SkeletonLoader height="1.5rem" width="8rem" />
      </div>
      <div className="flex space-x-2">
        <SkeletonLoader height="2.5rem" width="2.5rem" borderRadius="0.375rem" />
        <SkeletonLoader height="2.5rem" width="2.5rem" borderRadius="0.375rem" />
        <SkeletonLoader height="2.5rem" width="2.5rem" borderRadius="0.375rem" />
        <SkeletonLoader height="2.5rem" width="2.5rem" borderRadius="0.375rem" />
        <SkeletonLoader height="2.5rem" width="2.5rem" borderRadius="0.375rem" />
      </div>
    </div>
  );
}

/**
 * Skeleton for a complete list view with header, table, and pagination
 */
export function ListViewSkeleton({
  rows = 10,
  columns = 6,
  title = 'List',
  showSearch = true,
  showFilter = true,
  actionButtons = 2,
}: {
  rows?: number;
  columns?: number;
  title?: string;
  showSearch?: boolean;
  showFilter?: boolean;
  actionButtons?: number;
}) {
  return (
    <div className="container mx-auto px-4 py-8">
      <ListHeaderSkeleton
        title={title}
        showSearch={showSearch}
        showFilter={showFilter}
        actionButtons={actionButtons}
      />
      <TableSkeleton rows={rows} columns={columns} />
      <PaginationSkeleton />
    </div>
  );
}

/**
 * Skeleton specifically for the loans list view
 */
export function LoansListSkeleton() {
  return (
    <ListViewSkeleton
      rows={10}
      columns={8}
      title="Loans"
      showSearch={true}
      showFilter={true}
      actionButtons={2}
    />
  );
}

/**
 * Skeleton specifically for the chit funds list view
 */
export function ChitFundsListSkeleton() {
  return (
    <ListViewSkeleton
      rows={10}
      columns={7}
      title="Chit Funds"
      showSearch={true}
      showFilter={true}
      actionButtons={2}
    />
  );
}

/**
 * Skeleton specifically for the members list view
 */
export function MembersListSkeleton() {
  return (
    <ListViewSkeleton
      rows={10}
      columns={5}
      title="Members"
      showSearch={true}
      showFilter={false}
      actionButtons={1}
    />
  );
}
