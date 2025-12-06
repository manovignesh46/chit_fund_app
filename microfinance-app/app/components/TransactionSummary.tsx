'use client';

import { useState, useEffect } from 'react';
import { formatCurrency } from '../../lib/formatUtils';
import { usePartner } from '../contexts/PartnerContext';

interface TransactionSummaryProps {
  // Filter props to determine what data to fetch
  selectedPartnerId?: string;
  filterType?: string;
  filterMember?: string;
  advType?: string;
  advMember?: string;
  advEntity?: string;
  advSubType?: string;
  startDate?: string;
  endDate?: string;
  refreshTrigger?: boolean;
}

interface SummaryData {
  totalLoanRepayment: number;
  totalLoanDisbursement: number;
  totalDocumentCharges: number;
  totalChitContributions: number;
  totalAuctionPayouts: number;
  totalRecordedAmount: number;
  totalPartnerTransfers: number;
  totalAmount: number;
  totalTransactions: number;
  partnerBreakdown: Array<{
    partnerName: string;
    balance: number;
    totalCredits: number;
    totalDebits: number;
    transactionCount: number;
    loanRepayments: number;
    loanDisbursements: number;
    documentCharges: number;
    chitContributions: number;
    auctionPayouts: number;
    recordedAmounts: number;
    partnerTransfers: number;
    partnerTotalAmount: number;
  }>;
  balanceDifference: number;
}

export default function TransactionSummary(props: TransactionSummaryProps) {
  const {
    selectedPartnerId = 'ALL',
    filterType = '',
    filterMember = '',
    advType = '',
    advMember = '',
    advEntity = '',
    advSubType = '',
    startDate = '',
    endDate = '',
    refreshTrigger,
  } = props;

  const [summaryData, setSummaryData] = useState(null as SummaryData | null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchTransactionSummary();
  }, [
    selectedPartnerId,
    filterType,
    filterMember,
    advType,
    advMember,
    advEntity,
    advSubType,
    startDate,
    endDate,
    refreshTrigger,
  ]);

  async function fetchTransactionSummary() {
    try {
      setLoading(true);
      setError('');

      // Build query parameters for summary API
      let url = '/api/transactions/summary?';
      const params = new URLSearchParams();

      if (selectedPartnerId && selectedPartnerId !== 'ALL') {
        params.append('partner', selectedPartnerId);
      }
      if (filterType) params.append('type', filterType);
      if (filterMember) params.append('member', filterMember);
      if (advType) params.append('advType', advType);
      if (advMember) params.append('advMember', advMember);
      if (advEntity) params.append('advEntity', advEntity);
      if (advSubType) params.append('advSubType', advSubType);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      url += params.toString();

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch transaction summary');
      }

      const data = await response.json();
      setSummaryData(data);
    } catch (err: any) {
      console.error('Error fetching transaction summary:', err);
      setError(err.message || 'Failed to load transaction summary');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Transaction Summary</h3>
        <div className="animate-pulse">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-gray-100 rounded-lg p-4">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-6 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Transaction Summary</h3>
        <div className="text-red-600 text-sm">
          {error}
          <button 
            onClick={fetchTransactionSummary}
            className="ml-2 text-blue-600 hover:text-blue-800 underline"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!summaryData) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Transaction Summary</h3>
        <div className="text-gray-500 text-center py-8">
          No data available for the selected filters
        </div>
      </div>
    );
  }

  const formatPeriod = () => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
    } else if (startDate) {
      return `From ${new Date(startDate).toLocaleDateString()}`;
    } else if (endDate) {
      return `Until ${new Date(endDate).toLocaleDateString()}`;
    }
    return 'All Time';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Transaction Summary</h3>
          <p className="text-sm text-gray-600">
            {formatPeriod()} • {summaryData.totalTransactions} transactions
            {selectedPartnerId !== 'ALL' && ` • ${selectedPartnerId}`}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            <span className="text-blue-600">* Balances calculated from transaction records</span>
            <br />
            <span className="text-purple-600">* Total Amount = (Repayments + Document Charges + Contributions + Net Recorded) - (Disbursements + Auctions)</span>
            <br />
            <span className="text-gray-500">* Scroll horizontally to view all columns</span>
          </p>
        </div>
        <button
          onClick={fetchTransactionSummary}
          className="text-sm text-gray-500 hover:text-gray-700 p-1 rounded"
          title="Refresh summary"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Transaction Summary Table */}
      <div className="border border-gray-300 rounded-lg">
        <div className="overflow-x-auto w-full" style={{maxWidth: '85vw'}}>
          <table className="w-full text-sm border-collapse divide-y divide-gray-200" style={{minWidth: '1000px'}}>
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left font-medium text-gray-700 border-r border-gray-300 sticky left-0 bg-gray-50 z-10">Partner</th>
                <th className="px-3 py-3 text-right font-medium text-gray-700 border-r border-gray-300 min-w-[120px]">Loan Repayments</th>
                <th className="px-3 py-3 text-right font-medium text-gray-700 border-r border-gray-300 min-w-[120px]">Chit Contributions</th>
                <th className="px-3 py-3 text-right font-medium text-gray-700 border-r border-gray-300 min-w-[120px]">Recorded Amounts</th>
                <th className="px-3 py-3 text-right font-medium text-gray-700 border-r border-gray-300 min-w-[120px]">Loan Disbursements</th>
                <th className="px-3 py-3 text-right font-medium text-gray-700 border-r border-gray-300 min-w-[120px]">Document Charges</th>
                <th className="px-3 py-3 text-right font-medium text-gray-700 border-r border-gray-300 min-w-[120px]">Auction Payouts</th>
                <th className="px-3 py-3 text-right font-medium text-gray-700 border-r border-gray-300 min-w-[120px]">Partner Transfers</th>
                <th className="px-3 py-3 text-right font-medium text-gray-700 min-w-[120px]">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {summaryData.partnerBreakdown.map((partner, index) => (
                <tr key={index} className="hover:bg-gray-50 border-b border-gray-200">
                  <td className="px-3 py-3 font-medium text-gray-900 border-r border-gray-300 sticky left-0 bg-white hover:bg-gray-50">{partner.partnerName}</td>
                  <td className="px-3 py-3 text-right text-green-600 border-r border-gray-300">
                    {formatCurrency(partner.loanRepayments || 0)}
                  </td>
                  <td className="px-3 py-3 text-right text-blue-600 border-r border-gray-300">
                    {formatCurrency(partner.chitContributions || 0)}
                  </td>
                  <td className={`px-3 py-3 text-right border-r border-gray-300 ${
                    (partner.recordedAmounts || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatCurrency(partner.recordedAmounts || 0)}
                  </td>
                  <td className="px-3 py-3 text-right text-red-600 border-r border-gray-300">
                    {formatCurrency(partner.loanDisbursements || 0)}
                  </td>
                  <td className="px-3 py-3 text-right text-orange-600 border-r border-gray-300">
                    {formatCurrency(partner.documentCharges || 0)}
                  </td>
                  <td className="px-3 py-3 text-right text-purple-600 border-r border-gray-300">
                    {formatCurrency(partner.auctionPayouts || 0)}
                  </td>
                  <td className="px-3 py-3 text-right text-indigo-600 border-r border-gray-300">
                    {formatCurrency(partner.partnerTransfers || 0)}
                  </td>
                  <td className={`px-3 py-3 text-right font-semibold ${
                    (partner.partnerTotalAmount || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    {formatCurrency(partner.partnerTotalAmount || 0)}
                  </td>
                </tr>
              ))}
              {/* Total Row */}
              <tr className="bg-gray-100 font-semibold border-t-2 border-gray-400">
                <td className="px-3 py-3 font-bold text-gray-900 border-r border-gray-300 sticky left-0 bg-gray-100">Total</td>
                <td className="px-3 py-3 text-right text-green-600 border-r border-gray-300">
                  {formatCurrency(summaryData.totalLoanRepayment)}
                </td>
                <td className="px-3 py-3 text-right text-blue-600 border-r border-gray-300">
                  {formatCurrency(summaryData.totalChitContributions)}
                </td>
                <td className={`px-3 py-3 text-right border-r border-gray-300 ${
                  summaryData.totalRecordedAmount >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatCurrency(summaryData.totalRecordedAmount)}
                </td>
                <td className="px-3 py-3 text-right text-red-600 border-r border-gray-300">
                  {formatCurrency(summaryData.totalLoanDisbursement)}
                </td>
                <td className="px-3 py-3 text-right text-orange-600 border-r border-gray-300">
                  {formatCurrency(summaryData.totalDocumentCharges)}
                </td>
                <td className="px-3 py-3 text-right text-purple-600 border-r border-gray-300">
                  {formatCurrency(summaryData.totalAuctionPayouts)}
                </td>
                <td className="px-3 py-3 text-right text-indigo-600 border-r border-gray-300">
                  {formatCurrency(summaryData.totalPartnerTransfers)}
                </td>
                <td className={`px-3 py-3 text-right font-bold ${
                  summaryData.totalAmount >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {formatCurrency(summaryData.totalAmount)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
