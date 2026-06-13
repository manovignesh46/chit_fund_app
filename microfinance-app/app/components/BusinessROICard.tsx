// @ts-nocheck
'use client';

import React from 'react';

interface BusinessROICardProps {
  totalProfit: number;
  investedAmount: number;
}

/**
 * Business ROI Card Component
 * Displays Return on Investment (ROI) percentage with visual indicators
 */
export default function BusinessROICard({ totalProfit, investedAmount }: BusinessROICardProps) {
  // Calculate ROI percentage
  const calculateROI = (): string => {
    if (investedAmount === 0) return '0.0';
    const roi = (totalProfit / investedAmount) * 100;
    return roi.toFixed(1);
  };

  const roiPercentage = calculateROI();

  // Format currency for tooltip
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="themed-card p-4 sm:p-6 border-t-4 border-green-500">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-700 dark:text-theme-secondary mb-2">
        Business ROI
      </h2>
      
      {/* ROI Percentage with trending up icon */}
      <div className="flex items-center gap-2 mb-2">
        <p className="text-3xl sm:text-4xl font-bold text-green-600">
          {roiPercentage}%
        </p>
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-6 w-6 sm:h-8 sm:w-8 text-green-600" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" 
          />
        </svg>
      </div>

      {/* Subtitle */}
      <p className="text-sm sm:text-base font-medium text-gray-500 mb-3">
        Return on Capital
      </p>

      {/* Tooltip/Caption */}
      <div className="bg-green-50 rounded-lg p-3 border border-green-100">
        <p className="text-xs sm:text-sm text-gray-700 dark:text-theme-secondary">
          💡 Net profit earned per ₹100 invested
        </p>
        <div className="mt-2 text-xs text-gray-500">
          <p>Profit: {formatCurrency(totalProfit)}</p>
          <p>Invested: {formatCurrency(investedAmount)}</p>
        </div>
      </div>
    </div>
  );
}
