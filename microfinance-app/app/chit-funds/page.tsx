// @ts-nocheck
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ChitFundsListSkeleton } from '../components/skeletons';
import { ArrowDownTrayIcon, TrashIcon, PlusCircleIcon, ArrowPathIcon, BanknotesIcon, UserGroupIcon, ClockIcon } from '@heroicons/react/24/solid';
import { BuildingLibraryIcon } from '@heroicons/react/24/outline';
import ActionDropdown, { ActionItem } from '../components/ui/ActionDropdown';
import { formatDate as formatDateUtil } from '../../lib/formatUtils';
import SortableTableHeader, { useSortableData } from '../components/common/SortableTableHeader';
import PageSectionHeader from '../components/layout/PageSectionHeader';
import StatsCard from '../components/layout/StatsCard';
import FilterBar from '../components/layout/FilterBar';

// Define interfaces
interface ChitFund {
  id: number;
  name: string;
  totalAmount: number;
  monthlyContribution: number;
  duration: number;
  membersCount: number;
  status: string;
  startDate: string;
  currentMonth: number;
  nextAuctionDate: string | null;
  hasPendingContribution?: boolean;
  _count?: {
    members: number;
    auctions: number;
  };
}

interface PaginatedResponse {
  chitFunds: ChitFund[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function ChitFundsPage() {
  const router = useRouter();
  const [chitFunds, setChitFunds] = useState<ChitFund[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Selection state
  const [selectedChitFunds, setSelectedChitFunds] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [chitFundToDelete, setChitFundToDelete] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  // Bulk delete modal state
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);
  const [bulkDeleteSuccess, setBulkDeleteSuccess] = useState<string | null>(null);

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  // Status filter state
  const [statusFilter, setStatusFilter] = useState<string>('Active');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    active: 0,
    upcoming: 0,
    totalMembers: 0,
    totalValue: 0,
  });

  // Add sorting functionality
  const { items: sortedChitFunds, sortConfig, requestSort } = useSortableData(chitFunds);
  const filteredChitFunds = sortedChitFunds.filter((fund) =>
    !searchQuery || fund.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Fetch chit funds function
  const fetchChitFunds = async () => {
    try {
      setLoading(true);
      let url = `/api/chit-funds/consolidated?action=list&page=${currentPage}&pageSize=${pageSize}`;

      // Add status filter if selected
      if (statusFilter) {
        url += `&status=${statusFilter}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch chit funds');
      }

      const data: PaginatedResponse = await response.json();
      console.log('Fetched chit funds:', data);

      // Check if the response has pagination metadata
      if (data.chitFunds && Array.isArray(data.chitFunds)) {
        setChitFunds(data.chitFunds);
        setTotalCount(data.totalCount || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        // Fallback for backward compatibility
        setChitFunds(Array.isArray(data) ? data : []);
        setTotalPages(1);
        setTotalCount(Array.isArray(data) ? data.length : 0);
      }

      // Clear selected chit funds when page changes
      setSelectedChitFunds([]);
      setSelectAll(false);
      setError(null);
    } catch (err) {
      console.error('Error fetching chit funds:', err);
      setError('Failed to load chit funds. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchChitFunds();
  }, [currentPage, pageSize, statusFilter]);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [activeRes, upcomingRes, allRes] = await Promise.all([
          fetch('/api/chit-funds/consolidated?action=list&page=1&pageSize=1&status=Active'),
          fetch('/api/chit-funds/consolidated?action=list&page=1&pageSize=1&status=Upcoming'),
          fetch('/api/chit-funds/consolidated?action=list&page=1&pageSize=500&status=Active'),
        ]);
        const activeData = await activeRes.json();
        const upcomingData = await upcomingRes.json();
        const allData = await allRes.json();
        const funds = allData.chitFunds || [];
        setStats({
          active: activeData.totalCount || 0,
          upcoming: upcomingData.totalCount || 0,
          totalMembers: funds.reduce((sum: number, f: ChitFund) => sum + (f._count?.members || f.membersCount || 0), 0),
          totalValue: funds.reduce((sum: number, f: ChitFund) => sum + (f.totalAmount || 0), 0),
        });
      } catch (err) {
        console.error('Error fetching chit fund stats:', err);
      }
    };
    fetchStats();
  }, []);

  // Handle selecting/deselecting a chit fund
  const handleSelectChitFund = (chitFundId: number) => {
    if (selectedChitFunds.includes(chitFundId)) {
      setSelectedChitFunds(selectedChitFunds.filter(id => id !== chitFundId));
      setSelectAll(false);
    } else {
      setSelectedChitFunds([...selectedChitFunds, chitFundId]);
      if (selectedChitFunds.length + 1 === chitFunds.length) {
        setSelectAll(true);
      }
    }
  };

  // Handle select all chit funds
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedChitFunds([]);
      setSelectAll(false);
    } else {
      setSelectedChitFunds(chitFunds.map(fund => fund.id));
      setSelectAll(true);
    }
  };

  // Handle delete chit fund
  const handleDeleteChitFund = (chitFundId: number) => {
    setChitFundToDelete(chitFundId);
    setShowDeleteModal(true);
    setDeleteError(null);
    setDeleteSuccess(null);
  };

  // Confirm delete chit fund
  const confirmDeleteChitFund = async () => {
    if (!chitFundToDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/chit-funds/consolidated?action=delete&id=${chitFundToDelete}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete chit fund');
      }

      // Show success message
      setDeleteSuccess('Chit fund deleted successfully');

      // Refresh data after a short delay
      setTimeout(() => {
        setShowDeleteModal(false);
        setChitFundToDelete(null);
        setDeleteSuccess(null);
        fetchChitFunds();
      }, 1500);
    } catch (error) {
      console.error('Error deleting chit fund:', error);
      setDeleteError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle bulk delete chit funds
  const handleBulkDeleteClick = () => {
    if (selectedChitFunds.length === 0) return;
    setShowBulkDeleteModal(true);
    setBulkDeleteError(null);
    setBulkDeleteSuccess(null);
  };

  // Confirm bulk delete chit funds
  const confirmBulkDeleteChitFunds = async () => {
    if (selectedChitFunds.length === 0) return;

    setIsBulkDeleting(true);
    setBulkDeleteError(null);

    try {
      // Delete chit funds one by one
      const deletePromises = selectedChitFunds.map(chitFundId =>
        fetch(`/api/chit-funds/consolidated?action=delete&id=${chitFundId}`, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
        })
      );

      const results = await Promise.allSettled(deletePromises);
      const failedCount = results.filter(result => result.status === 'rejected').length;

      if (failedCount > 0) {
        throw new Error(`Failed to delete ${failedCount} chit funds`);
      }

      // Show success message
      setBulkDeleteSuccess(`${selectedChitFunds.length} chit funds deleted successfully`);

      // Refresh data after a short delay
      setTimeout(() => {
        setShowBulkDeleteModal(false);
        setSelectedChitFunds([]);
        setSelectAll(false);
        setBulkDeleteSuccess(null);
        fetchChitFunds();
      }, 1500);
    } catch (error) {
      console.error('Error deleting chit funds:', error);
      setBulkDeleteError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Handle export selected chit funds
  const handleExportSelected = async () => {
    if (selectedChitFunds.length === 0 || isExporting) return;

    try {
      setIsExporting(true);

      // If only one chit fund is selected, use the single export endpoint
      if (selectedChitFunds.length === 1) {
        const response = await fetch(`/api/chit-funds/${selectedChitFunds[0]}/export`, {
          method: 'GET',
        });

        if (!response.ok) {
          throw new Error('Failed to export chit fund');
        }

        // Get the blob from the response
        const blob = await response.blob();

        // Generate filename with current date
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
        const filename = `ChitFund_Details_${dateStr}.xlsx`;

        // Create a URL for the blob
        const url = window.URL.createObjectURL(blob);

        // Create a temporary link element
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;

        // Append to the document and trigger a click
        document.body.appendChild(a);
        a.click();

        // Clean up
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } else {
        // Multiple chit funds selected, use the bulk export endpoint
        const response = await fetch('/api/chit-funds/export', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chitFundIds: selectedChitFunds,
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to export chit funds');
        }

        // Get the blob from the response
        const blob = await response.blob();

        // Generate filename with current date
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
        const filename = `ChitFunds_Export_${dateStr}.xlsx`;

        // Create a URL for the blob
        const url = window.URL.createObjectURL(blob);

        // Create a temporary link element
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;

        // Append to the document and trigger a click
        document.body.appendChild(a);
        a.click();

        // Clean up
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Error exporting chit funds:', error);
      alert('Failed to export chit funds. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string | null) => {
    return formatDateUtil(dateString);
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800 dark:status-badge-active';
      case 'Upcoming':
        return 'bg-yellow-100 text-yellow-800 dark:status-badge-upcoming';
      case 'Completed':
        return 'bg-gray-100 text-gray-800 dark:status-badge-completed';
      default:
        return 'bg-gray-100 text-gray-800 dark:status-badge-completed';
    }
  };

  return (
    <div className="page-container">
      <PageSectionHeader
        icon={<BuildingLibraryIcon className="w-5 h-5" />}
        title="Chit Funds"
        subtitle="Manage active chit fund schemes and auctions"
        actions={
          <>
            <button
              onClick={() => fetchChitFunds()}
              className="btn-secondary"
              aria-label="Refresh"
            >
              <ArrowPathIcon className="h-4 w-4" />
            </button>
            {selectedChitFunds.length > 0 && (
              <>
                <button
                  onClick={handleExportSelected}
                  disabled={isExporting}
                  className="btn-secondary disabled:opacity-50"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">{isExporting ? 'Exporting...' : 'Export'}</span>
                </button>
                <button
                  onClick={handleBulkDeleteClick}
                  className="btn-secondary text-red-400 hover:text-red-300"
                >
                  <TrashIcon className="h-4 w-4" />
                  <span className="hidden sm:inline">Delete</span>
                </button>
              </>
            )}
            <Link href="/chit-fund-templates" className="btn-secondary">
              <span className="hidden sm:inline">Templates</span>
              <span className="sm:hidden">Tmpl</span>
            </Link>
            <Link href="/chit-funds/new" className="btn-primary">
              <PlusCircleIcon className="h-4 w-4" />
              <span>Add Chit Fund</span>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatsCard
          label="Active Chit Funds"
          value={stats.active}
          icon={<BuildingLibraryIcon className="w-4 h-4" />}
        />
        <StatsCard
          label="Total Value"
          value={formatCurrency(stats.totalValue)}
          icon={<BanknotesIcon className="w-4 h-4" />}
        />
        <StatsCard
          label="Total Members"
          value={stats.totalMembers.toLocaleString()}
          icon={<UserGroupIcon className="w-4 h-4" />}
        />
        <StatsCard
          label="Upcoming"
          value={stats.upcoming}
          icon={<ClockIcon className="w-4 h-4" />}
        />
      </div>

      <FilterBar
        searchValue={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder="Search chit funds..."
        filters={[
          {
            id: 'statusFilter',
            value: statusFilter,
            onChange: (value) => {
              setStatusFilter(value);
              setCurrentPage(1);
            },
            options: [
              { value: '', label: 'All Status' },
              { value: 'Active', label: 'Active' },
              { value: 'Upcoming', label: 'Upcoming' },
              { value: 'Completed', label: 'Completed' },
            ],
          },
        ]}
      />

      {loading ? (
        <ChitFundsListSkeleton />
      ) : error ? (
        <div className="dark-card alert-error text-sm">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      ) : chitFunds.length === 0 ? (
        <div className="dark-card p-8 text-center">
          <p className="text-gray-400 mb-4">
            {statusFilter ? `No chit funds found with status "${statusFilter}".` : 'No chit funds found.'}
          </p>
          {!statusFilter && (
            <Link href="/chit-funds/new" className="btn-primary">
              Create Your First Chit Fund
            </Link>
          )}
        </div>
      ) : (
        <div className="dark-card overflow-hidden">
          {selectedChitFunds.length > 0 && (
            <div className="px-4 py-3 border-b border-gray-200 dark:border-surface-border">
              <span className="text-sm text-gray-400">{selectedChitFunds.length} selected</span>
            </div>
          )}

          <div className="table-shell">
            <table className="dark-table" style={{ minWidth: '700px' }}>
              <thead>
                <tr>
                  <th scope="col">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        className="h-4 w-4 text-blue-600 border-gray-200 dark:border-surface-border bg-gray-50 dark:bg-surface-elevated rounded focus:ring-blue-500"
                      />
                    </div>
                  </th>
                  <SortableTableHeader
                    label="Name"
                    sortKey="name"
                    currentSortKey={sortConfig.key}
                    currentSortDirection={sortConfig.direction}
                    onSort={requestSort}
                  />
                  <SortableTableHeader
                    label="Total Amount"
                    sortKey="totalAmount"
                    currentSortKey={sortConfig.key}
                    currentSortDirection={sortConfig.direction}
                    onSort={requestSort}
                  />
                  <SortableTableHeader
                    label="Monthly Contribution"
                    sortKey="monthlyContribution"
                    currentSortKey={sortConfig.key}
                    currentSortDirection={sortConfig.direction}
                    onSort={requestSort}
                  />
                  <SortableTableHeader
                    label="Duration (Completed/Total)"
                    sortKey="duration"
                    currentSortKey={sortConfig.key}
                    currentSortDirection={sortConfig.direction}
                    onSort={requestSort}
                  />
                  <SortableTableHeader
                    label="Members (Auctioned/Total)"
                    sortKey="membersCount"
                    currentSortKey={sortConfig.key}
                    currentSortDirection={sortConfig.direction}
                    onSort={requestSort}
                  />
                  <SortableTableHeader
                    label="Status"
                    sortKey="status"
                    currentSortKey={sortConfig.key}
                    currentSortDirection={sortConfig.direction}
                    onSort={requestSort}
                  />
                  <SortableTableHeader
                    label="Next Auction"
                    sortKey="nextAuctionDate"
                    currentSortKey={sortConfig.key}
                    currentSortDirection={sortConfig.direction}
                    onSort={requestSort}
                    className="px-6 py-3"
                  />
                  <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredChitFunds.map((fund) => (
                  <tr
                    key={fund.id}
                    className="cursor-pointer"
                    onClick={(e) => {
                      // Prevent navigation when clicking on checkbox or action buttons/links
                      if (
                        e.target instanceof HTMLInputElement ||
                        e.target instanceof HTMLButtonElement ||
                        (e.target instanceof HTMLElement &&
                          (e.target.closest('button') || e.target.closest('input') || e.target.closest('a')))
                      ) {
                        return;
                      }
                      router.push(`/chit-funds/${fund.id}`);
                    }}
                  >
                    <td className="whitespace-nowrap">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedChitFunds.includes(fund.id)}
                          onChange={() => handleSelectChitFund(fund.id)}
                          className="h-4 w-4 text-blue-600 border-gray-200 dark:border-surface-border bg-gray-50 dark:bg-surface-elevated rounded focus:ring-blue-500"
                        />
                      </div>
                    </td>
                    <td className="whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {fund.hasPendingContribution && (
                          <span
                            className="inline-block h-2 w-2 rounded-full bg-red-500 dark:bg-red-400 flex-shrink-0"
                            title="Pending contribution"
                          />
                        )}
                        <div className="text-sm font-medium text-gray-900 dark:text-theme-primary">{fund.name}</div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap">
                      <div className="text-sm">{formatCurrency(fund.totalAmount)}</div>
                    </td>
                    <td className="whitespace-nowrap">
                      <div className="text-sm">{formatCurrency(fund.monthlyContribution)}</div>
                    </td>
                    <td className="whitespace-nowrap">
                      <div className="text-sm">{fund.currentMonth || 0}/{fund.duration}</div>
                    </td>
                    <td className="whitespace-nowrap">
                      <div className="text-sm">{fund._count?.auctions || 0}/{fund._count?.members || 0}</div>
                    </td>
                    <td className="whitespace-nowrap">
                      <span className={getStatusColor(fund.status)}>
                        {fund.status.toLowerCase()}
                      </span>
                    </td>
                    <td className="whitespace-nowrap">
                      <div className="text-sm text-gray-400">{formatDate(fund.nextAuctionDate)}</div>
                    </td>
                    <td className="whitespace-nowrap text-sm font-medium">
                      <ActionDropdown
                        actions={[
                          {
                            label: 'Edit',
                            href: `/chit-funds/${fund.id}/edit`,
                            onClick: () => {},
                            icon: (
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path fill="currentColor" d="M16.862 3.487a2.25 2.25 0 113.182 3.182l-9.193 9.193a2.25 2.25 0 01-.708.471l-3.25 1.3a.75.75 0 01-.97-.97l1.3-3.25a2.25 2.25 0 01.471-.708l9.193-9.193zM19.5 6.75L17.25 4.5" />
                              </svg>
                            ),
                            className: 'text-blue-600 hover:text-blue-700'
                          },
                          {
                            label: 'Copy',
                            href: `/chit-funds/new?copy=${fund.id}`,
                            onClick: () => {},
                            icon: (
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                              </svg>
                            ),
                            className: 'text-indigo-600 hover:text-indigo-700'
                          },
                          {
                            label: 'Delete',
                            onClick: () => handleDeleteChitFund(fund.id),
                            icon: (
                              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            ),
                            className: 'text-red-600 hover:text-red-700'
                          }
                        ]}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          <div className="p-4 border-t border-gray-200 dark:border-surface-border">
            <div className="flex flex-col md:flex-row justify-between items-center gap-2 md:gap-0">
              <div className="mb-2 md:mb-0 flex items-center">
                <p className="text-xs sm:text-sm text-gray-400 mr-2 sm:mr-4">
                  Showing {filteredChitFunds.length} of {totalCount} chit funds
                </p>
                <div className="flex items-center">
                  <label htmlFor="pageSize" className="text-xs sm:text-sm text-gray-400 mr-2">
                    Show:
                  </label>
                  <select
                    id="pageSize"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="themed-input text-xs sm:text-sm py-1 pl-2 pr-8"
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
                  <nav className="isolate inline-flex -space-x-px rounded-lg" aria-label="Pagination">
                    <button
                      onClick={() => setCurrentPage(1)}
                      disabled={currentPage === 1}
                      className="pagination-bordered rounded-l-lg"
                    >
                      <span className="sr-only">First</span>
                      <span className="text-xs">First</span>
                    </button>
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="pagination-bordered border-y"
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
                          className={
                            currentPage === pageNum
                              ? 'pagination-page-active border-y border-blue-600'
                              : 'pagination-page border-y'
                          }
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="pagination-bordered border-y"
                    >
                      <span className="sr-only">Next</span>
                      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setCurrentPage(totalPages)}
                      disabled={currentPage === totalPages}
                      className="pagination-bordered rounded-r-lg"
                    >
                      <span className="sr-only">Last</span>
                      <span className="text-xs">Last</span>
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay">
          <div className="dark-card p-4 sm:p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4 text-white">Confirm Delete</h3>
            {deleteSuccess ? (
              <div className="alert-success mb-4">
                <p>{deleteSuccess}</p>
              </div>
            ) : (
              <>
                <p className="mb-4 text-gray-300">Are you sure you want to delete this chit fund? This action cannot be undone.</p>
                <p className="mb-4 text-red-400 font-semibold">Warning: This will also delete all members, contributions, and auctions associated with this chit fund.</p>
                {deleteError && (
                  <div className="alert-error mb-4">
                    <p>{deleteError}</p>
                  </div>
                )}
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="btn-secondary"
                    disabled={isDeleting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteChitFund}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isDeleting}
                  >
                    {isDeleting ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Bulk Delete Confirmation Modal */}
      {showBulkDeleteModal && (
        <div className="modal-overlay">
          <div className="dark-card p-4 sm:p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4 text-white">Confirm Bulk Delete</h3>
            {bulkDeleteSuccess ? (
              <div className="alert-success mb-4">
                <p>{bulkDeleteSuccess}</p>
              </div>
            ) : (
              <>
                <p className="mb-4 text-gray-300">Are you sure you want to delete {selectedChitFunds.length} chit funds? This action cannot be undone.</p>
                <p className="mb-4 text-red-400 font-semibold">Warning: This will also delete all members, contributions, and auctions associated with these chit funds.</p>
                {bulkDeleteError && (
                  <div className="alert-error mb-4">
                    <p>{bulkDeleteError}</p>
                  </div>
                )}
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowBulkDeleteModal(false)}
                    className="btn-secondary"
                    disabled={isBulkDeleting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmBulkDeleteChitFunds}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-500 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isBulkDeleting}
                  >
                    {isBulkDeleting ? 'Deleting...' : 'Delete Selected'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}