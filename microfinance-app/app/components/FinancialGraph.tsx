// @ts-nocheck
'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { GraphSkeleton } from './skeletons/SkeletonLoader';
import { FinancialDataPoint } from '../../lib/api';

// Using FinancialDataPoint from the API

interface FinancialGraphProps {
  data: FinancialDataPoint[];
  loading: boolean;
  error: string | null;
}

const FinancialGraph: React.FC<FinancialGraphProps> = ({ data, loading, error }) => {
  const [graphType, setGraphType] = useState<'line' | 'bar'>('line');
  const [showProfit, setShowProfit] = useState(false);
  const [selectedPeriod, setSelectedPeriod] = useState<FinancialDataPoint | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);

  // Format currency for tooltip
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Handle click outside to close the detail modal
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setShowDetailModal(false);
      }
    }

    // Add event listener when modal is shown
    if (showDetailModal) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    // Clean up the event listener
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDetailModal]);

  // Custom tooltip component
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 border border-gray-200 shadow-md rounded-md">
          <p className="font-semibold text-gray-700">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={`tooltip-${index}`} className="flex justify-between gap-4 items-center">
              <div className="flex items-center">
                <div
                  className="w-3 h-3 rounded-full mr-2"
                  style={{ backgroundColor: entry.color }}
                ></div>
                <span className="text-sm">{entry.name}:</span>
              </div>
              <span className="text-sm font-medium">{formatCurrency(entry.value)}</span>
            </div>
          ))}
          <div className="mt-2 pt-2 border-t border-gray-200">
            <p className="text-xs text-gray-500">Click on any data point for detailed breakdown</p>
          </div>
        </div>
      );
    }
    return null;
  };

  // Handle click on outside amount to show breakdown
  const handleOutsideAmountClick = (data: any) => {
    if (data && data.outsideAmountBreakdown) {
      const { loanRemainingAmount, chitFundOutsideAmount } = data.outsideAmountBreakdown;
      alert(
        `Outside Amount Breakdown:\n\n` +
        `Loan Remaining Amount: ${formatCurrency(loanRemainingAmount)}\n` +
        `Chit Fund Outside Amount: ${formatCurrency(chitFundOutsideAmount)}`
      );
    }
  };

  // Handle click on any data point to show detailed modal
  const handleDataPointClick = (data: any) => {
    if (data && data.activePayload && data.activePayload.length) {
      const periodData = data.activePayload[0].payload;
      setSelectedPeriod(periodData);
      setShowDetailModal(true);
    }
  };

  if (loading) {
    return <GraphSkeleton height="20rem" showControls={true} />;
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-blue-700">Financial Trends</h2>
        <div className="flex space-x-4">
          <div className="flex items-center">
            <label htmlFor="showProfit" className="mr-2 text-sm text-gray-600">
              Show Profit
            </label>
            <input
              type="checkbox"
              id="showProfit"
              checked={showProfit}
              onChange={() => setShowProfit(!showProfit)}
              className="form-checkbox h-4 w-4 text-blue-600"
            />
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setGraphType('line')}
              className={`px-3 py-1 text-sm rounded-md ${
                graphType === 'line'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Line
            </button>
            <button
              onClick={() => setGraphType('bar')}
              className={`px-3 py-1 text-sm rounded-md ${
                graphType === 'bar'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Bar
            </button>
          </div>
        </div>
      </div>

      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          {graphType === 'line' ? (
            <LineChart
              data={data}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              onClick={handleDataPointClick}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Line
                type="monotone"
                dataKey="cashInflow"
                name="Cash Inflow"
                stroke="#3b82f6"
                activeDot={{ r: 8 }}
              />
              <Line
                type="monotone"
                dataKey="cashOutflow"
                name="Cash Outflow"
                stroke="#ef4444"
                activeDot={{ r: 8 }}
              />
              {showProfit && (
                <Line
                  type="monotone"
                  dataKey="profit"
                  name="Profit"
                  stroke="#10b981"
                  activeDot={{ r: 8 }}
                />
              )}
              <Line
                type="monotone"
                dataKey="outsideAmount"
                name="Outside Amount"
                stroke="#f97316"
                activeDot={{ r: 8 }}
              />
            </LineChart>
          ) : (
            <BarChart
              data={data}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              onClick={handleDataPointClick}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="period" />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="cashInflow" name="Cash Inflow" fill="#3b82f6" />
              <Bar dataKey="cashOutflow" name="Cash Outflow" fill="#ef4444" />
              {showProfit && (
                <Bar dataKey="profit" name="Profit" fill="#10b981" />
              )}
              <Bar
                dataKey="outsideAmount"
                name="Outside Amount"
                fill="#f97316"
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Detailed Period Modal */}
      {showDetailModal && selectedPeriod && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
          <div
            ref={modalRef}
            className="bg-white rounded-lg shadow-xl p-3 sm:p-6 w-full max-w-xs sm:max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-auto"
          >
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-2">
              <div>
                <h2 className="text-base sm:text-xl font-bold text-blue-700">Financial Details: {selectedPeriod.period}</h2>
                <p className="text-xs sm:text-sm text-gray-500">
                  {new Date(selectedPeriod.periodRange.startDate).toLocaleDateString()} - {new Date(selectedPeriod.periodRange.endDate).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-500 hover:text-gray-700 self-end"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-6">
              <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
                <h3 className="text-sm sm:text-lg font-semibold text-blue-700 mb-2">Cash Flow</h3>
                <div className="space-y-1 sm:space-y-2">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-0">
                    <span className="text-xs sm:text-sm text-gray-600">Cash Inflow:</span>
                    <span className="font-medium text-blue-600 text-xs sm:text-sm">{formatCurrency(selectedPeriod.cashInflow)}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs sm:text-sm text-gray-500 pl-2 sm:pl-4">
                    <span>- Chit Fund Contributions:</span>
                    <span>{formatCurrency(selectedPeriod.cashFlowDetails.contributionInflow)}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs sm:text-sm text-gray-500 pl-2 sm:pl-4">
                    <span>- Loan Repayments:</span>
                    <span>{formatCurrency(selectedPeriod.cashFlowDetails.repaymentInflow)}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-0 mt-1 sm:mt-2">
                    <span className="text-xs sm:text-sm text-gray-600">Cash Outflow:</span>
                    <span className="font-medium text-red-600 text-xs sm:text-sm">{formatCurrency(selectedPeriod.cashOutflow)}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs sm:text-sm text-gray-500 pl-2 sm:pl-4">
                    <span>- Chit Fund Auctions:</span>
                    <span>{formatCurrency(selectedPeriod.cashFlowDetails.auctionOutflow)}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs sm:text-sm text-gray-500 pl-2 sm:pl-4">
                    <span>- Loan Disbursements:</span>
                    <span>{formatCurrency(selectedPeriod.cashFlowDetails.loanOutflow)}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-t border-blue-200 pt-1 sm:pt-2 mt-1 sm:mt-2">
                    <span className="font-semibold text-xs sm:text-sm text-gray-700">Net Cash Flow:</span>
                    <span className={`font-semibold text-xs sm:text-sm ${selectedPeriod.cashFlowDetails.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(selectedPeriod.cashFlowDetails.netCashFlow)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 p-3 sm:p-4 rounded-lg">
                <h3 className="text-sm sm:text-lg font-semibold text-green-700 mb-2">Profit</h3>
                <div className="space-y-1 sm:space-y-2">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-0">
                    <span className="text-xs sm:text-sm text-gray-600">Loan Profit:</span>
                    <span className="font-medium text-purple-600 text-xs sm:text-sm">{formatCurrency(selectedPeriod.loanProfit)}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs sm:text-sm text-gray-500 pl-2 sm:pl-4">
                    <span>- Interest Payments:</span>
                    <span>{formatCurrency(selectedPeriod.profitDetails.interestPayments)}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs sm:text-sm text-gray-500 pl-2 sm:pl-4">
                    <span>- Document Charges:</span>
                    <span>{formatCurrency(selectedPeriod.profitDetails.documentCharges)}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-0 mt-1 sm:mt-2">
                    <span className="text-xs sm:text-sm text-gray-600">Chit Fund Profit:</span>
                    <span className="font-medium text-blue-600 text-xs sm:text-sm">{formatCurrency(selectedPeriod.chitFundProfit)}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs sm:text-sm text-gray-500 pl-2 sm:pl-4">
                    <span>- Auction Commissions:</span>
                    <span>{formatCurrency(selectedPeriod.profitDetails.auctionCommissions)}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-t border-green-200 pt-1 sm:pt-2 mt-1 sm:mt-2">
                    <span className="font-semibold text-xs sm:text-sm text-gray-700">Total Profit:</span>
                    <span className="font-semibold text-xs sm:text-sm text-green-600">{formatCurrency(selectedPeriod.profit)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 sm:gap-4 mb-4 sm:mb-6">
              <div className="bg-orange-50 p-3 sm:p-4 rounded-lg">
                <h3 className="text-sm sm:text-lg font-semibold text-orange-700 mb-2">Outside Amount</h3>
                <div className="space-y-1 sm:space-y-2">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-0">
                    <span className="text-xs sm:text-sm text-gray-600">Loan Remaining Amount:</span>
                    <span className="font-medium text-purple-600 text-xs sm:text-sm">{formatCurrency(selectedPeriod.outsideAmountBreakdown.loanRemainingAmount)}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-0">
                    <span className="text-xs sm:text-sm text-gray-600">Chit Fund Outside Amount:</span>
                    <span className="font-medium text-blue-600 text-xs sm:text-sm">{formatCurrency(selectedPeriod.outsideAmountBreakdown.chitFundOutsideAmount)}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-t border-orange-200 pt-1 sm:pt-2 mt-1 sm:mt-2">
                    <span className="font-semibold text-xs sm:text-sm text-gray-700">Total Outside Amount:</span>
                    <span className="font-semibold text-xs sm:text-sm text-orange-600">{formatCurrency(selectedPeriod.outsideAmount)}</span>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 p-3 sm:p-4 rounded-lg">
                <h3 className="text-sm sm:text-lg font-semibold text-purple-700 mb-2">Transaction Summary</h3>
                <div className="space-y-1 sm:space-y-2">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-0">
                    <span className="text-xs sm:text-sm text-gray-600">Loan Disbursements:</span>
                    <span className="font-medium text-xs sm:text-sm">{selectedPeriod.transactionCounts.loanDisbursements}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-0">
                    <span className="text-xs sm:text-sm text-gray-600">Loan Repayments:</span>
                    <span className="font-medium text-xs sm:text-sm">{selectedPeriod.transactionCounts.loanRepayments}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-0">
                    <span className="text-xs sm:text-sm text-gray-600">Chit Fund Contributions:</span>
                    <span className="font-medium text-xs sm:text-sm">{selectedPeriod.transactionCounts.chitFundContributions}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-0">
                    <span className="text-xs sm:text-sm text-gray-600">Chit Fund Auctions:</span>
                    <span className="font-medium text-xs sm:text-sm">{selectedPeriod.transactionCounts.chitFundAuctions}</span>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-t border-purple-200 pt-1 sm:pt-2 mt-1 sm:mt-2">
                    <span className="font-semibold text-xs sm:text-sm text-gray-700">Total Transactions:</span>
                    <span className="font-semibold text-xs sm:text-sm text-purple-600">{selectedPeriod.transactionCounts.totalTransactions}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2 mt-2">
              <a
                href={`/api/dashboard/financial-data/export?duration=single&period=${encodeURIComponent(selectedPeriod.period)}&startDate=${encodeURIComponent(selectedPeriod.periodRange.startDate)}&endDate=${encodeURIComponent(selectedPeriod.periodRange.endDate)}`}
                download={`financial_details_${selectedPeriod.period.replace(/\s+/g, '_')}.xlsx`}
                className="flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-300 w-full sm:w-auto"
                title="Export this period's financial details to Excel"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Export Details
              </a>
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300 w-full sm:w-auto"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialGraph;
