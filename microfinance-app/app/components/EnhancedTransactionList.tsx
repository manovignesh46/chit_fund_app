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
}

interface FilterState {
  type: string;
  dateFrom: string;
  dateTo: string;
  search: string;
}

const TRANSACTION_TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'collection', label: 'Collections' },
  { value: 'transfer', label: 'Transfers' },
  { value: 'loan_given', label: 'Loans Given' },
  { value: 'loan_repaid', label: 'Loan Repayments' },
];

const TYPE_ICONS: Record<string, string> = {
  collection: '💰',
  transfer: '🔄',
  loan_given: '📤',
  loan_repaid: '📥',
};

const TYPE_COLORS: Record<string, string> = {
  collection: 'bg-green-100 text-green-800',
  transfer: 'bg-blue-100 text-blue-800',
  loan_given: 'bg-orange-100 text-orange-800',
  loan_repaid: 'bg-purple-100 text-purple-800',
};

export default function EnhancedTransactionList({ refresh }: TransactionListProps) {
  const { activePartner } = usePartner();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 10;

  const [filters, setFilters] = useState<FilterState>({
    type: '',
    dateFrom: '',
    dateTo: '',
    search: '',
  });

  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchTransactions();
  }, [activePartner, refresh, page, filters]);

  async function fetchTransactions() {
    try {
      setLoading(true);
      setError('');

      let url = `/api/transactions?page=${page}&pageSize=${pageSize}&partner=${activePartner}`;
      
      if (filters.type) url += `&type=${filters.type}`;
      if (filters.dateFrom) url += `&startDate=${filters.dateFrom}`;
      if (filters.dateTo) url += `&endDate=${filters.dateTo}`;

      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch transactions');
      }

      const data = await response.json();
      
      let filteredTransactions = data.transactions;

      // Client-side search filtering
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        filteredTransactions = filteredTransactions.filter((t: Transaction) =>
          t.member?.toLowerCase().includes(searchLower) ||
          t.note?.toLowerCase().includes(searchLower) ||
          t.type.toLowerCase().includes(searchLower)
        );
      }

      setTransactions(filteredTransactions);
      setTotalCount(data.totalCount);
      setTotalPages(data.totalPages);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function updateFilter(field: keyof FilterState, value: string) {
    setFilters(prev => ({ ...prev, [field]: value }));
    setPage(1); // Reset to first page when filtering
  }

  function clearFilters() {
    setFilters({
      type: '',
      dateFrom: '',
      dateTo: '',
      search: '',
    });
    setPage(1);
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
      default:
        return t.type;
    }
  }

  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  if (loading && page === 1) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Transaction History</h2>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center space-x-2 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.414A1 1 0 013 6.707V4z" />
            </svg>
            <span>Filters</span>
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="bg-gray-50 p-4 rounded-lg space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                <select
                  value={filters.type}
                  onChange={(e) => updateFilter('type', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  {TRANSACTION_TYPE_OPTIONS.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">From Date</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => updateFilter('dateFrom', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">To Date</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => updateFilter('dateTo', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => updateFilter('search', e.target.value)}
                  placeholder="Member, note, type..."
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={clearFilters}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="mt-4 text-sm text-gray-600">
          Showing {transactions.length} of {totalCount} transactions for {activePartner}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3 mb-4">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}

        {transactions.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-400 text-4xl mb-2">📊</div>
            <p className="text-gray-500">No transactions found</p>
            {(filters.type || filters.dateFrom || filters.dateTo || filters.search) && (
              <button
                onClick={clearFilters}
                className="mt-2 text-blue-600 hover:text-blue-800 text-sm"
              >
                Clear filters to see all transactions
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {transactions.map((t) => (
              <div key={t.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-lg">{TYPE_ICONS[t.type] || '📄'}</span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${TYPE_COLORS[t.type] || 'bg-gray-100 text-gray-800'}`}>
                        {t.type.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                    <div className="font-medium text-gray-900 mb-1">
                      {getTransactionDescription(t)}
                    </div>
                    <div className="text-sm text-gray-600">
                      {formatDate(t.date)} • Performed by: {t.action_performer}
                    </div>
                    {t.note && (
                      <div className="text-sm text-gray-500 mt-1 italic">
                        "{t.note}"
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-gray-900">
                      {formatCurrency(t.amount)}
                    </div>
                    <div className="text-xs text-gray-500">
                      by {t.entered_by}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Page {page} of {totalPages}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
