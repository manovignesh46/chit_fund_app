"use client";

import { useState, useEffect } from "react";
import { memberAPI, loanAPI, chitFundAPI } from "../../lib/api";
import TransactionList from "../components/TransactionList";
import DateFilter from "../components/DateFilter";
import EmailExportModal from "../../components/EmailExportModal";
import TransactionSummary from "../components/TransactionSummary";
import MonthlyAggregationsCard from "../components/MonthlyAggregationsCard";
import PartnerBalanceCard from "../components/partners/PartnerBalanceCard";
import TransactionForm from "../components/TransactionForm";
import SwipeableTabs from "../components/SwipeableTabs";
import { usePartner } from "../contexts/PartnerContext";
import { TRANSACTION_TYPES_CONFIG } from "../../config/config";
import {
  buildTransactionFilterParams,
  type TransactionFilters,
} from "../../lib/transactionFilterUtils";

export default function TransactionsPage() {
  const [activeTab, setActiveTab] = useState("summary" as "summary" | "record-transactions");
  const [refreshList, setRefreshList] = useState(false);
  const { selectedPartner, partners, refreshPartners } = usePartner();
  const [partnersWithBalances, setPartnersWithBalances] = useState([] as { id: number; name: string; isActive: boolean; createdAt: string; balance?: number }[]);
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [selectedPartnerId, setSelectedPartnerId] = useState("ALL");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // Only show transaction history for the active/selected partner, with filter and pagination
  const [filterType, setFilterType] = useState("");
  const [filterMember, setFilterMember] = useState("");

  // Advanced filter state
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [advType, setAdvType] = useState(""); // 'loan' or 'chit'
  const [advMember, setAdvMember] = useState("");
  const [advEntity, setAdvEntity] = useState(""); // loanId or chitFundId
  const [advSubType, setAdvSubType] = useState(""); // 'disbursement' | 'repayment' | 'contribution' | 'auction'
  const [members, setMembers] = useState([] as any[]);
  const [entities, setEntities] = useState([] as any[]);
  const [entityLoading, setEntityLoading] = useState(false);

  // Date filter state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Email modal state
  const [showEmailModal, setShowEmailModal] = useState(false);
  
  // Database export state
  const [isExportingDB, setIsExportingDB] = useState(false);

  const fetchPartnersWithBalances = async () => {
    try {
      setLoadingBalances(true);
      const response = await fetch('/api/partners?includeBalances=true');
      if (!response.ok) throw new Error('Failed to fetch partner balances');
      const data = await response.json();
      setPartnersWithBalances(data.partners || []);
    } catch {
      setPartnersWithBalances(partners.map(p => ({ ...p, balance: 0 })));
    } finally {
      setLoadingBalances(false);
    }
  };

  const handlePartnerDelete = (partnerId: number) => {
    setPartnersWithBalances(prev => prev.filter(p => p.id !== partnerId));
    refreshPartners();
  };

  useEffect(() => {
    if (partners.length > 0) fetchPartnersWithBalances();
  }, [partners]);

  // Fetch all members on mount
  useEffect(() => {
    if (showAdvanced) {
      memberAPI.getAll(1, 1000).then((res) => {
        setMembers(res.members || res.data || []);
      });
    }
  }, [showAdvanced]);

  // Fetch loans/chit funds for selected member and type
  useEffect(() => {
    if (!showAdvanced || !advType || !advMember) {
      setEntities([]);
      setAdvEntity("");
      return;
    }
    setEntityLoading(true);
    const fetchEntities = async () => {
      if (advType === "loan") {
        const res = await loanAPI.getAll(1, 1000);
        // Filter loans by borrowerId (global member id)
        const filtered = (res.loans || res.data || []).filter(
          (l: any) => l.borrowerId == advMember
        );
        setEntities(filtered);
      } else if (advType === "chit") {
        // Use new API to get chit funds for the selected member
        const res = await fetch(
          `/api/chit-funds/by-member?globalMemberId=${advMember}`
        );
        const data = await res.json();
        setEntities(data.chitFunds || []);
      }
      setEntityLoading(false);
    };
    fetchEntities();
  }, [advType, advMember, showAdvanced]);

  // Handle date filter changes
  const handleDateRangeChange = (start?: string, end?: string) => {
    setStartDate(start || "");
    setEndDate(end || "");
  };

  // Handle export functionality
  const getCurrentFilters = (): TransactionFilters => ({
    selectedPartnerId,
    filterType,
    filterMember,
    startDate,
    endDate,
    showAdvanced,
    advType,
    advMember,
    advEntity,
    advSubType,
  });

  const handleExport = () => {
    const params = buildTransactionFilterParams(getCurrentFilters());
    const exportUrl = `/api/transactions/export?${params.toString()}`;
    window.open(exportUrl, "_blank");
  };

  const handleDatabaseExport = async () => {
    setIsExportingDB(true);
    try {
      const response = await fetch('/api/db-backup');
      
      if (!response.ok) {
        throw new Error('Database export failed');
      }
      
      // Get the filename from the response headers
      const contentDisposition = response.headers.get('content-disposition');
      const filename = contentDisposition
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : 'database-backup.zip';
      
      // Create blob and download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      // Show success message (you can implement a toast notification system)
      alert('Database backup downloaded successfully!');
    } catch (error) {
      console.error('Database export failed:', error);
      alert('Database export failed. Please try again.');
    } finally {
      setIsExportingDB(false);
    }
  };

  return (
    <div className="page-container">
      {/* Page header */}
      <div className="flex flex-row flex-wrap items-center justify-between gap-2 mb-4 sm:mb-6">
        <h1 className="page-title">Transactions</h1>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="btn-primary text-sm"
            title="Export transactions to Excel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export
          </button>
          <button
            onClick={handleDatabaseExport}
            disabled={isExportingDB}
            className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            title="Export database backup"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            {isExportingDB ? 'Exporting...' : 'Export DB'}
          </button>
          <button
            onClick={() => setShowEmailModal(true)}
            className="flex items-center px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-300"
            title="Email transactions data"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Email
          </button>
        </div>
      </div>

      <div>
      {/* Tab navigation */}
      <div className="border-b border-gray-200 dark:border-surface-border mb-4 sm:mb-6">
        <nav className="flex gap-0 -mb-px overflow-x-auto" aria-label="Transaction tabs">
          {(["summary", "record-transactions"] as const).map((tab) => {
            const labels = { summary: "Summary", "record-transactions": "Record Transactions" };
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-shrink-0 px-4 sm:px-6 py-3 text-sm font-medium border-b-2 transition-colors duration-150 whitespace-nowrap focus:outline-none ${
                  isActive
                    ? "border-green-600 text-green-700 dark:text-green-400 dark:border-green-400"
                    : "border-transparent text-gray-500 dark:text-theme-muted hover:text-gray-700 dark:hover:text-theme-secondary hover:border-gray-300"
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab panels (swipeable on mobile) */}
      <SwipeableTabs
        tabs={["summary", "record-transactions"] as const}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        {/* Summary panel */}
        <div className="space-y-4 sm:space-y-6">
          {/* Balance cards: Total + per-partner */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-semibold text-gray-700 dark:text-theme-secondary uppercase tracking-wide">Partner Balances</h2>
              {loadingBalances && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600" />
                  Loading...
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Total Balance card */}
              {(() => {
                const total = partnersWithBalances.reduce((sum, p) => sum + (p.balance || 0), 0);
                const isPositive = total >= 0;
                return (
                  <div className="themed-card p-3 border-l-4 border-purple-500 flex flex-col items-start gap-2 min-w-[180px] max-w-xs h-32 justify-between">
                    <div className="flex items-center justify-between w-full mb-1">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-theme-primary truncate">Total</h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">All</span>
                    </div>
                    <div className="flex items-center justify-between w-full mt-2">
                      <span className="text-xs text-gray-700 dark:text-theme-secondary">Balance:</span>
                      <span className={`text-base font-bold ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                        {isPositive ? '+' : ''}{new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(total)}
                      </span>
                    </div>
                  </div>
                );
              })()}
              {/* Per-partner cards */}
              {partnersWithBalances.map((partner) => (
                <PartnerBalanceCard key={partner.id} partner={partner} onDelete={handlePartnerDelete} />
              ))}
            </div>
          </div>

          <MonthlyAggregationsCard
            startDate={startDate}
            endDate={endDate}
            refreshTrigger={refreshList}
          />

          {/* Filters row */}
          <div className="themed-card p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-2 sm:flex sm:flex-row gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 dark:text-theme-secondary mb-1">Partner</label>
                <select className="themed-input w-full text-sm" value={selectedPartnerId} onChange={(e) => setSelectedPartnerId(e.target.value)}>
                  <option value="ALL">All Partners</option>
                  {partners.map((p) => (
                    <option key={p.id} value={p.name}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 dark:text-theme-secondary mb-1">Date Filter</label>
                <DateFilter onDateRangeChange={handleDateRangeChange} />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 dark:text-theme-secondary mb-1">Transaction Type</label>
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="themed-input w-full text-sm">
                  <option value="">All Types</option>
                  {Object.entries(TRANSACTION_TYPES_CONFIG).map(([key, value]) => (
                    <option key={value} value={value}>{key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-700 dark:text-theme-secondary mb-1">Member</label>
                <input
                  type="text"
                  value={filterMember}
                  onChange={(e) => setFilterMember(e.target.value)}
                  placeholder="Enter member name"
                  className="themed-input w-full text-sm"
                />
              </div>
            </div>

            {/* Advanced filter toggle */}
            <div>
              <button
                className="px-3 py-1.5 bg-gray-100 dark:bg-surface-elevated text-gray-700 dark:text-theme-secondary border border-gray-300 dark:border-surface-border rounded hover:bg-gray-200 dark:hover:bg-surface-hover text-xs"
                onClick={() => setShowAdvanced((v) => !v)}
              >
                {showAdvanced ? "Hide Advanced Filter" : "Show Advanced Filter"}
              </button>
            </div>

            {showAdvanced && (
              <div className="flex flex-col sm:flex-row flex-wrap gap-3 pt-2 border-t border-gray-200 dark:border-surface-border">
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-xs font-medium text-gray-700 dark:text-theme-secondary mb-1">Type</label>
                  <select value={advType} onChange={(e) => { setAdvType(e.target.value); setAdvEntity(""); setAdvSubType(""); }} className="themed-input w-full text-sm">
                    <option value="">Select Type</option>
                    <option value="loan">Loan</option>
                    <option value="chit">Chit Fund</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-xs font-medium text-gray-700 dark:text-theme-secondary mb-1">Member</label>
                  <select value={advMember} onChange={(e) => { setAdvMember(e.target.value); setAdvEntity(""); setAdvSubType(""); }} className="themed-input w-full text-sm">
                    <option value="">Select Member</option>
                    {members.map((m: any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-xs font-medium text-gray-700 dark:text-theme-secondary mb-1">{advType === "loan" ? "Loan" : advType === "chit" ? "Chit Fund" : "Entity"}</label>
                  <select value={advEntity} onChange={(e) => { setAdvEntity(e.target.value); setAdvSubType(""); }} className="themed-input w-full text-sm" disabled={!advType || !advMember || entityLoading}>
                    <option value="">Select {advType === "loan" ? "Loan" : advType === "chit" ? "Chit Fund" : "Entity"}</option>
                    {entities.map((ent: any) =>
                      advType === "loan"
                        ? <option key={ent.id} value={ent.id}>{`Loan #${ent.id} - ₹${ent.amount?.toLocaleString?.() || ent.amount}`}</option>
                        : <option key={ent.id} value={ent.id}>{ent.name || ent.title || `ID ${ent.id}`}</option>
                    )}
                  </select>
                </div>
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-xs font-medium text-gray-700 dark:text-theme-secondary mb-1">Subtype</label>
                  <select value={advSubType} onChange={(e) => setAdvSubType(e.target.value)} className="themed-input w-full text-sm" disabled={!advEntity}>
                    <option value="">Select Subtype</option>
                    {advType === "loan" && advEntity && (<><option value="disbursement">Disbursement</option><option value="repayment">Repayment</option></>)}
                    {advType === "chit" && advEntity && (<><option value="contribution">Contribution</option><option value="auction">Auction</option></>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[100px] flex items-end">
                  <button className="btn-neutral w-full px-3 py-2 rounded text-sm" onClick={() => { setAdvType(""); setAdvMember(""); setAdvEntity(""); setAdvSubType(""); }} type="button">Clear</button>
                </div>
              </div>
            )}
          </div>

          <TransactionSummary
            selectedPartnerId={selectedPartnerId}
            filterType={filterType}
            filterMember={filterMember}
            advType={showAdvanced ? advType : ""}
            advMember={showAdvanced ? advMember : ""}
            advEntity={showAdvanced ? advEntity : ""}
            advSubType={showAdvanced ? advSubType : ""}
            startDate={startDate}
            endDate={endDate}
            refreshTrigger={refreshList}
          />

          <TransactionList
            refresh={refreshList}
            filterType={filterType}
            filterMember={filterMember}
            activePartner={selectedPartnerId}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            pageSize={pageSize}
            setPageSize={setPageSize}
            advType={showAdvanced ? advType : ""}
            advMember={showAdvanced ? advMember : ""}
            advEntity={showAdvanced ? advEntity : ""}
            advSubType={showAdvanced ? advSubType : ""}
            startDate={startDate}
            endDate={endDate}
          />
        </div>

        {/* Record Transactions panel */}
        <div className="themed-card p-4 sm:p-6 max-w-xl">
          <h2 className="text-lg font-semibold mb-4">Record Manual Transaction</h2>
          <TransactionForm onSuccess={fetchPartnersWithBalances} />
        </div>
      </SwipeableTabs>
      </div>

      {/* Email Export Modal */}
      <EmailExportModal
        isOpen={showEmailModal}
        onClose={() => setShowEmailModal(false)}
        exportType="Transactions"
        startDate={startDate}
        endDate={endDate}
        transactionFilters={getCurrentFilters()}
      />
    </div>
  );
}
