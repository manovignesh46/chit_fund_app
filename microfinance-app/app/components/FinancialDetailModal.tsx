// @ts-nocheck
'use client';

import React, { useEffect, useRef } from 'react';
import { FinancialDataPoint } from '../../lib/api';

interface FinancialDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodData: FinancialDataPoint | null;
}

const FinancialDetailModal: React.FC<FinancialDetailModalProps> = ({
  isOpen,
  onClose,
  periodData,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Format currency
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Handle click outside and ESC key to close the modal
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleEscKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        onClose();
      }
    }

    // Add event listeners when modal is shown
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscKey);
    }

    // Clean up the event listeners
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !periodData) {
    return null;
  }

  return (
    <div className="modal-overlay flex items-start sm:items-center justify-center z-50 p-2 sm:p-4 overflow-y-auto">
      <div
        ref={modalRef}
        className="themed-card-xl p-4 sm:p-6 w-full max-w-sm sm:max-w-lg lg:max-w-2xl my-4 sm:my-8 max-h-[calc(100vh-4rem)] sm:max-h-[85vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1 pr-4">
            <h2 className="section-heading">
              Financial Details: {periodData.period}
            </h2>
            {periodData.periodRange && (
              <p className="text-sm text-gray-500 mt-1">
                {new Date(periodData.periodRange.startDate).toLocaleDateString()} -{' '}
                {new Date(periodData.periodRange.endDate).toLocaleDateString()}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-gray-500 hover:text-gray-700 dark:text-theme-secondary p-2 hover:bg-gray-50 dark:hover:bg-surface-hover rounded-full transition-colors"
            aria-label="Close modal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
          {/* Cash Flow Section */}
          <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
            <h3 className="text-sm sm:text-lg font-semibold text-blue-700 mb-2">
              Cash Flow
            </h3>
            <div className="space-y-1 sm:space-y-2">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-0">
                <span className="text-xs sm:text-sm text-gray-700 dark:text-theme-secondary">Cash Inflow:</span>
                <span className="font-medium text-blue-600 text-xs sm:text-sm">
                  {formatCurrency(periodData.cashInflow)}
                </span>
              </div>
              {periodData.cashFlowDetails && (
                <>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs sm:text-sm text-gray-500 pl-2 sm:pl-4">
                    <span>- Chit Fund Contributions:</span>
                    <span>
                      {formatCurrency(periodData.cashFlowDetails.contributionInflow)}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs sm:text-sm text-gray-500 pl-2 sm:pl-4">
                    <span>- Loan Repayments:</span>
                    <span>
                      {formatCurrency(periodData.cashFlowDetails.repaymentInflow)}
                    </span>
                  </div>
                </>
              )}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-0 mt-1 sm:mt-2">
                <span className="text-xs sm:text-sm text-gray-700 dark:text-theme-secondary">Cash Outflow:</span>
                <span className="font-medium text-red-600 text-xs sm:text-sm">
                  {formatCurrency(periodData.cashOutflow)}
                </span>
              </div>
              {periodData.cashFlowDetails && (
                <>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs sm:text-sm text-gray-500 pl-2 sm:pl-4">
                    <span>- Chit Fund Auctions:</span>
                    <span>
                      {formatCurrency(periodData.cashFlowDetails.auctionOutflow)}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs sm:text-sm text-gray-500 pl-2 sm:pl-4">
                    <span>- Loan Disbursements:</span>
                    <span>
                      {formatCurrency(periodData.cashFlowDetails.loanOutflow)}
                    </span>
                  </div>
                </>
              )}
              {periodData.cashFlowDetails && (
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-t border-blue-200 pt-1 sm:pt-2 mt-1 sm:mt-2">
                  <span className="font-semibold text-xs sm:text-sm text-gray-700 dark:text-theme-secondary">
                    Net Cash Flow:
                  </span>
                  <span
                    className={`font-semibold text-xs sm:text-sm ${
                      periodData.cashFlowDetails.netCashFlow >= 0
                        ? 'text-green-600'
                        : 'text-red-600'
                    }`}
                  >
                    {formatCurrency(periodData.cashFlowDetails.netCashFlow)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Profit Section */}
          <div className="bg-green-50 p-3 sm:p-4 rounded-lg">
            <h3 className="text-sm sm:text-lg font-semibold text-green-700 mb-2">
              Profit
            </h3>
            <div className="space-y-1 sm:space-y-2">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-0">
                <span className="text-xs sm:text-sm text-gray-700 dark:text-theme-secondary">Total Profit:</span>
                <span className="font-medium text-green-600 text-xs sm:text-sm">
                  {formatCurrency(periodData.profit)}
                </span>
              </div>
              {periodData.profitDetails && (
                <>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs sm:text-sm text-gray-500 pl-2 sm:pl-4">
                    <span>- Interest Payments:</span>
                    <span>
                      {formatCurrency(periodData.profitDetails.interestPayments)}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs sm:text-sm text-gray-500 pl-2 sm:pl-4">
                    <span>- Document Charges:</span>
                    <span>
                      {formatCurrency(periodData.profitDetails.documentCharges)}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center text-xs sm:text-sm text-gray-500 pl-2 sm:pl-4">
                    <span>- Auction Commissions:</span>
                    <span>
                      {formatCurrency(periodData.profitDetails.auctionCommissions)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Outside Amount Section */}
          <div className="bg-orange-50 p-3 sm:p-4 rounded-lg">
            <h3 className="text-sm sm:text-lg font-semibold text-orange-700 mb-2">
              Outside Amount
            </h3>
            <div className="space-y-1 sm:space-y-2">
              {periodData.outsideAmountBreakdown && (
                <>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-0">
                    <span className="text-xs sm:text-sm text-gray-700 dark:text-theme-secondary">
                      Loan Remaining:
                    </span>
                    <span className="font-medium text-orange-600 text-xs sm:text-sm">
                      {formatCurrency(
                        periodData.outsideAmountBreakdown.loanRemainingAmount
                      )}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-0">
                    <span className="text-xs sm:text-sm text-gray-700 dark:text-theme-secondary">
                      Chit Fund Outside:
                    </span>
                    <span className="font-medium text-blue-600 text-xs sm:text-sm">
                      {formatCurrency(
                        periodData.outsideAmountBreakdown.chitFundOutsideAmount
                      )}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-t border-orange-200 pt-1 sm:pt-2 mt-1 sm:mt-2">
                    <span className="font-semibold text-xs sm:text-sm text-gray-700 dark:text-theme-secondary">
                      Total Outside Amount:
                    </span>
                    <span className="font-semibold text-xs sm:text-sm text-orange-600">
                      {formatCurrency(periodData.outsideAmount)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Transaction Summary Section */}
          <div className="bg-gray-50 dark:bg-surface-elevated p-3 sm:p-4 rounded-lg">
            <h3 className="text-sm sm:text-lg font-semibold text-purple-700 mb-2">
              Transaction Summary
            </h3>
            <div className="space-y-1 sm:space-y-2">
              {periodData.transactionCounts && (
                <>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-0">
                    <span className="text-xs sm:text-sm text-gray-700 dark:text-theme-secondary">
                      Contributions:
                    </span>
                    <span className="font-medium text-purple-600 text-xs sm:text-sm">
                      {periodData.transactionCounts.contributions}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-0">
                    <span className="text-xs sm:text-sm text-gray-700 dark:text-theme-secondary">
                      Loan Repayments:
                    </span>
                    <span className="font-medium text-purple-600 text-xs sm:text-sm">
                      {periodData.transactionCounts.repayments}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-0">
                    <span className="text-xs sm:text-sm text-gray-700 dark:text-theme-secondary">Auctions:</span>
                    <span className="font-medium text-purple-600 text-xs sm:text-sm">
                      {periodData.transactionCounts.auctions}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1 sm:gap-0">
                    <span className="text-xs sm:text-sm text-gray-700 dark:text-theme-secondary">
                      Loan Disbursements:
                    </span>
                    <span className="font-medium text-purple-600 text-xs sm:text-sm">
                      {periodData.transactionCounts.loans}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Close Button */}
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm sm:text-base"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default FinancialDetailModal;
