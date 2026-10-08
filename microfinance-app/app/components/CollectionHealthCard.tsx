// @ts-nocheck
'use client';

import React, { useEffect, useState } from 'react';

interface AggregationData {
  expectedLoanRepayment: number;
  actualLoanRepayment: number;
  expectedChitContribution: number;
  actualChitContribution: number;
  totalExpectedAmount: number;
  totalActualAmount: number;
}

/**
 * Collection Health Card Component
 * Displays collection rate with a circular progress bar
 * Fetches current month's collection data automatically
 */
export default function CollectionHealthCard({ business }: { business: 'loan' | 'chit' }) {
  const title = business === 'loan' ? 'Loan Collections' : 'Chit Fund Collections';
  const [data, setData] = useState<AggregationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchCurrentMonthCollections = async () => {
      setLoading(true);
      setError(null);

      try {
        // Get current month's start and end dates
        const currentDate = new Date();
        const startDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

        // Format dates as YYYY-MM-DD
        const formatDate = (date: Date) => {
          return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        };

        const response = await fetch(
          `/api/transactions/aggregations?startDate=${formatDate(startDate)}&endDate=${formatDate(endDate)}`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch collection data');
        }

        const aggregations = await response.json();
        setData(aggregations);
      } catch (err: any) {
        console.error('Error fetching collection data:', err);
        setError(err.message || 'Failed to load collection data');
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentMonthCollections();
  }, []);

  const expected = business === 'loan' ? data?.expectedLoanRepayment ?? 0 : data?.expectedChitContribution ?? 0;
  const collected = business === 'loan' ? data?.actualLoanRepayment ?? 0 : data?.actualChitContribution ?? 0;

  // Calculate collection rate percentage
  const calculateCollectionRate = (): number => {
    if (!data || expected === 0) return 0;
    return (collected / expected) * 100;
  };

  const collectionRate = calculateCollectionRate();

  // Determine color based on collection rate
  const getColor = (rate: number): { stroke: string; text: string; bg: string } => {
    if (rate < 50) {
      return {
        stroke: 'var(--color-danger)',
        text: 'text-danger',
        bg: 'bg-danger-light'
      };
    } else if (rate >= 50 && rate <= 80) {
      return {
        stroke: 'var(--color-warning)',
        text: 'text-warning',
        bg: 'bg-warning-light'
      };
    } else {
      return {
        stroke: 'var(--color-success)',
        text: 'text-success',
        bg: 'bg-success-light'
      };
    }
  };

  const colors = getColor(collectionRate);

  // SVG Circle properties
  const size = 200;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(Math.max(collectionRate, 0), 100) / 100) * circumference;

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="themed-card p-4 sm:p-6 animate-pulse">
        <div className="h-6 bg-gray-200 dark:bg-surface-elevated rounded w-3/4 mx-auto mb-4"></div>
        <div className="flex justify-center mb-4">
          <div className="w-48 h-48 bg-gray-200 dark:bg-surface-elevated rounded-full"></div>
        </div>
        <div className="h-4 bg-gray-200 dark:bg-surface-elevated rounded w-2/3 mx-auto mb-4"></div>
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 dark:bg-surface-elevated rounded"></div>
          <div className="h-3 bg-gray-200 dark:bg-surface-elevated rounded"></div>
          <div className="h-3 bg-gray-200 dark:bg-surface-elevated rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="themed-card p-4 sm:p-6">
        <h2 className="text-lg font-semibold text-gray-700 dark:text-theme-secondary mb-2 text-center">
          {title}
        </h2>
        <div className="alert-error rounded-lg p-3">
          <p className="text-sm text-danger">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="themed-card p-4 sm:p-6">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-700 dark:text-theme-secondary mb-4 text-center">
        {title}
      </h2>

      {/* Circular Progress Bar */}
      <div className="flex flex-col items-center justify-center mb-4">
        <div className="relative inline-flex items-center justify-center">
          <svg
            width={size}
            height={size}
            className="transform -rotate-90"
          >
            {/* Background circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke="var(--color-surface-border)"
              strokeWidth={strokeWidth}
              fill="none"
            />
            {/* Progress circle */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={colors.stroke}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-1000 ease-out"
            />
          </svg>

          {/* Center text - percentage */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-4xl sm:text-5xl font-bold ${colors.text}`}>
              {expected > 0 ? `${collectionRate.toFixed(1)}%` : '—'}
            </span>
            <span className="text-xs text-theme-secondary mt-1">collected</span>
          </div>
        </div>
      </div>

      {/* Label */}
      <p className="text-sm sm:text-base font-medium text-gray-700 dark:text-theme-secondary text-center mb-4">
        Current month collection status
      </p>

      {/* Collection Details */}
      <div className={`${colors.bg} rounded-lg p-3 space-y-2`}>
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-700 dark:text-theme-secondary">Expected:</span>
          <span className="font-semibold text-gray-900 dark:text-theme-primary">
            {formatCurrency(expected)}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-700 dark:text-theme-secondary">Collected:</span>
          <span className={`font-semibold ${colors.text}`}>
            {formatCurrency(collected)}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-200 dark:border-surface-border">
          <span className="text-gray-700 dark:text-theme-secondary">Pending:</span>
          <span className="font-semibold text-gray-900 dark:text-theme-primary">
            {formatCurrency(Math.max(0, expected - collected))}
          </span>
        </div>
      </div>

      {/* Status indicator */}
      <div className="mt-4 text-center">
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
          {expected === 0 ? 'No collections scheduled' : collectionRate < 50 ? '⚠️ Needs Attention' :
           collectionRate <= 80 ? '⚡ Fair Progress' :
           '✅ Excellent Performance'}
        </span>
      </div>
    </div>
  );
}
