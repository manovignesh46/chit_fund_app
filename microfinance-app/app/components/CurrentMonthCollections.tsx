'use client';

import { useEffect, useState } from 'react';
import { formatCurrency } from '../../lib/formatUtils';
import PendingLoansModal from './PendingLoansModal';
import PendingChitsModal from './PendingChitsModal';

interface AggregationData {
  expectedLoanRepayment: number;
  actualLoanRepayment: number;
  expectedChitContribution: number;
  actualChitContribution: number;
  totalExpectedAmount: number;
  totalActualAmount: number;
}

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

interface PendingMember {
  memberName: string;
  pendingAmount: number;
  pendingPeriods: number;
}

interface PendingChitFund {
  id: number;
  name: string;
  totalAmount: number;
  installmentAmount: number;
  frequency: string;
  pendingMembers: PendingMember[];
  totalPendingAmount: number;
}

interface Props {
  refreshTrigger?: boolean;
}

export default function CurrentMonthCollections({ refreshTrigger }: Props) {
  const [data, setData] = useState(null as AggregationData | null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null as string | null);
  
  // Modal states
  const [showLoansModal, setShowLoansModal] = useState(false);
  const [showChitsModal, setShowChitsModal] = useState(false);
  const [pendingLoans, setPendingLoans] = useState<PendingLoan[]>([]);
  const [pendingChitFunds, setPendingChitFunds] = useState<PendingChitFund[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);
  
  // Get current month and year
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth()); // 0-11
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());

  // Get month name
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  useEffect(() => {
    const fetchCurrentMonthAggregations = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Get selected month's start and end dates
        const startDate = new Date(selectedYear, selectedMonth, 1);
        const endDate = new Date(selectedYear, selectedMonth + 1, 0);

        // Format dates as YYYY-MM-DD
        const formatDate = (date: Date) => {
          return date.toISOString().split('T')[0];
        };

        const response = await fetch(
          `/api/transactions/aggregations?startDate=${formatDate(startDate)}&endDate=${formatDate(endDate)}`
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch aggregations');
        }
        
        const aggregations = await response.json();
        setData(aggregations);
      } catch (err: any) {
        console.error('Error fetching current month aggregations:', err);
        setError(err.message || 'Failed to load collections data');
      } finally {
        setLoading(false);
      }
    };

    fetchCurrentMonthAggregations();
  }, [refreshTrigger, selectedMonth, selectedYear]);

  // Fetch pending loans
  const fetchPendingLoans = async () => {
    setLoadingPending(true);
    try {
      const startDate = new Date(selectedYear, selectedMonth, 1);
      const endDate = new Date(selectedYear, selectedMonth + 1, 0);

      const formatDate = (date: Date) => {
        return date.toISOString().split('T')[0];
      };

      const response = await fetch(
        `/api/transactions/pending-loans?startDate=${formatDate(startDate)}&endDate=${formatDate(endDate)}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch pending loans');
      }
      
      const data = await response.json();
      setPendingLoans(data.pendingLoans || []);
      setShowLoansModal(true);
    } catch (err: any) {
      console.error('Error fetching pending loans:', err);
      alert('Failed to load pending loans. Please try again.');
    } finally {
      setLoadingPending(false);
    }
  };

  // Fetch pending chit funds
  const fetchPendingChits = async () => {
    setLoadingPending(true);
    try {
      const startDate = new Date(selectedYear, selectedMonth, 1);
      const endDate = new Date(selectedYear, selectedMonth + 1, 0);

      const formatDate = (date: Date) => {
        return date.toISOString().split('T')[0];
      };

      const response = await fetch(
        `/api/transactions/pending-chits?startDate=${formatDate(startDate)}&endDate=${formatDate(endDate)}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to fetch pending chit funds');
      }
      
      const data = await response.json();
      setPendingChitFunds(data.pendingChitFunds || []);
      setShowChitsModal(true);
    } catch (err: any) {
      console.error('Error fetching pending chit funds:', err);
      alert('Failed to load pending chit funds. Please try again.');
    } finally {
      setLoadingPending(false);
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:gap-6 mb-6 sm:mb-8 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="dark-card p-4 sm:p-6 animate-pulse">
            <div className="h-4 bg-gray-50 dark:bg-surface-elevated rounded w-3/4 mb-4"></div>
            <div className="space-y-3">
              <div className="h-3 bg-gray-50 dark:bg-surface-elevated rounded w-full"></div>
              <div className="h-3 bg-gray-50 dark:bg-surface-elevated rounded w-5/6"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert-error mb-6 sm:mb-8">
        <p className="text-red-400 text-sm">{error}</p>
      </div>
    );
  }

  if (!data) return null;

  const loanProgress = data.expectedLoanRepayment > 0 
    ? (data.actualLoanRepayment / data.expectedLoanRepayment) * 100 
    : 0;
  const chitProgress = data.expectedChitContribution > 0 
    ? (data.actualChitContribution / data.expectedChitContribution) * 100 
    : 0;
  const totalProgress = data.totalExpectedAmount > 0 
    ? (data.totalActualAmount / data.totalExpectedAmount) * 100 
    : 0;

  // Generate year options (2021 to 2040)
  const years = [];
  for (let i = 2021; i <= 2040; i++) {
    years.push(i);
  }

  return (
    <div className="mb-6 sm:mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-4 gap-3">
        <h2 className="text-lg sm:text-xl font-bold text-blue-700 dark:text-theme-heading">
          Monthly Collections
        </h2>
        
        <div className="flex items-center gap-2 flex-shrink-0">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="themed-input px-3 py-1.5 text-sm"
          >
            {months.map((month, index) => (
              <option key={index} value={index}>
                {month}
              </option>
            ))}
          </select>
          
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="themed-input px-3 py-1.5 text-sm"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:gap-6 md:grid-cols-3">
        {/* Loan Repayments Card */}
        <div className="dark-card p-4 sm:p-6 border-t-4 border-purple-500">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Loan Repayments</h3>
            <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-500">Expected</span>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {formatCurrency(data.expectedLoanRepayment)}
                </span>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-500">Collected</span>
                <span className="text-base font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(data.actualLoanRepayment)}
                </span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-500">Pending</span>
                <button
                  onClick={fetchPendingLoans}
                  disabled={loadingPending || (data.expectedLoanRepayment - data.actualLoanRepayment) === 0}
                  className={`text-base font-bold text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 transition underline decoration-dotted ${
                    loadingPending ? 'opacity-50 cursor-wait' : 'cursor-pointer'
                  } ${(data.expectedLoanRepayment - data.actualLoanRepayment) === 0 ? 'cursor-default no-underline' : ''}`}
                >
                  {formatCurrency(data.expectedLoanRepayment - data.actualLoanRepayment)}
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="pt-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-500">Progress</span>
                <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                  {loanProgress.toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(loanProgress, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Chit Fund Contributions Card */}
        <div className="dark-card p-4 sm:p-6 border-t-4 border-blue-500">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Chit Contributions</h3>
            <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-500">Expected</span>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {formatCurrency(data.expectedChitContribution)}
                </span>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-500">Collected</span>
                <span className="text-base font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(data.actualChitContribution)}
                </span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-500">Pending</span>
                <button
                  onClick={fetchPendingChits}
                  disabled={loadingPending || (data.expectedChitContribution - data.actualChitContribution) === 0}
                  className={`text-base font-bold text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 transition underline decoration-dotted ${
                    loadingPending ? 'opacity-50 cursor-wait' : 'cursor-pointer'
                  } ${(data.expectedChitContribution - data.actualChitContribution) === 0 ? 'cursor-default no-underline' : ''}`}
                >
                  {formatCurrency(data.expectedChitContribution - data.actualChitContribution)}
                </button>
              </div>
            </div>

            {/* Progress Bar */}
            <div className="pt-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-500">Progress</span>
                <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                  {chitProgress.toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(chitProgress, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Total Collections Card */}
        <div className="dark-card p-4 sm:p-6 border-t-4 border-green-500">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Total Collections</h3>
            <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          
          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-500">Expected</span>
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  {formatCurrency(data.totalExpectedAmount)}
                </span>
              </div>
            </div>
            
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-500">Collected</span>
                <span className="text-base font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(data.totalActualAmount)}
                </span>
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-500">Pending</span>
                <span className="text-base font-bold text-orange-600 dark:text-orange-400">
                  {formatCurrency(data.totalExpectedAmount - data.totalActualAmount)}
                </span>
              </div>
            </div>

            <div className="pt-2">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-500">Progress</span>
                <span className="text-xs font-semibold text-green-600 dark:text-green-400">
                  {totalProgress.toFixed(0)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(totalProgress, 100)}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <PendingLoansModal
        isOpen={showLoansModal}
        onClose={() => setShowLoansModal(false)}
        loans={pendingLoans}
        month={months[selectedMonth]}
        year={selectedYear}
      />

      <PendingChitsModal
        isOpen={showChitsModal}
        onClose={() => setShowChitsModal(false)}
        chitFunds={pendingChitFunds}
        month={months[selectedMonth]}
        year={selectedYear}
      />
    </div>
  );
}
