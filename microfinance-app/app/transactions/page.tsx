'use client';

import { useState } from 'react';
import TransactionForm from '../components/TransactionForm';
import TransactionList from '../components/TransactionList';
import { PartnerSelector } from '../contexts/PartnerContext';

export default function TransactionsPage() {
  const [refreshList, setRefreshList] = useState(false);

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">Partner Transactions</h1>
        <div className="mb-4 max-w-xs">
          <PartnerSelector />
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <TransactionForm
            onSuccess={() => setRefreshList(prev => !prev)}
          />
        </div>
        <div>
          <TransactionList
            refresh={refreshList}
          />
        </div>
      </div>
    </div>
  );
}
