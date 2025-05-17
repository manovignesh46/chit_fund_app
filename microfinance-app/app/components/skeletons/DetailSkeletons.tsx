// @ts-nocheck
'use client';

import React from 'react';
import SkeletonLoader from './SkeletonLoader';
import { CardSkeleton, TableSkeleton } from './SkeletonLoader';

/**
 * Skeleton for the detail view header with title and action buttons
 */
export function DetailHeaderSkeleton({
  actionButtons = 3,
}: {
  actionButtons?: number;
}) {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
      <div>
        <SkeletonLoader height="2rem" width="16rem" className="mb-2" />
        <SkeletonLoader height="1rem" width="12rem" />
      </div>
      <div className="flex flex-wrap gap-3">
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
  );
}

/**
 * Skeleton for a detail info card with key-value pairs
 */
export function DetailInfoCardSkeleton({
  title = 'Details',
  rows = 4,
}: {
  title?: string;
  rows?: number;
}) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 border-b">
        <SkeletonLoader height="1.5rem" width="10rem" />
      </div>
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: rows }).map((_, index) => (
            <div key={index}>
              <SkeletonLoader height="0.875rem" width="8rem" className="mb-1" />
              <SkeletonLoader height="1.25rem" width="10rem" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for a detail section with a table
 */
export function DetailTableSectionSkeleton({
  title = 'Table',
  rows = 5,
  columns = 5,
}: {
  title?: string;
  rows?: number;
  columns?: number;
}) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 border-b flex justify-between items-center">
        <SkeletonLoader height="1.5rem" width="10rem" />
        <div className="flex space-x-3">
          <SkeletonLoader height="2.25rem" width="6rem" borderRadius="0.375rem" />
          <SkeletonLoader height="2.25rem" width="6rem" borderRadius="0.375rem" />
        </div>
      </div>
      <div className="overflow-x-auto">
        <TableSkeleton rows={rows} columns={columns} showHeader={true} className="rounded-none shadow-none" />
      </div>
    </div>
  );
}

/**
 * Skeleton for a loan detail view
 */
export function LoanDetailSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      <DetailHeaderSkeleton actionButtons={3} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <DetailInfoCardSkeleton title="Loan Details" rows={6} />
        </div>
        <div>
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6 border-b">
              <SkeletonLoader height="1.5rem" width="10rem" />
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <SkeletonLoader height="0.875rem" width="8rem" className="mb-1" />
                  <SkeletonLoader height="1.5rem" width="100%" />
                </div>
                <div>
                  <SkeletonLoader height="0.875rem" width="8rem" className="mb-1" />
                  <SkeletonLoader height="1.5rem" width="100%" />
                </div>
                <div className="pt-4 border-t">
                  <SkeletonLoader height="0.875rem" width="8rem" className="mb-1" />
                  <SkeletonLoader height="1.5rem" width="100%" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <DetailTableSectionSkeleton title="Payment History" rows={5} columns={6} />

      <div className="mt-8">
        <DetailTableSectionSkeleton title="Payment Schedule" rows={5} columns={5} />
      </div>
    </div>
  );
}

/**
 * Skeleton for a chit fund detail view
 */
export function ChitFundDetailSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      <DetailHeaderSkeleton actionButtons={3} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <DetailInfoCardSkeleton title="Chit Fund Details" rows={6} />
        </div>
        <div>
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6 border-b">
              <SkeletonLoader height="1.5rem" width="12rem" />
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 gap-6 mb-4">
                <div>
                  <SkeletonLoader height="0.875rem" width="8rem" className="mb-1" />
                  <SkeletonLoader height="1.25rem" width="100%" />
                  <SkeletonLoader height="0.75rem" width="80%" className="mt-1" />
                </div>
                <div>
                  <SkeletonLoader height="0.875rem" width="8rem" className="mb-1" />
                  <SkeletonLoader height="1.25rem" width="100%" />
                  <SkeletonLoader height="0.75rem" width="80%" className="mt-1" />
                </div>
                <div>
                  <SkeletonLoader height="0.875rem" width="8rem" className="mb-1" />
                  <SkeletonLoader height="1.25rem" width="100%" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <DetailTableSectionSkeleton title="Members" rows={4} columns={4} />
        <DetailTableSectionSkeleton title="Auctions" rows={4} columns={4} />
      </div>

      <DetailTableSectionSkeleton title="Contributions" rows={5} columns={5} />
    </div>
  );
}
