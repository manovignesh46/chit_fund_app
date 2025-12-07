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
export default function CollectionHealthCard() {
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
          return date.toISOString().split('T')[0];
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

  // Calculate collection rate percentage
  const calculateCollectionRate = (): number => {
    if (!data || data.totalExpectedAmount === 0) return 0;
    return (data.totalActualAmount / data.totalExpectedAmount) * 100;
  };

  const collectionRate = calculateCollectionRate();

  // Determine color based on collection rate
  const getColor = (rate: number): { stroke: string; text: string; bg: string } => {
    if (rate < 50) {
      return {
        stroke: '#EF4444', // Red
        text: 'text-red-600',
        bg: 'bg-red-50'
      };
    } else if (rate >= 50 && rate <= 80) {
      return {
        stroke: '#F59E0B', // Yellow/Amber
        text: 'text-yellow-600',
        bg: 'bg-yellow-50'
      };
    } else {
      return {
        stroke: '#10B981', // Green
        text: 'text-green-600',
        bg: 'bg-green-50'
      };
    }
  };

  const colors = getColor(collectionRate);

  // SVG Circle properties
  const size = 200;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (collectionRate / 100) * circumference;

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
      <div className="bg-white shadow-md rounded-lg p-4 sm:p-6 border-t-4 border-blue-500 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-3/4 mx-auto mb-4"></div>
        <div className="flex justify-center mb-4">
          <div className="w-48 h-48 bg-gray-200 rounded-full"></div>
        </div>
        <div className="h-4 bg-gray-200 rounded w-2/3 mx-auto mb-4"></div>
        <div className="space-y-2">
          <div className="h-3 bg-gray-200 rounded"></div>
          <div className="h-3 bg-gray-200 rounded"></div>
          <div className="h-3 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow-md rounded-lg p-4 sm:p-6 border-t-4 border-red-500">
        <h2 className="text-lg font-semibold text-gray-600 mb-2 text-center">
          Collection Health
        </h2>
        <div className="bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="bg-white shadow-md rounded-lg p-4 sm:p-6 border-t-4 border-blue-500">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-600 mb-4 text-center">
        Collection Health
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
              stroke="#E5E7EB"
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
              {collectionRate.toFixed(1)}%
            </span>
            <span className="text-xs text-gray-500 mt-1">collected</span>
          </div>
        </div>
      </div>

      {/* Label */}
      <p className="text-sm sm:text-base font-medium text-gray-700 text-center mb-4">
        Monthly Recovery Status
      </p>

      {/* Collection Details */}
      <div className={`${colors.bg} rounded-lg p-3 space-y-2`}>
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">Expected:</span>
          <span className="font-semibold text-gray-800">
            {formatCurrency(data.totalExpectedAmount)}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">Collected:</span>
          <span className={`font-semibold ${colors.text}`}>
            {formatCurrency(data.totalActualAmount)}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm pt-2 border-t border-gray-200">
          <span className="text-gray-600">Pending:</span>
          <span className="font-semibold text-gray-800">
            {formatCurrency(data.totalExpectedAmount - data.totalActualAmount)}
          </span>
        </div>
      </div>

      {/* Status indicator */}
      <div className="mt-4 text-center">
        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${colors.bg} ${colors.text}`}>
          {collectionRate < 50 ? '⚠️ Needs Attention' :
           collectionRate <= 80 ? '⚡ Fair Progress' :
           '✅ Excellent Performance'}
        </span>
      </div>
    </div>
  );
}
