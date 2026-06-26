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
          <div className="bg-gray-300 dark:bg-surface-hover rounded-full w-12 h-12 flex items-center justify-center mb-4">
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
          <div key={index} className="border-l-4 pl-4 border-gray-200 dark:border-surface-border">
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
 * Skeleton for the Trends tab content (bar charts + metric pairs)
 */
export function TrendsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Monthly Inflow Trend — stacked bar rows */}
      <div className="dark-card p-4 sm:p-6 animate-pulse">
        <div className="flex items-start justify-between mb-1">
          <SkeletonLoader height="1.125rem" width="10rem" />
          <SkeletonLoader height="0.75rem" width="5rem" />
        </div>
        <SkeletonLoader height="0.75rem" width="14rem" className="mb-5" />
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <SkeletonLoader height="0.75rem" width="3.5rem" />
              <div className="flex-1">
                <SkeletonLoader height="1.25rem" width={`${40 + (i % 3) * 20}%`} />
              </div>
              <SkeletonLoader height="0.75rem" width="3rem" />
            </div>
          ))}
        </div>
      </div>

      {/* Collection Health + Business ROI */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
        {/* Collection Health — circular gauge */}
        <div className="dark-card p-4 sm:p-6 animate-pulse flex flex-col items-center">
          <SkeletonLoader height="1.25rem" width="9rem" className="mb-4 mx-auto" />
          <SkeletonLoader height="12rem" width="12rem" borderRadius="9999px" className="mb-4" />
          <SkeletonLoader height="0.875rem" width="10rem" className="mb-3" />
          <div className="w-full space-y-2">
            <SkeletonLoader height="0.875rem" width="100%" />
            <SkeletonLoader height="0.875rem" width="100%" />
            <SkeletonLoader height="0.875rem" width="100%" />
          </div>
        </div>
        {/* Business ROI */}
        <div className="dark-card p-4 sm:p-6 animate-pulse">
          <SkeletonLoader height="1.125rem" width="8rem" className="mb-4" />
          <SkeletonLoader height="3rem" width="60%" className="mb-2" />
          <SkeletonLoader height="0.875rem" width="80%" className="mb-5" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <SkeletonLoader height="0.875rem" width="45%" />
                <SkeletonLoader height="0.875rem" width="30%" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Loan Portfolio + Returns Overview */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="dark-card p-4 sm:p-6 animate-pulse">
            <SkeletonLoader height="1.125rem" width="9rem" className="mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex justify-between">
                  <SkeletonLoader height="0.875rem" width="40%" />
                  <SkeletonLoader height="0.875rem" width="35%" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Chit Fund Commission + Capital Utilization */}
      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
        {/* Chit fund bar chart */}
        <div className="dark-card p-4 sm:p-6 animate-pulse">
          <SkeletonLoader height="1.125rem" width="10rem" className="mb-1" />
          <SkeletonLoader height="0.75rem" width="14rem" className="mb-5" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <SkeletonLoader height="0.75rem" width="3.5rem" />
                <div className="flex-1">
                  <SkeletonLoader height="1.25rem" width={`${25 + (i % 4) * 15}%`} />
                </div>
                <SkeletonLoader height="0.75rem" width="3rem" />
              </div>
            ))}
          </div>
        </div>
        {/* Capital Utilization */}
        <div className="dark-card p-4 sm:p-6 animate-pulse">
          <SkeletonLoader height="1.125rem" width="9rem" className="mb-4" />
          <SkeletonLoader height="3rem" width="55%" className="mb-2" />
          <SkeletonLoader height="0.875rem" width="75%" className="mb-5" />
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex justify-between">
                <SkeletonLoader height="0.875rem" width="45%" />
                <SkeletonLoader height="0.875rem" width="30%" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Complete dashboard skeleton — matches the tab layout shown on initial load
 */
export function DashboardSkeleton() {
  return (
    <div>
      {/* Tab navigation bar */}
      <div className="border-b border-gray-200 dark:border-surface-border mb-4 sm:mb-6">
        <nav className="flex gap-0 -mb-px overflow-x-auto" aria-label="Dashboard tabs">
          {['Overview', 'Trends', 'Monthly Collections', 'Recent Activities', 'Upcoming Events'].map((label, i) => (
            <div
              key={label}
              className={`flex-shrink-0 px-4 sm:px-6 py-3 border-b-2 whitespace-nowrap ${
                i === 0
                  ? 'border-green-600 dark:border-green-400'
                  : 'border-transparent'
              }`}
            >
              <SkeletonLoader height="0.875rem" width={`${label.length * 0.55}rem`} />
            </div>
          ))}
        </nav>
      </div>

      {/* Overview tab content */}
      <div className="space-y-6">
        {/* Cash Flow Summary + Partner Balance */}
        <div className="grid grid-cols-1 gap-4 sm:gap-6 md:grid-cols-2">
          <div className="dark-card p-4 sm:p-6 animate-pulse">
            <SkeletonLoader height="1.125rem" width="9rem" className="mb-4" />
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-surface-elevated">
                  <div className="flex items-center gap-3">
                    <SkeletonLoader height="2.25rem" width="2.25rem" borderRadius="0.5rem" />
                    <div>
                      <SkeletonLoader height="0.875rem" width="7rem" className="mb-1" />
                      <SkeletonLoader height="0.75rem" width="10rem" />
                    </div>
                  </div>
                  <SkeletonLoader height="1.125rem" width="5rem" />
                </div>
              ))}
            </div>
          </div>
          <div className="dark-card p-4 sm:p-6 animate-pulse">
            <SkeletonLoader height="1.125rem" width="10rem" className="mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-gray-50 dark:bg-surface-elevated">
                  <div className="flex items-center gap-3">
                    <SkeletonLoader height="2.25rem" width="2.25rem" borderRadius="0.5rem" />
                    <div>
                      <SkeletonLoader height="0.875rem" width="5rem" className="mb-1" />
                      <SkeletonLoader height="0.75rem" width="6rem" />
                    </div>
                  </div>
                  <SkeletonLoader height="1rem" width="4rem" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Outstanding + Profit metric cards */}
        <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="dark-card p-4 sm:p-6">
              <SkeletonLoader height="0.875rem" width="70%" className="mb-2" />
              <SkeletonLoader height="1.75rem" width="80%" className="mb-1" />
              <SkeletonLoader height="0.75rem" width="60%" />
            </div>
          ))}
        </div>

        {/* Stats: Active Loans, Active Chit Funds, Total Members */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="dark-card p-4 sm:p-6">
              <SkeletonLoader height="2rem" width="3rem" className="mb-2" />
              <SkeletonLoader height="0.875rem" width="65%" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
