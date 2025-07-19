'use client';

import { useEffect, useState } from 'react';
import { formatCurrency } from '../../lib/formatUtils';
import { usePartner } from '../contexts/PartnerContext';

interface Transaction {
  id: number;
  type: string;
  amount: number;
  member?: string;
  from_partner?: string;
  to_partner?: string;
  action_performer: string;
  entered_by: string;
  date: string;
  note?: string;
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
  } = props;

  // If activePartner is undefined or 'ALL', treat as all partners
  const partnerToUse = activePartner && activePartner !== 'ALL' ? activePartner : null;
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [noteModal, setNoteModal] = useState(null as null | { id: number; note: string });


  useEffect(() => {
    fetchTransactions();
  }, [partnerToUse, refresh, currentPage, pageSize, filterType, filterMember, advType, advMember, advEntity, advSubType]);

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

  // Helper to determine Credit/Debit for Cr/Dt column
  function getCrDr(t: Transaction): 'Credit' | 'Debit' {
    // If partnerToUse is set, use partner context
    if (partnerToUse) {
      if (t.to_partner && t.to_partner === partnerToUse) return 'Credit';
      if (t.from_partner && t.from_partner === partnerToUse) return 'Debit';
      if (t.type === 'loan_repaid' || t.type === 'LOAN_REPAYMENT') return 'Credit';
      if (t.type === 'loan_given' || t.type === 'LOAN_DISBURSEMENT' || t.type === 'AUCTION_PAYOUT') return 'Debit';
    }
    // Fallback for all partners
    if (t.type === 'PARTNER_TO_PARTNER' || t.type === 'transfer') return '-';
    if (t.type && typeof t.type === 'string') {
      const debitTypes = ['loan_given', 'LOAN_DISBURSEMENT', 'expense', 'balance_adjustment', 'AUCTION_PAYOUT'];
      const creditTypes = ['loan_repaid', 'LOAN_REPAYMENT', 'collection', 'RECORD_AMOUNT'];
      if (debitTypes.includes(t.type)) return 'Debit';
      if (creditTypes.includes(t.type)) return 'Credit';
    }
    // fallback: use amount sign if type is unknown
    if (typeof t.amount === 'number') {
      if (t.amount > 0) return 'Credit';
      if (t.amount < 0) return 'Debit';
    }
    return 'Credit';
  }



  // Helper to extract member name from note string
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

  return (
    <div className="bg-white rounded shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Recent Transactions</h2>
        <div className="text-sm text-gray-600">
          {totalCount > 0 && `${totalCount} total transactions`}
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

      {transactions.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No transactions found</p>
      ) : (
        <>
          <div className="overflow-x-auto w-full mb-6" style={{maxWidth: '80vw'}}>
            <table className="w-full min-w-[900px] divide-y divide-gray-200 text-xs sm:text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  {/* Removed Description column */}
                  <th className="px-4 py-2 text-left font-medium text-gray-500 uppercase tracking-wider">Member</th>
                  {/* Removed Entered By column */}
                  <th className="px-4 py-2 text-center font-medium text-gray-500 uppercase tracking-wider">Cr/Dt</th>
                  <th className="px-4 py-2 text-right font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {transactions.map((t: Transaction) => (
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
                      {new Date(t.date).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap">{t.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</td>
                    <td className="px-4 py-2 whitespace-nowrap">{extractMemberName(t.note)}</td>
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
