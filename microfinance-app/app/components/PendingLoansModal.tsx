'use client';

import { useEffect } from 'react';
import { formatCurrency } from '../../lib/formatUtils';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface PendingLoan {
  id: number;
  borrowerName: string;
  loanType: string;
  totalAmount: number;
  installmentAmount: number;
  pendingAmount: number;
  pendingPeriods: number;
  repaymentType: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  loans: PendingLoan[];
  month: string;
  year: number;
}

export default function PendingLoansModal({ isOpen, onClose, loans, month, year }: Props) {
  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Handle ESC key press
  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }

    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const totalPendingAmount = loans.reduce((sum, loan) => sum + loan.pendingAmount, 0);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      {/* Background overlay */}
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-gray-50 dark:bg-surface-elevated0 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        {/* Modal panel */}
        <span className="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
        
        <div className="inline-block align-bottom themed-card rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-3xl sm:w-full">
          {/* Header */}
          <div className="bg-purple-600 px-4 py-3 sm:px-6 flex items-center justify-between">
            <h3 className="text-lg leading-6 font-medium text-white" id="modal-title">
              Pending Loan Repayments - {month} {year}
            </h3>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Body */}
          <div className="themed-card px-4 pt-5 pb-4 sm:p-6">
            {loans.length === 0 ? (
              <div className="text-center py-8">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-300 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-500 text-lg">No pending loan repayments</p>
                <p className="text-gray-400 text-sm mt-1">All loans are up to date for this period!</p>
              </div>
            ) : (
              <>
                {/* Summary */}
                <div className="mb-4 bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-700 dark:text-theme-secondary">Total Pending Loans</p>
                      <p className="text-2xl font-bold text-purple-600">{loans.length}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-700 dark:text-theme-secondary">Total Pending Amount</p>
                      <p className="text-2xl font-bold text-orange-600">{formatCurrency(totalPendingAmount)}</p>
                    </div>
                  </div>
                </div>

                {/* Loans List */}
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {loans.map((loan) => (
                    <div key={loan.id} className="border border-gray-200 dark:border-surface-border rounded-lg p-4 hover:shadow-md transition">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900 dark:text-theme-primary">{loan.borrowerName}</h4>
                          <p className="text-sm text-gray-500">{loan.loanType}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Pending Amount</p>
                          <p className="text-lg font-bold text-orange-600">{formatCurrency(loan.pendingAmount)}</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="bg-gray-50 dark:bg-surface-elevated p-2 rounded">
                          <p className="text-xs text-gray-500">Total Loan Amount</p>
                          <p className="font-semibold text-gray-700 dark:text-theme-secondary">{formatCurrency(loan.totalAmount)}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-surface-elevated p-2 rounded">
                          <p className="text-xs text-gray-500">Installment Amount</p>
                          <p className="font-semibold text-gray-700 dark:text-theme-secondary">{formatCurrency(loan.installmentAmount)}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-surface-elevated p-2 rounded">
                          <p className="text-xs text-gray-500">Pending Periods</p>
                          <p className="font-semibold text-gray-700 dark:text-theme-secondary">{loan.pendingPeriods} {loan.repaymentType === 'Weekly' ? 'weeks' : 'months'}</p>
                        </div>
                        <div className="bg-gray-50 dark:bg-surface-elevated p-2 rounded">
                          <p className="text-xs text-gray-500">Repayment Type</p>
                          <p className="font-semibold text-gray-700 dark:text-theme-secondary">{loan.repaymentType}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="bg-gray-50 dark:bg-surface-elevated px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="button"
              onClick={onClose}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-purple-600 text-base font-medium text-white hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 sm:ml-3 sm:w-auto sm:text-sm"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
