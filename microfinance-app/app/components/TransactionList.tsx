'use client';

import { useEffect, useState } from 'react';
import { formatCurrency, formatDate } from '../../lib/formatUtils';
import { usePartner } from '../contexts/PartnerContext';
import SortableTableHeader, { useSortableData } from './common/SortableTableHeader';

interface Transaction {
  id: number;
  type: string;
  amount: number;
  transactionClass?: string;
  member?: string; // Legacy
  
  // Legacy fields
  from_partner?: string;
  to_partner?: string;
  action_performer?: string;
  entered_by?: string;

  date: string;
  createdAt: string;
  note?: string;
  partnerBalance?: number;
  totalBalance?: number;
  partner?: {
      name: string;
  };
  
  // Linked Entities for Member Display
  repayment?: {
      loan: {
          borrower: {
              name: string;
          }
      }
  };
  contribution?: {
      member: {
          globalMember: {
              name: string;
          }
      }
  };
  auction?: {
      winner: {
          globalMember: {
              name: string;
          }
      }
  };
  loan?: {
      borrower: {
          name: string;
      }
  };
}

interface TransactionListProps {
  refresh?: boolean;
  page?: number;
  pageSize?: number;
  filterType?: string;
  filterMember?: string;
}

export function TransactionList(props: TransactionListProps & {
  activePartner?: string,
  currentPage: number,
  setCurrentPage: (page: number) => void,
  pageSize: number,
  setPageSize: (size: number) => void,
  advType?: string,
  advMember?: string,
  advEntity?: string,
  advSubType?: string,
  startDate?: string,
  endDate?: string,
}) {
  const {
    refresh,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    filterType = '',
    filterMember = '',
    activePartner,
    advType = '',
    advMember = '',
    advEntity = '',
    advSubType = '',
    startDate = '',
    endDate = '',
  } = props;

  // If activePartner is undefined or 'ALL', treat as all partners
  const partnerToUse = activePartner && activePartner !== 'ALL' ? activePartner : null;
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [noteModal, setNoteModal] = useState(null as null | { id: number; note: string });
  const [showRecalculateModal, setShowRecalculateModal] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [recalculateResult, setRecalculateResult] = useState(null as null | {
    success: boolean;
    message: string;
    details?: string;
  });

  // Add sorting functionality
  const { items: sortedTransactions, sortConfig, requestSort } = useSortableData(transactions);


  useEffect(() => {
    fetchTransactions();
  }, [partnerToUse, refresh, currentPage, pageSize, filterType, filterMember, advType, advMember, advEntity, advSubType, startDate, endDate]);

  async function fetchTransactions() {
    try {
      setLoading(true);
      let url = `/api/transactions?page=${currentPage}&pageSize=${pageSize}`;
      if (partnerToUse) {
        url += `&partner=${partnerToUse}`;
      }
      if (filterType) {
        url += `&type=${filterType}`;
      }
      if (filterMember) {
        url += `&member=${encodeURIComponent(filterMember)}`;
      }
      // Advanced filter logic: apply each filter independently
      if (advType) {
        url += `&advType=${advType}`;
      }
      if (advMember) {
        url += `&advMember=${advMember}`;
      }
      if (advEntity) {
        url += `&advEntity=${advEntity}`;
      }
      if (advSubType) {
        url += `&advSubType=${advSubType}`;
      }
      if (startDate) {
        url += `&startDate=${startDate}`;
      }
      if (endDate) {
        url += `&endDate=${endDate}`;
      }
      const response = await fetch(url);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch transactions');
      }
      const data = await response.json();
      setTransactions(data.transactions);
      setTotalCount(data.totalCount || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function getTransactionDescription(t: Transaction) {
    // More descriptive logic for transaction sentences
    switch (t.type) {
      case 'collection':
        return t.member
          ? `Collected from member ${t.member}`
          : 'Collection';
      case 'transfer':
      case 'PARTNER_TO_PARTNER':
        if (t.from_partner && t.to_partner) {
          return `${t.from_partner} transferred to ${t.to_partner} (PARTNER_TO_PARTNER)`;
        } else if (t.from_partner) {
          return `Transferred from ${t.from_partner} (PARTNER_TO_PARTNER)`;
        } else if (t.to_partner) {
          return `Transferred to ${t.to_partner} (PARTNER_TO_PARTNER)`;
        } else {
          return 'Partner transfer (PARTNER_TO_PARTNER)';
        }
      case 'loan_given':
        return t.member
          ? `Loan given to member ${t.member}`
          : 'Loan given';
      case 'loan_repaid':
        return t.member
          ? `Loan repaid by member ${t.member}`
          : 'Loan repaid';
      case 'record_amount':
      case 'RECORD_AMOUNT':
        if (t.from_partner && !t.to_partner) {
          return `Debited from ${t.from_partner} (RECORD_AMOUNT)`;
        } else if (!t.from_partner && t.to_partner) {
          return `Credited to ${t.to_partner} (RECORD_AMOUNT)`;
        } else if (t.from_partner && t.to_partner) {
          return `Transferred from ${t.from_partner} to ${t.to_partner} (RECORD_AMOUNT)`;
        } else {
          return 'Amount recorded (RECORD_AMOUNT)';
        }
      default:
        return t.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }
  }

  if (loading) return <div>Loading transactions...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  function getCrDr(t: Transaction): 'Credit' | 'Debit' | '-' {
    // 1. New Architecture: Use explicit transactionClass if available
    if (t.transactionClass) {
        if (t.transactionClass === 'CREDIT') return 'Credit';
        if (t.transactionClass === 'DEBIT') return 'Debit';
    }

    // 2. Fallback for old records or missing class
    // Special handling for PARTNER_TO_PARTNER transactions
    if (t.type === 'PARTNER_TO_PARTNER') {
      if (t.from_partner && !t.to_partner) return 'Debit';
      if (t.to_partner && !t.from_partner) return 'Credit';
    }

    // If partnerToUse is set, use partner context (legacy fallback)
    if (partnerToUse) {
      if (t.to_partner && t.to_partner === partnerToUse) return 'Credit';
      if (t.from_partner && t.from_partner === partnerToUse) return 'Debit';
    }
    
    // Fallback based on type
    const debitTypes = ['LOAN_DISBURSEMENT', 'AUCTION_PAYOUT'];
    const creditTypes = ['LOAN_REPAYMENT', 'CHIT_CONTRIBUTION', 'DOCUMENT_CHARGE'];
    if (debitTypes.includes(t.type)) return 'Debit';
    if (creditTypes.includes(t.type)) return 'Credit';
    
    // fallback: use amount sign
    if (typeof t.amount === 'number') {
      if (t.amount > 0) return 'Credit';
      if (t.amount < 0) return 'Debit';
    }
    return 'Credit';
  }

  function getMemberName(t: Transaction): string {
      // 1. Try to get from linked entities (Best Practice)
      if (t.repayment?.loan?.borrower?.name) return t.repayment.loan.borrower.name;
      if (t.contribution?.member?.globalMember?.name) return t.contribution.member.globalMember.name;
      if (t.auction?.winner?.globalMember?.name) return t.auction.winner.globalMember.name;
      if (t.loan?.borrower?.name) return t.loan.borrower.name;
      
      // 2. Fallback to extracting from Note (Legacy/Robustness)
      return extractMemberName(t.note);
  }

  // Helper to extract member name from note string (Legacy Fallback)
  function extractMemberName(note?: string): string {
    if (!note) return '-';
    // Pattern 1: Repayment from Arunkumar - Period 1
    let match = note.match(/Repayment from ([^-]+?)(?: -|$)/i);
    if (match) return match[1].trim();
    // Pattern 2: Loan disbursed to Arunkumar
    match = note.match(/Loan disbursed to ([^-]+?)(?: -|$)/i);
    if (match) return match[1].trim();
    // Pattern 3: Auction payout to ([^-]+?)(?: -|$)
    match = note.match(/Auction payout to ([^-]+?)(?: -|$)/i);
    if (match) return match[1].trim();
    // Pattern 4: Chit contribution from ([^-]+?)(?: -|$)
    match = note.match(/Chit contribution from ([^-]+?)(?: -|$)/i);
    if (match) return match[1].trim();
    // Pattern 5: fallback for 'from' or 'to' member
    match = note.match(/from ([^-]+?)(?: -|$)/i);
    if (match) return match[1].trim();
    match = note.match(/to ([^-]+?)(?: -|$)/i);
    if (match) return match[1].trim();
    return '-';
  }

  // Helper to get the partner name for the transaction
  function getPartnerName(t: Transaction): string {
    // 1. New Architecture: Use linked Partner name
    if (t.partner && t.partner.name) {
        return t.partner.name;
    }
    
    return t.action_performer || '-';
  }

  return (
    <div className="bg-white rounded shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Recent Transactions</h2>
        <div className="flex items-center space-x-3">
          {/* Recalculate All Balances Button */}
          <button
            onClick={() => setShowRecalculateModal(true)}
            disabled={recalculating}
            className={`flex items-center px-3 py-1 text-sm rounded-md transition duration-300 ${
              recalculating 
                ? 'bg-gray-400 text-gray-700 cursor-not-allowed' 
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
            title="Recalculate all transaction balances"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 mr-1 ${recalculating ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
            {recalculating ? 'Recalculating...' : 'Recalculate All'}
          </button>

          <div className="text-sm text-gray-600">
            {totalCount > 0 && `${totalCount} total transactions`}
          </div>
        </div>
      </div>

      {/* Note Modal/Tooltip */}
      {noteModal && (
        <div
          className="fixed z-50 left-0 top-0 w-screen h-screen flex items-center justify-center bg-black bg-opacity-40"
          onClick={() => setNoteModal(null)}
        >
          <div
            className="bg-gray-800 text-white text-sm rounded px-6 py-4 shadow-lg max-w-xs break-words text-center whitespace-pre-line"
            style={{ zIndex: 1001 }}
            onClick={e => e.stopPropagation()}
          >
            {noteModal.note}
          </div>
        </div>
      )}

      {/* Recalculate Confirmation Modal */}
      {showRecalculateModal && (
        <div
          className="fixed z-50 left-0 top-0 w-screen h-screen flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => !recalculating && setShowRecalculateModal(false)}
        >
          <div
            className="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4 p-6"
            style={{ zIndex: 1001 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center mb-4">
              <svg
                className="h-6 w-6 text-blue-600 mr-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <h3 className="text-lg font-bold text-gray-900">Recalculate All Balances</h3>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-700 mb-3">
                This will recalculate all transaction balances from scratch. This process will:
              </p>
              <ul className="list-disc list-inside text-gray-600 text-sm space-y-1 ml-2">
                <li>Process all your transactions in chronological order</li>
                <li>Recalculate partner balances</li>
                <li>Update total balance for each transaction</li>
                <li>Fix any balance inconsistencies</li>
              </ul>
              <p className="text-gray-700 mt-3 font-semibold">
                Do you want to proceed (Only use if any transaction deleted)?
              </p>
            </div>

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowRecalculateModal(false)}
                disabled={recalculating}
                className={`px-4 py-2 text-sm font-medium rounded-md transition duration-300 ${
                  recalculating
                    ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  try {
                    setRecalculating(true);
                    const response = await fetch('/api/recalculate-balances', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' }
                    });
                    
                    if (response.ok) {
                      const data = await response.json();
                      setRecalculateResult({
                        success: true,
                        message: 'Balance recalculation completed successfully!',
                        details: `Transactions processed: ${data.transactionsProcessed}\nFinal total balance: ₹${data.finalTotalBalance?.toLocaleString() || '0'}`
                      });
                      // Trigger refresh of the transaction list
                      fetchTransactions();
                    } else {
                      const error = await response.json();
                      setRecalculateResult({
                        success: false,
                        message: 'Failed to recalculate balances',
                        details: error.error || error.details || 'Unknown error occurred'
                      });
                    }
                  } catch (error) {
                    console.error('Error recalculating balances:', error);
                    setRecalculateResult({
                      success: false,
                      message: 'Failed to recalculate balances',
                      details: 'Please try again.'
                    });
                  } finally {
                    setRecalculating(false);
                  }
                }}
                disabled={recalculating}
                className={`px-4 py-2 text-sm font-medium rounded-md transition duration-300 ${
                  recalculating
                    ? 'bg-blue-400 text-white cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {recalculating ? (
                  <span className="flex items-center">
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Recalculating...
                  </span>
                ) : (
                  'Yes, Recalculate'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recalculate Result Modal */}
      {recalculateResult && (
        <div
          className="fixed z-50 left-0 top-0 w-screen h-screen flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => {
            setRecalculateResult(null);
            setShowRecalculateModal(false);
          }}
        >
          <div
            className="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4 p-6"
            style={{ zIndex: 1001 }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center mb-4">
              {recalculateResult.success ? (
                <svg
                  className="h-8 w-8 text-green-600 mr-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              ) : (
                <svg
                  className="h-8 w-8 text-red-600 mr-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              )}
              <h3 className={`text-lg font-bold ${recalculateResult.success ? 'text-green-900' : 'text-red-900'}`}>
                {recalculateResult.success ? 'Success!' : 'Error'}
              </h3>
            </div>
            
            <div className="mb-6">
              <p className="text-gray-800 font-semibold mb-2">
                {recalculateResult.message}
              </p>
              {recalculateResult.details && (
                <p className="text-gray-600 text-sm whitespace-pre-line">
                  {recalculateResult.details}
                </p>
              )}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => {
                  setRecalculateResult(null);
                  setShowRecalculateModal(false);
                }}
                className="px-6 py-2 text-sm font-medium rounded-md bg-gray-600 text-white hover:bg-gray-700 transition duration-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {transactions.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No transactions found</p>
      ) : (
        <>
          <div className="overflow-x-auto w-full mb-6" style={{maxWidth: '85vw'}}>
            <table className="w-full min-w-[1400px] divide-y divide-gray-200 text-xs sm:text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <SortableTableHeader
                    label="Date"
                    sortKey="createdAt"
                    currentSortKey={sortConfig.key}
                    currentSortDirection={sortConfig.direction}
                    onSort={requestSort}
                    className="px-4 py-2"
                  />
                  <SortableTableHeader
                    label="Payment Date"
                    sortKey="date"
                    currentSortKey={sortConfig.key}
                    currentSortDirection={sortConfig.direction}
                    onSort={requestSort}
                    className="px-4 py-2"
                  />
                  <SortableTableHeader
                    label="Type"
                    sortKey="type"
                    currentSortKey={sortConfig.key}
                    currentSortDirection={sortConfig.direction}
                    onSort={requestSort}
                    className="px-4 py-2"
                  />
                  <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Member</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Partner</th>
                  <th className="px-4 py-2 text-center font-medium text-gray-500 uppercase tracking-wider">Cr/Dt</th>
                  <SortableTableHeader
                    label="Amount"
                    sortKey="amount"
                    currentSortKey={sortConfig.key}
                    currentSortDirection={sortConfig.direction}
                    onSort={requestSort}
                    className="px-4 py-2 text-right"
                  />
                  <SortableTableHeader
                    label="Partner Balance"
                    sortKey="partnerBalance"
                    currentSortKey={sortConfig.key}
                    currentSortDirection={sortConfig.direction}
                    onSort={requestSort}
                    className="px-4 py-2 text-right"
                  />
                  <SortableTableHeader
                    label="Total Balance"
                    sortKey="totalBalance"
                    currentSortKey={sortConfig.key}
                    currentSortDirection={sortConfig.direction}
                    onSort={requestSort}
                    className="px-4 py-2 text-right"
                  />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedTransactions.map((t: Transaction) => (
                  <tr
                    key={t.id}
                    className="hover:bg-gray-50 cursor-pointer group"
                    tabIndex={0}
                    onClick={() => {
                      if (!t.note) return;
                      if (noteModal && noteModal.id === t.id) {
                        setNoteModal(null);
                      } else {
                        setNoteModal({ id: t.id, note: t.note });
                      }
                    }}
                  >
                    <td className="px-4 py-2 whitespace-nowrap relative">
                      {formatDate(t.createdAt)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap relative">
                      {formatDate(t.date)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">{t.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{getMemberName(t)}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{getPartnerName(t)}</td>
                    {/* Removed Entered By column */}
                    <td className={
                      `px-4 py-2 whitespace-nowrap text-center font-semibold ` +
                      (getCrDr(t) === 'Credit'
                        ? 'text-green-600'
                        : getCrDr(t) === 'Debit'
                        ? 'text-red-600'
                        : 'text-blue-600')
                    }>
                      {getCrDr(t)}
                    </td>
                    <td className={
                      `px-4 py-2 whitespace-nowrap text-right font-semibold ` +
                      (getCrDr(t) === 'Credit'
                        ? 'text-green-600'
                        : getCrDr(t) === 'Debit'
                        ? 'text-red-600'
                        : 'text-blue-600')
                    }>
                      {formatCurrency(t.amount)}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-right font-medium text-gray-900">
                      {t.partnerBalance !== null && t.partnerBalance !== undefined 
                        ? formatCurrency(t.partnerBalance) 
                        : '-'}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-right font-bold text-blue-900">
                      {t.totalBalance !== null && t.totalBalance !== undefined 
                        ? formatCurrency(t.totalBalance) 
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          <div className="p-2 sm:p-6 border-t">
            <div className="flex flex-col md:flex-row justify-between items-center gap-2 md:gap-0">
              <div className="mb-2 md:mb-0 flex items-center">
                <p className="text-xs sm:text-sm text-gray-600 mr-2 sm:mr-4">
                  Showing {transactions.length} of {totalCount} transactions
                </p>
                <div className="flex items-center">
                  <label htmlFor="pageSize" className="text-xs sm:text-sm text-gray-600 mr-2">
                    Show:
                  </label>
                  <select
                    id="pageSize"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="border border-gray-300 rounded-md text-xs sm:text-sm py-1 pl-2 pr-8"
                  >
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0">
                <div>
                  <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className={`relative inline-flex items-center rounded-l-md px-2 py-2 ${
                        currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <span className="sr-only">First</span>
                      <span className="text-xs">First</span>
                    </button>
                    <button
                      onClick={() => setCurrentPage(Math.max(currentPage - 1, 1))}
                      disabled={currentPage === 1}
                      className={`relative inline-flex items-center px-2 py-2 ${
                        currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <span className="sr-only">Previous</span>
                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                      </svg>
                    </button>

                    {/* Page numbers */}
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum;
                      if (totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (currentPage <= 3) {
                        pageNum = i + 1;
                      } else if (currentPage >= totalPages - 2) {
                        pageNum = totalPages - 4 + i;
                      } else {
                        pageNum = currentPage - 2 + i;
                      }

                      return (
                        <button
                          key={pageNum}
                          onClick={() => setCurrentPage(pageNum)}
                          className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold ${
                            currentPage === pageNum
                              ? 'z-10 bg-green-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600'
                              : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-offset-0'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      onClick={() => setCurrentPage(Math.min(currentPage + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className={`relative inline-flex items-center px-2 py-2 ${
                        currentPage === totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <span className="sr-only">Next</span>
                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className={`relative inline-flex items-center rounded-r-md px-2 py-2 ${
                        currentPage === totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <span className="sr-only">Last</span>
                      <span className="text-xs">Last</span>
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default TransactionList;
