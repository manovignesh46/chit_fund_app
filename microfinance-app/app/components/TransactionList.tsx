'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { formatCurrency } from '../../lib/formatUtils';
import { transactionAPI } from '../../lib/transactionAPI';
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

  useEffect(() => {
    fetchTransactions();
  }, [activePartner, refresh, page, pageSize]);

  async function fetchTransactions() {
    try {
      setLoading(true);
      const data = await transactionAPI.getAll(page, pageSize, undefined, activePartner);
      setTransactions(data.transactions);
    } catch (err) {
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
      default:
        return t.type;
    }
  }

  if (loading) return <div>Loading transactions...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div className="bg-white rounded shadow p-4">
      <h2 className="text-xl font-bold mb-4">Recent Transactions</h2>
      {transactions.length === 0 ? (
        <p>No transactions found</p>
      ) : (
        <div className="space-y-4">
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
      )}
    </div>
  );
}
