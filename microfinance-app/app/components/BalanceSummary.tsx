'use client';

import { useState, useEffect } from 'react';
import { balanceAPI } from '../../lib/api';
import { formatCurrency } from '../../lib/formatUtils';

interface BalanceSummaryProps {
  refreshTrigger?: boolean;
}

interface PartnerBalance {
  partnerId: number;
  partnerName: string;
  balance: number;
}

interface BalanceSummary {
  totalBalance: number;
  partnerBalances: PartnerBalance[];
}

export default function BalanceSummary({ refreshTrigger }: BalanceSummaryProps) {
  const [balanceSummary, setBalanceSummary] = useState(null as BalanceSummary | null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchBalanceSummary = async () => {
    try {
      setLoading(true);
      setError('');
      const summary = await balanceAPI.getSummary();
      setBalanceSummary(summary);
    } catch (err: any) {
      console.error('Error fetching balance summary:', err);
      setError('Failed to load balance summary');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBalanceSummary();
  }, [refreshTrigger]);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Balance Summary</h3>
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
          <div className="h-6 bg-gray-200 rounded w-1/2 mb-4"></div>
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Balance Summary</h3>
        <div className="text-red-600 text-sm">
          {error}
          <button 
            onClick={fetchBalanceSummary}
            className="ml-2 text-blue-600 hover:text-blue-800 underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!balanceSummary) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium text-gray-900">Balance Summary</h3>
        <button
          onClick={fetchBalanceSummary}
          className="text-sm text-gray-500 hover:text-gray-700"
          title="Refresh balances"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Total Balance */}
      <div className="mb-6">
        <div className="text-sm text-gray-600">Total Balance</div>
        <div className={`text-2xl font-bold ${
          balanceSummary.totalBalance >= 0 ? 'text-green-600' : 'text-red-600'
        }`}>
          {formatCurrency(balanceSummary.totalBalance)}
        </div>
      </div>

      {/* Partner Balances */}
      {balanceSummary.partnerBalances.length > 0 && (
        <div>
          <div className="text-sm text-gray-600 mb-3">Partner Balances</div>
          <div className="space-y-2">
            {balanceSummary.partnerBalances.map((partner) => (
              <div key={partner.partnerId} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-b-0">
                <div className="text-sm font-medium text-gray-900">
                  {partner.partnerName}
                </div>
                <div className={`text-sm font-semibold ${
                  partner.balance >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatCurrency(partner.balance)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {balanceSummary.partnerBalances.length === 0 && (
        <div className="text-sm text-gray-500 italic">
          No partner-specific balances found
        </div>
      )}
    </div>
  );
}
