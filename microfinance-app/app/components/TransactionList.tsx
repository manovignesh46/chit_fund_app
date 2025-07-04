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
  } = props;
  const partnerToUse = activePartner;
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);



  useEffect(() => {
    fetchTransactions();
  }, [partnerToUse, refresh, currentPage, pageSize, filterType, filterMember, advType, advMember, advEntity]);

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
      // Advanced filter logic
      if (advType && advMember && advEntity) {
        url += `&advType=${advType}&advMember=${advMember}&advEntity=${advEntity}`;
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

  return (
    <div className="bg-white rounded shadow p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Recent Transactions</h2>
        <div className="text-sm text-gray-600">
          {totalCount > 0 && `${totalCount} total transactions`}
        </div>
      </div>

      {transactions.length === 0 ? (
        <p className="text-gray-500 text-center py-8">No transactions found</p>
      ) : (
        <>
          <div className="space-y-4 mb-6">
            {transactions.map((t) => (
              <div key={t.id} className="border-b pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-medium">
                      {getTransactionDescription(t)}
                    </div>
                    <div className="text-sm text-gray-600">
                      {new Date(t.date).toLocaleDateString()}
                    </div>
                    {t.note && (
                      <div className="text-sm text-gray-500 mt-1">{t.note}</div>
                    )}
                  </div>
                  <div className="font-medium">
                    <span
                      className={(() => {
                        if (partnerToUse) {
                          if (t.to_partner && t.to_partner === partnerToUse) return 'text-green-600 font-bold';
                          if (t.from_partner && t.from_partner === partnerToUse) return 'text-red-600 font-bold';
                          if (t.type === 'loan_repaid' || t.type === 'LOAN_REPAYMENT') return 'text-green-600 font-bold';
                          if (t.type === 'loan_given' || t.type === 'LOAN_DISBURSEMENT') return 'text-red-600 font-bold';
                          return 'text-gray-900';
                        } else {
                          // All Partners: PARTNER_TO_PARTNER is blue
                          if (t.type === 'PARTNER_TO_PARTNER' || t.type === 'transfer') return 'text-blue-600 font-bold';
                          if (typeof t.amount === 'number') {
                            if (t.amount > 0) return 'text-green-600 font-bold';
                            if (t.amount < 0) return 'text-red-600 font-bold';
                          }
                          return 'text-gray-900';
                        }
                      })()}
                    >
                      {formatCurrency(t.amount)}
                    </span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Performed by: {t.action_performer} | Entered by: {t.entered_by}
                </div>
              </div>
            ))}
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
