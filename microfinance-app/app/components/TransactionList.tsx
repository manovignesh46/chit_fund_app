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
}

export default function TransactionList({
  refresh,
  page = 1,
  pageSize = 10,
}: TransactionListProps) {
  const { activePartner } = usePartner();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchTransactions();
  }, [activePartner, refresh, currentPage, pageSize]);

  async function fetchTransactions() {
    try {
      setLoading(true);
      // Show ALL transactions for the active partner (not just manual transfers)
      let url = `/api/transactions?page=${currentPage}&pageSize=${pageSize}&partner=${activePartner}`;

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
    switch (t.type) {
      case 'collection':
        return `Collection from ${t.member}`;
      case 'transfer':
        return `Transfer from ${t.from_partner} to ${t.to_partner}`;
      case 'loan_given':
        return `Loan given to ${t.member}`;
      case 'loan_repaid':
        return `Loan repayment from ${t.member}`;
      case 'record_amount':
        if (t.from_partner && !t.to_partner) {
          return `Amount debited from ${t.from_partner}`;
        } else if (!t.from_partner && t.to_partner) {
          return `Amount credited to ${t.to_partner}`;
        } else {
          return 'Amount recorded';
        }
      default:
        return t.type;
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
                    <div className="font-medium">{getTransactionDescription(t)}</div>
                    <div className="text-sm text-gray-600">
                      {new Date(t.date).toLocaleDateString()}
                    </div>
                    {t.note && (
                      <div className="text-sm text-gray-500 mt-1">{t.note}</div>
                    )}
                  </div>
                  <div className="font-medium">
                    {formatCurrency(t.amount)}
                  </div>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  Performed by: {t.action_performer} | Entered by: {t.entered_by}
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border rounded text-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
