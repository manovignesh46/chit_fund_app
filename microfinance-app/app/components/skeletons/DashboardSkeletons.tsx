// @ts-nocheck
'use client';

import React from 'react';
import SkeletonLoader from './SkeletonLoader';
import { CardSkeleton, TableSkeleton, GraphSkeleton } from './SkeletonLoader';

/**
 * Skeleton for the financial overview cards in the dashboard
 */
export function FinancialOverviewSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8 md:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="dark-card shadow-md rounded-lg p-4 sm:p-6 border-t-4 border-gray-200 dark:border-surface-border">
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
    <div className="grid grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
      {Array.from({ length: 2 }).map((_, index) => (
        <div key={index} className="dark-card shadow-md rounded-lg p-4 sm:p-6 border-t-4 border-gray-200 dark:border-surface-border">
          <SkeletonLoader height="1.25rem" width="60%" className="mb-2" />
          <SkeletonLoader height="2rem" width="80%" className="mb-2" />
          <SkeletonLoader height="0.875rem" width="90%" />
        </div>
      ))}
    </div>
  );
}

/**
 * Skeleton for the Balance Summary and Partner Balances cards
 */
export function BalanceCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-6 mb-6 sm:mb-8 md:grid-cols-2">
      {/* Balance Summary Skeleton */}
      <div className="dark-card shadow-md rounded-lg p-4 sm:p-6">
        <SkeletonLoader height="1.5rem" width="10rem" className="mb-4" />
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'rgba(28, 34, 48, 0.6)' }}>
              <div className="flex items-center">
                <SkeletonLoader height="2.5rem" width="2.5rem" borderRadius="9999px" className="mr-3" />
                <div>
                  <SkeletonLoader height="0.875rem" width="6rem" className="mb-1" />
                  <SkeletonLoader height="0.75rem" width="8rem" />
                </div>
              </div>
              <SkeletonLoader height="1.125rem" width="5rem" />
            </div>
          ))}
        </div>
      </div>

      {/* Partner Balances Skeleton */}
      <div className="dark-card shadow-md rounded-lg p-4 sm:p-6">
        <SkeletonLoader height="1.5rem" width="10rem" className="mb-4" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'rgba(28, 34, 48, 0.6)' }}>
              <div className="flex items-center">
                <SkeletonLoader height="2.5rem" width="2.5rem" borderRadius="9999px" className="mr-3" />
                <div>
                  <SkeletonLoader height="0.875rem" width="5rem" className="mb-1" />
                  <SkeletonLoader height="0.75rem" width="6rem" />
                </div>
              </div>
              <div className="text-right">
                <SkeletonLoader height="1rem" width="4rem" className="mb-1" />
                <SkeletonLoader height="0.75rem" width="2rem" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Skeleton for the financial graph section in the dashboard
 */
export function FinancialGraphSkeleton() {
  return (
    <div className="mb-8">
      <div className="dark-card rounded-lg shadow-md p-4 mb-4">
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
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="dark-card rounded-lg shadow-md p-4 sm:p-6 flex flex-col items-center">
          <div className="bg-gray-300 text-white rounded-full w-12 h-12 flex items-center justify-center mb-4">
            <SkeletonLoader height="1.5rem" width="1.5rem" borderRadius="9999px" />
          </div>
          <SkeletonLoader height="0.875rem" width="60%" />
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
    <div className="dark-card rounded-lg shadow-md p-2 sm:p-6">
      <SkeletonLoader height="1.5rem" width="12rem" className="mb-2 sm:mb-4" />
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
    </div>
  );
}

/**
 * Skeleton for Current Month Collections cards
 */
export function CurrentMonthCollectionsSkeleton() {
  return (
    <div className="mb-6 sm:mb-8">
      <div className="flex items-center justify-between mb-4">
        <SkeletonLoader height="1.5rem" width="12rem" />
        <SkeletonLoader height="1rem" width="8rem" />
      </div>
      
      <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="dark-card p-4 sm:p-6 rounded-lg shadow-md border-t-4 border-gray-200 dark:border-surface-border">
            <div className="flex items-center justify-between mb-3">
              <SkeletonLoader height="0.875rem" width="7rem" />
              <SkeletonLoader height="2rem" width="2rem" borderRadius="9999px" />
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <SkeletonLoader height="0.75rem" width="4rem" />
                <SkeletonLoader height="0.875rem" width="5rem" />
              </div>
              <div className="flex justify-between items-center">
                <SkeletonLoader height="0.75rem" width="4.5rem" />
                <SkeletonLoader height="1rem" width="6rem" />
              </div>
              <div className="pt-2">
                <div className="flex justify-between items-center mb-1">
                  <SkeletonLoader height="0.75rem" width="4rem" />
                  <SkeletonLoader height="0.75rem" width="2rem" />
                </div>
                <SkeletonLoader height="0.5rem" width="100%" borderRadius="9999px" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton for the upcoming events section in the dashboard
 */
export function UpcomingEventsSkeleton() {
  return (
    <div className="dark-card rounded-lg shadow-md p-2 sm:p-6">
      <SkeletonLoader height="1.5rem" width="12rem" className="mb-2 sm:mb-4" />
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="border-l-4 pl-4" style={{ borderColor: '#e5e7eb' }}>
            <SkeletonLoader height="1.25rem" width="80%" className="mb-1" />
            <SkeletonLoader height="0.875rem" width="40%" className="mb-1" />
            <SkeletonLoader height="1.25rem" width="5rem" borderRadius="9999px" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Skeleton for the Business Metrics Cards (ROI, Collection Health, Capital Utilization)
 */
export function BusinessMetricCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:gap-6 mb-6 sm:mb-8 md:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, index) => (
        <div key={index} className="dark-card shadow-md rounded-lg p-4 sm:p-6 border-t-4 border-gray-200 dark:border-surface-border">
          <SkeletonLoader height="1.25rem" width="60%" className="mb-4 mx-auto" />
          {/* Large metric display */}
          <div className="flex justify-center mb-4">
            <SkeletonLoader height="3rem" width="8rem" />
          </div>
          <SkeletonLoader height="1rem" width="70%" className="mb-4 mx-auto" />
          {/* Details section */}
          <div className="space-y-2">
            <SkeletonLoader height="0.875rem" width="100%" />
            <SkeletonLoader height="0.875rem" width="100%" />
            <SkeletonLoader height="0.875rem" width="100%" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Complete dashboard skeleton that combines all the section skeletons
 */
export function DashboardSkeleton() {
  return (
    <div className="page-container">
      {/* Header with action buttons */}
      <div className="flex flex-row flex-wrap items-center justify-between gap-2 mb-6 sm:mb-8">
        <SkeletonLoader height="2rem" width="10rem" />
        <div className="flex flex-row flex-wrap gap-1 sm:gap-2">
          <SkeletonLoader height="2.5rem" width="8rem" borderRadius="0.5rem" />
          <SkeletonLoader height="2.5rem" width="8rem" borderRadius="0.5rem" />
          <SkeletonLoader height="2.5rem" width="8rem" borderRadius="0.5rem" />
        </div>
      </div>

      {/* Balance Summary and Partner Balances - Moved to Top */}
      <BalanceCardsSkeleton />

      {/* Financial Overview (Outstanding amounts + Total Profit) */}
      <div className="grid grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="dark-card shadow-md rounded-lg p-4 sm:p-6 border-t-4 border-gray-200 dark:border-surface-border">
            <SkeletonLoader height="1.25rem" width="60%" className="mb-2" />
            <SkeletonLoader height="2rem" width="80%" />
          </div>
        ))}
      </div>

      {/* Business Metrics Cards (ROI, Collection Health, Capital Utilization) */}
      <BusinessMetricCardsSkeleton />

      {/* Current Month Collections */}
      <CurrentMonthCollectionsSkeleton />

      {/* Stats Overview */}
      <StatsOverviewSkeleton />

      {/* Recent Activities and Upcoming Events */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
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
