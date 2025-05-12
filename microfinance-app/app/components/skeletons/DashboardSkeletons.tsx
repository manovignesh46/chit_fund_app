'use client';

import React from 'react';
import SkeletonLoader from './SkeletonLoader';
import { CardSkeleton, TableSkeleton, GraphSkeleton } from './SkeletonLoader';

/**
 * Skeleton for the financial overview cards in the dashboard
 */
export function FinancialOverviewSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="bg-white shadow-md rounded-lg p-6 border-t-4 border-gray-300">
          <SkeletonLoader height="1.25rem" width="60%" className="mb-2" />
          <SkeletonLoader height="2rem" width="80%" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for the profit breakdown section in the dashboard
 */
export function ProfitBreakdownSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="bg-white shadow-md rounded-lg p-6 border-t-4 border-gray-300">
          <SkeletonLoader height="1.25rem" width="60%" className="mb-2" />
          <SkeletonLoader height="2rem" width="80%" className="mb-2" />
          <SkeletonLoader height="0.875rem" width="90%" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for the financial graph section in the dashboard
 */
export function FinancialGraphSkeleton() {
  return (
    <div className="mb-8">
      <div className="bg-white rounded-lg shadow-md p-4 mb-4">
        <div className="flex flex-wrap justify-between items-center">
          <SkeletonLoader height="1.5rem" width="12rem" />
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex space-x-2">
              <SkeletonLoader height="2rem" width="5rem" borderRadius="0.375rem" />
              <SkeletonLoader height="2rem" width="5rem" borderRadius="0.375rem" />
              <SkeletonLoader height="2rem" width="5rem" borderRadius="0.375rem" />
            </div>
            <SkeletonLoader height="2rem" width="6rem" borderRadius="0.375rem" />
          </div>
        </div>
      </div>
      <GraphSkeleton height="20rem" />
    </div>
  );
}

/**
 * Skeleton for the stats overview section in the dashboard
 */
export function StatsOverviewSkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="bg-white rounded-lg shadow-md p-6">
          <div className="bg-gray-300 text-white rounded-full w-12 h-12 flex items-center justify-center mb-4">
            <SkeletonLoader height="1.5rem" width="1.5rem" borderRadius="9999px" />
          </div>
          <SkeletonLoader height="0.875rem" width="60%" className="mb-1" />
          <SkeletonLoader height="1.5rem" width="40%" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for the recent activities section in the dashboard
 */
export function RecentActivitiesSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <SkeletonLoader height="1.5rem" width="12rem" className="mb-4" />
      <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="border-b pb-4 last:border-b-0 last:pb-0">
            <div className="flex justify-between mb-2">
              <SkeletonLoader height="1.25rem" width="6rem" borderRadius="9999px" />
              <SkeletonLoader height="0.875rem" width="5rem" />
            </div>
            <SkeletonLoader height="1.25rem" width="70%" className="mb-1" />
            <SkeletonLoader height="0.875rem" width="90%" />
          </div>
        ))}
      </div>
      <div className="mt-4 text-center">
        <SkeletonLoader height="1.5rem" width="8rem" className="mx-auto" />
      </div>
    </div>
  );
}

/**
 * Skeleton for the upcoming events section in the dashboard
 */
export function UpcomingEventsSkeleton() {
  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <SkeletonLoader height="1.5rem" width="12rem" className="mb-4" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="border-l-4 pl-4" style={{ borderColor: '#e5e7eb' }}>
            <SkeletonLoader height="1.25rem" width="80%" className="mb-1" />
            <SkeletonLoader height="0.875rem" width="40%" className="mb-1" />
            <SkeletonLoader height="1.25rem" width="5rem" borderRadius="9999px" />
          </div>
        ))}
      </div>
      <div className="mt-4 text-center">
        <SkeletonLoader height="1.5rem" width="8rem" className="mx-auto" />
      </div>
    </div>
  );
}

/**
 * Complete dashboard skeleton that combines all the section skeletons
 */
export function DashboardSkeleton() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <SkeletonLoader height="2rem" width="10rem" />
        <div className="flex space-x-4">
          <SkeletonLoader height="2.5rem" width="8rem" borderRadius="0.5rem" />
          <SkeletonLoader height="2.5rem" width="8rem" borderRadius="0.5rem" />
          <SkeletonLoader height="2.5rem" width="8rem" borderRadius="0.5rem" />
        </div>
      </div>

      <FinancialOverviewSkeleton />
      <ProfitBreakdownSkeleton />
      <FinancialGraphSkeleton />
      <StatsOverviewSkeleton />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <RecentActivitiesSkeleton />
        </div>
        <div>
          <UpcomingEventsSkeleton />
        </div>
      </div>
    </div>
  );
}
