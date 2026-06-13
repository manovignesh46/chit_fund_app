// @ts-nocheck
'use client';

import React from 'react';

interface CapitalUtilizationCardProps {
  totalOutstanding: number;
  investedAmount: number;
}

/**
 * Capital Utilization Card Component
 * Displays capital utilization ratio and rotation status
 */
export default function CapitalUtilizationCard({ 
  totalOutstanding, 
  investedAmount 
}: CapitalUtilizationCardProps) {
  // Calculate utilization ratio
  const calculateUtilization = (): number => {
    if (investedAmount === 0) return 0;
    return totalOutstanding / investedAmount;
  };

  const utilizationRatio = calculateUtilization();
  const isRotating = utilizationRatio > 1.0;

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Get status color based on utilization
  const getStatusColor = (): string => {
    if (utilizationRatio < 0.5) return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    if (utilizationRatio >= 0.5 && utilizationRatio <= 1.0) return 'text-green-600 bg-green-50 border-green-200';
    return 'text-blue-600 bg-blue-50 border-blue-200';
  };

  return (
    <div className="themed-card p-4 sm:p-6">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-700 dark:text-theme-secondary mb-4">
        Capital Utilization
      </h2>
      
      {/* Utilization Multiple */}
      <div className="flex items-center justify-center mb-4">
        <div className="text-center">
          <div className="flex items-baseline justify-center gap-2">
            <span className="text-5xl sm:text-6xl font-bold text-purple-700">
              {utilizationRatio.toFixed(2)}x
            </span>
            {isRotating && (
              <svg 
                xmlns="http://www.w3.org/2000/svg" 
                className="h-8 w-8 text-purple-600 animate-spin" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
                style={{ animationDuration: '3s' }}
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                />
              </svg>
            )}
          </div>
          
          {/* Status Badge */}
          {isRotating && (
            <div className="mt-3">
              <span className="inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  className="h-4 w-4 mr-1.5" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M13 10V3L4 14h7v7l9-11h-7z" 
                  />
                </svg>
                Capital Rotating
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      <p className="text-sm sm:text-base text-center font-medium text-gray-500 mb-4">
        Active Risk vs Invested Capital
      </p>

      {/* Breakdown Details */}
      <div className="bg-gray-50 dark:bg-surface-elevated rounded-lg p-4 space-y-3 border border-gray-200 dark:border-surface-border">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-700 dark:text-theme-secondary">Total Outstanding:</span>
          <span className="text-base font-bold text-purple-700">
            {formatCurrency(totalOutstanding)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-700 dark:text-theme-secondary">Invested Capital:</span>
          <span className="text-base font-semibold text-gray-700 dark:text-theme-secondary">
            {formatCurrency(investedAmount)}
          </span>
        </div>
        <div className="pt-2 border-t border-purple-200">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-700 dark:text-theme-secondary">Available Buffer:</span>
            <span className={`text-base font-semibold ${investedAmount - totalOutstanding >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(Math.abs(investedAmount - totalOutstanding))}
              {investedAmount - totalOutstanding < 0 && ' (Exceeded)'}
            </span>
          </div>
        </div>
      </div>

      {/* Utilization Bar */}
      <div className="mt-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-xs text-gray-500">Utilization Rate</span>
          <span className="text-xs font-semibold text-purple-600">
            {(utilizationRatio * 100).toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div 
            className="bg-blue-600 h-3 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(utilizationRatio * 100, 100)}%` }}
          ></div>
        </div>
        {utilizationRatio > 1.0 && (
          <p className="text-xs text-purple-600 mt-1 text-center font-medium">
            ⚡ Capital efficiency exceeding 100%
          </p>
        )}
      </div>

      {/* Status Indicator */}
      <div className="mt-4 text-center">
        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border ${getStatusColor()}`}>
          {utilizationRatio < 0.5 ? '📊 Low Utilization' :
           utilizationRatio <= 1.0 ? '✅ Optimal Range' :
           '🔄 Capital Multiplying'}
        </span>
      </div>
    </div>
  );
}
