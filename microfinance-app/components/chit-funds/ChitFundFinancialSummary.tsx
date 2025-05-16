'use client';

import React, { useState } from 'react';
import { ChitFund, Contribution, Auction } from '@/lib/interfaces';
import { formatCurrency, calculateChitFundProfit, calculateChitFundOutsideAmount } from '@/lib/formatUtils';

interface ChitFundFinancialSummaryProps {
  chitFund: ChitFund;
  contributions: Contribution[];
  auctions: Auction[];
  showProfitByDefault?: boolean;
}

/**
 * A reusable component for displaying chit fund financial summary
 */
export default function ChitFundFinancialSummary({
  chitFund,
  contributions,
  auctions,
  showProfitByDefault = false,
}: ChitFundFinancialSummaryProps) {
  const [showProfit, setShowProfit] = useState(showProfitByDefault);

  // Calculate financial metrics
  const totalInflow = contributions.reduce((sum, contribution) => sum + contribution.amount, 0);
  const totalOutflow = auctions.reduce((sum, auction) => sum + auction.amount, 0);

  // Ensure chitFund has the required properties for the profit calculation functions
  const chitFundForCalculation = {
    monthlyContribution: chitFund.monthlyContribution,
    membersCount: chitFund.membersCount,
    members: chitFund.members || []
  };

  const profit = calculateChitFundProfit(chitFundForCalculation, contributions, auctions);
  const outsideAmount = calculateChitFundOutsideAmount(chitFundForCalculation, contributions, auctions);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 border-b">
        <h2 className="text-xl font-semibold">Financial Summary</h2>
      </div>
      <div className="p-6">
        <div className="grid grid-cols-2 gap-6 mb-4">
          <div>
            <p className="text-sm text-gray-500">Total Cash Inflow</p>
            <p className="text-lg font-semibold text-blue-700">{formatCurrency(totalInflow)}</p>
            <p className="text-xs text-gray-500">From {contributions.length} contributions</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Cash Outflow</p>
            <p className="text-lg font-semibold text-red-700">{formatCurrency(totalOutflow)}</p>
            <p className="text-xs text-gray-500">From {auctions.length} auctions</p>
          </div>
          <div>
            <div className="flex items-center">
              <p className="text-sm text-gray-500 mr-1">Profit</p>
              <button
                onClick={() => setShowProfit(!showProfit)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
            </div>
            {showProfit ? (
              <p className="text-lg font-semibold text-green-700">{formatCurrency(profit)}</p>
            ) : (
              <p className="text-lg font-semibold text-gray-400">***</p>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-500">Outside Amount</p>
            <p className="text-lg font-semibold text-purple-700">{formatCurrency(outsideAmount)}</p>
            <p className="text-xs text-gray-500">
              {outsideAmount > 0
                ? 'Cash outflow exceeds inflow'
                : 'No outside amount'}
            </p>
          </div>
        </div>

        <div className="mt-4 p-4 bg-gray-50 rounded-md">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Explanation</h3>
          <ul className="text-xs text-gray-600 space-y-1">
            <li><strong>Cash Inflow:</strong> Total money received from member contributions</li>
            <li><strong>Cash Outflow:</strong> Total money paid out in auctions</li>
            <li><strong>Profit:</strong> Difference between monthly total (contribution × members) and auction amount</li>
            <li><strong>Outside Amount:</strong> When cash outflow exceeds inflow (additional money needed)</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
