'use client';


import { useState } from 'react';
import TransactionList from '../components/TransactionList';
import { usePartner } from '../contexts/PartnerContext';
import { TRANSACTION_TYPES_CONFIG } from '../../config/config';

export default function TransactionsPage() {
  const [refreshList, setRefreshList] = useState(false);
  const { selectedPartner, partners } = usePartner();
  const [selectedPartnerId, setSelectedPartnerId] = useState('ALL');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // Only show transaction history for the active/selected partner, with filter and pagination
  const [filterType, setFilterType] = useState('');
  const [filterMember, setFilterMember] = useState('');

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">Transactions</h1>
        <div className="mb-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Partner</label>
          <select
            className="w-full max-w-xs px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
            value={selectedPartnerId}
            onChange={e => setSelectedPartnerId(e.target.value)}
          >
            <option value="ALL">All Partners</option>
            {partners.map((p) => (
              <option key={p.id} value={p.name}>{p.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="mb-4 w-full flex flex-col md:flex-row md:items-end md:space-x-4 md:space-y-0 space-y-2">
        <div className="w-full md:w-1/3">
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Transaction Type</label>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="">All Types</option>
            {Object.entries(TRANSACTION_TYPES_CONFIG).map(([key, value]) => (
              <option key={value} value={value}>{key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
            ))}
          </select>
        </div>
        <div className="w-full md:w-1/3">
          <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Member</label>
          <input
            type="text"
            value={filterMember}
            onChange={e => setFilterMember(e.target.value)}
            placeholder="Enter member name"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
      </div>

      <TransactionList
        refresh={refreshList}
        filterType={filterType}
        filterMember={filterMember}
        activePartner={selectedPartnerId !== 'ALL' ? selectedPartnerId : undefined}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        pageSize={pageSize}
        setPageSize={setPageSize}
      />
    </div>
  );
}
