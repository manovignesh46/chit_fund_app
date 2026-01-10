"use client";

import { useState, useEffect } from "react";
import { memberAPI, loanAPI, chitFundAPI } from "../../lib/api";
import TransactionList from "../components/TransactionList";
import DateFilter from "../components/DateFilter";
import EmailExportModal from "../../components/EmailExportModal";
import BalanceSummary from "../components/BalanceSummary";
import TransactionSummary from "../components/TransactionSummary";
import MonthlyAggregationsCard from "../components/MonthlyAggregationsCard";
import { usePartner } from "../contexts/PartnerContext";
import { TRANSACTION_TYPES_CONFIG } from "../../config/config";
import {
  buildTransactionFilterParams,
  type TransactionFilters,
} from "../../lib/transactionFilterUtils";

export default function TransactionsPage() {
  const [refreshList, setRefreshList] = useState(false);
  const { selectedPartner, partners } = usePartner();
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

  // Debounce logic for member filter
  const [searchTerm, setSearchTerm] = useState("");
  
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setFilterMember(searchTerm);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  return (
    <div className="container mx-auto p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">Transactions</h1>

        {/* Balance Summary and Monthly Aggregations */}
        <BalanceSummary refreshTrigger={refreshList} />
        
        {/* Monthly Aggregations Card */}
        <MonthlyAggregationsCard 
          startDate={startDate}
          endDate={endDate}
          refreshTrigger={refreshList}
        />

        <div className="mb-2 flex flex-col md:flex-row md:items-end md:space-x-4 md:space-y-0 space-y-2">
          <div className="w-full md:w-1/3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Partner
            </label>
            <select
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              value={selectedPartnerId}
              onChange={(e) => setSelectedPartnerId(e.target.value)}
            >
              <option value="ALL">All Partners</option>
              {partners.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full md:w-1/3">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date Filter
            </label>
            <DateFilter onDateRangeChange={handleDateRangeChange} />
          </div>
        </div>
      </div>
      {/* Advanced Filter Toggle */}
      <div className="mb-4">
        <button
          className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm"
          onClick={() => setShowAdvanced((v) => !v)}
        >
          {showAdvanced ? "Hide Advanced Filter" : "Show Advanced Filter"}
        </button>
      </div>

      {/* Advanced Filter UI */}
      {showAdvanced && (
        <div className="mb-4 flex flex-col md:flex-row md:items-end md:space-x-4 md:space-y-0 space-y-2 bg-gray-50 p-4 rounded border">
          <div className="w-full md:w-1/5">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Type
            </label>
            <select
              value={advType}
              onChange={(e) => {
                setAdvType(e.target.value);
                setAdvEntity("");
                setAdvSubType("");
              }}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">Select Type</option>
              <option value="loan">Loan</option>
              <option value="chit">Chit Fund</option>
            </select>
          </div>
          <div className="w-full md:w-1/5">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Member
            </label>
            <select
              value={advMember}
              onChange={(e) => {
                setAdvMember(e.target.value);
                setAdvEntity("");
                setAdvSubType("");
              }}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            >
              <option value="">Select Member</option>
              {members.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </div>
          <div className="w-full md:w-1/5">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              {advType === "loan"
                ? "Loan"
                : advType === "chit"
                ? "Chit Fund"
                : "Entity"}
            </label>
            <select
              value={advEntity}
              onChange={(e) => {
                setAdvEntity(e.target.value);
                setAdvSubType("");
              }}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              disabled={!advType || !advMember || entityLoading}
            >
              <option value="">
                Select{" "}
                {advType === "loan"
                  ? "Loan"
                  : advType === "chit"
                  ? "Chit Fund"
                  : "Entity"}
              </option>
              {entities.map((ent: any) =>
                advType === "loan" ? (
                  <option key={ent.id} value={ent.id}>{`Loan #${ent.id} - ₹${
                    ent.amount?.toLocaleString?.() || ent.amount
                  }`}</option>
                ) : (
                  <option key={ent.id} value={ent.id}>
                    {ent.name || ent.title || `ID ${ent.id}`}
                  </option>
                )
              )}
            </select>
          </div>
          {/* Subtype dropdown */}
          <div className="w-full md:w-1/5">
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Subtype
            </label>
            <select
              value={advSubType}
              onChange={(e) => setAdvSubType(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              disabled={!advEntity}
            >
              <option value="">Select Subtype</option>
              {advType === "loan" && advEntity && (
                <>
                  <option value="disbursement">Disbursement</option>
                  <option value="repayment">Repayment</option>
                </>
              )}
              {advType === "chit" && advEntity && (
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
                setAdvType("");
                setAdvMember("");
                setAdvEntity("");
                setAdvSubType("");
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Filter by Transaction Type
          </label>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          >
            <option value="">All Types</option>
            {Object.entries(TRANSACTION_TYPES_CONFIG).map(([key, value]) => (
              <option key={value} value={value}>
                {key
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
        </div>

        <div className="w-full md:w-1/3">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Filter by Member
          </label>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Enter member name (auto-search)"
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
          />
        </div>
      </div>
      {/* ... */}

      {/* Export and Email Actions */}
      <div className="mb-4 flex justify-end space-x-2">
        <button
          onClick={handleExport}
          className="flex items-center px-4 py-2 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition duration-300"
          title="Export transactions to Excel"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Export
        </button>
        <button
          onClick={handleDatabaseExport}
          disabled={isExportingDB}
          className="flex items-center px-4 py-2 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-purple-400 disabled:cursor-not-allowed transition duration-300"
          title="Export complete database backup as ZIP"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
            />
          </svg>
          {isExportingDB ? 'Exporting...' : 'Export DB'}
        </button>
        <button
          onClick={() => setShowEmailModal(true)}
          className="flex items-center px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition duration-300"
          title="Email transactions data"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-4 w-4 mr-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          Email
        </button>
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
