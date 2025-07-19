'use client';


import { useState, useEffect } from 'react';
import { memberAPI, loanAPI, chitFundAPI } from '../../lib/api';
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

  // Advanced filter state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advType, setAdvType] = useState(''); // 'loan' or 'chit'
  const [advMember, setAdvMember] = useState('');
  const [advEntity, setAdvEntity] = useState(''); // loanId or chitFundId
  const [advSubType, setAdvSubType] = useState(''); // 'disbursement' | 'repayment' | 'contribution' | 'auction'
  const [members, setMembers] = useState<any[]>([]);
  const [entities, setEntities] = useState<any[]>([]);
  const [entityLoading, setEntityLoading] = useState(false);

  // Fetch all members on mount
  useEffect(() => {
    if (showAdvanced) {
      memberAPI.getAll(1, 1000).then(res => {
        setMembers(res.members || res.data || []);
      });
    }
  }, [showAdvanced]);

  // Fetch loans/chit funds for selected member and type
  useEffect(() => {
    if (!showAdvanced || !advType || !advMember) {
      setEntities([]);
      setAdvEntity('');
      return;
    }
    setEntityLoading(true);
    const fetchEntities = async () => {
      if (advType === 'loan') {
        const res = await loanAPI.getAll(1, 1000);
        // Filter loans by borrowerId (global member id)
        const filtered = (res.loans || res.data || []).filter((l: any) => l.borrowerId == advMember);
        setEntities(filtered);
      } else if (advType === 'chit') {
        // Use new API to get chit funds for the selected member
        const res = await fetch(`/api/chit-funds/by-member?globalMemberId=${advMember}`);
        const data = await res.json();
        setEntities(data.chitFunds || []);
      }
      setEntityLoading(false);
    };
    fetchEntities();
  }, [advType, advMember, showAdvanced]);

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
      {/* Advanced Filter Toggle */}
      <div className="mb-4">
        <button
          className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
          onClick={() => setShowAdvanced(v => !v)}
        >
          {showAdvanced ? 'Hide Advanced Filter' : 'Show Advanced Filter'}
        </button>
      </div>

      {/* Advanced Filter UI */}
      {showAdvanced && (
        <div className="mb-4 flex flex-col md:flex-row md:items-end md:space-x-4 md:space-y-0 space-y-2 bg-gray-50 p-4 rounded border">
          <div className="w-full md:w-1/5">
            <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
            <select
              value={advType}
              onChange={e => { setAdvType(e.target.value); setAdvEntity(''); setAdvSubType(''); }}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">Select Type</option>
              <option value="loan">Loan</option>
              <option value="chit">Chit Fund</option>
            </select>
          </div>
          <div className="w-full md:w-1/5">
            <label className="block text-xs font-medium text-gray-700 mb-1">Member</label>
            <select
              value={advMember}
              onChange={e => { setAdvMember(e.target.value); setAdvEntity(''); setAdvSubType(''); }}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              disabled={!advType}
            >
              <option value="">Select Member</option>
              {members.map((m: any) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          <div className="w-full md:w-1/5">
            <label className="block text-xs font-medium text-gray-700 mb-1">{advType === 'loan' ? 'Loan' : advType === 'chit' ? 'Chit Fund' : 'Entity'}</label>
            <select
              value={advEntity}
              onChange={e => { setAdvEntity(e.target.value); setAdvSubType(''); }}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              disabled={!advType || !advMember || entityLoading}
            >
              <option value="">Select {advType === 'loan' ? 'Loan' : advType === 'chit' ? 'Chit Fund' : 'Entity'}</option>
              {entities.map((ent: any) => (
                advType === 'loan'
                  ? <option key={ent.id} value={ent.id}>{`Loan #${ent.id} - ₹${ent.amount?.toLocaleString?.() || ent.amount}`}</option>
                  : <option key={ent.id} value={ent.id}>{ent.name || ent.title || `ID ${ent.id}`}</option>
              ))}
            </select>
          </div>
          {/* Subtype dropdown */}
          <div className="w-full md:w-1/5">
            <label className="block text-xs font-medium text-gray-700 mb-1">Subtype</label>
            <select
              value={advSubType}
              onChange={e => setAdvSubType(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              disabled={!advEntity}
            >
              <option value="">Select Subtype</option>
              {advType === 'loan' && advEntity && (
                <>
                  <option value="disbursement">Disbursement</option>
                  <option value="repayment">Repayment</option>
                </>
              )}
              {advType === 'chit' && advEntity && (
                <>
                  <option value="contribution">Contribution</option>
                  <option value="auction">Auction</option>
                </>
              )}
            </select>
          </div>
          {/* Clear button */}
          <div className="w-full md:w-1/5 flex items-end">
            <button
              className="w-full px-3 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
              onClick={() => {
                setAdvType('');
                setAdvMember('');
                setAdvEntity('');
                setAdvSubType('');
              }}
              type="button"
            >
              Clear
            </button>
          </div>
        </div>
      )}

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
        activePartner={selectedPartnerId}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        pageSize={pageSize}
        setPageSize={setPageSize}
        advType={showAdvanced ? advType : ''}
        advMember={showAdvanced ? advMember : ''}
        advEntity={showAdvanced ? advEntity : ''}
        advSubType={showAdvanced ? advSubType : ''}
      />
    </div>
  );
}
