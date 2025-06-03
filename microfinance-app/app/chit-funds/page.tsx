// @ts-nocheck
'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChitFundsListSkeleton } from '../components/skeletons/ListSkeletons';

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
  nextAuctionDate: string | null;
  _count?: {
    members: number;
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
  const [statusFilter, setStatusFilter] = useState<string>('');

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

  // Handle status filter change
  const handleStatusFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value);
    setCurrentPage(1); // Reset to first page when changing filter
  };

  // Initial data fetch
  useEffect(() => {
    fetchChitFunds();
  }, [currentPage, pageSize, statusFilter]);

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
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  // Get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-100 text-green-800';
      case 'Upcoming':
        return 'bg-blue-100 text-blue-800';
      case 'Completed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto px-2 sm:px-4 py-6 sm:py-8 max-w-screen-xl w-full">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-blue-700">Chit Funds</h1>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 w-full sm:w-auto">
          <button
            onClick={handleExportSelected}
            disabled={selectedChitFunds.length === 0 || isExporting}
            className={`w-full sm:w-auto px-4 py-2 rounded-lg text-sm sm:text-base transition duration-300 flex items-center justify-center ${
              selectedChitFunds.length === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {isExporting ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Exporting...
              </>
            ) : (
              <>
                <svg className="-ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export Selected
              </>
            )}
          </button>
          <button
            onClick={handleBulkDeleteClick}
            disabled={selectedChitFunds.length === 0}
            className={`w-full sm:w-auto px-4 py-2 rounded-lg text-sm sm:text-base ${
              selectedChitFunds.length === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700'
            } transition duration-300`}
          >
            Delete Selected
          </button>
          <Link href="/chit-funds/new" className="w-full sm:w-auto px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-300 text-center text-sm sm:text-base">
            Create New Chit Fund
          </Link>
        </div>
      </div>

      {/* Status filter - always visible */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-4">
        <div className="p-2 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4">
          <label htmlFor="statusFilter" className="text-sm text-gray-600 mr-0 sm:mr-2">
            Filter by Status:
          </label>
          <select
            id="statusFilter"
            value={statusFilter}
            onChange={handleStatusFilterChange}
            className="border border-gray-300 rounded-md text-sm py-1 pl-2 pr-8"
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Upcoming">Upcoming</option>
            <option value="Completed">Completed</option>
          </select>

          {statusFilter && (
            <button
              onClick={() => setStatusFilter('')}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear Filter
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <ChitFundsListSkeleton />
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-sm sm:text-base">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      ) : chitFunds.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 text-center">
          <p className="text-gray-600 mb-4 text-sm sm:text-base">
            {statusFilter ? `No chit funds found with status "${statusFilter}".` : "No chit funds found."}
          </p>
          {!statusFilter && (
            <Link href="/chit-funds/new" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-300 text-sm sm:text-base">
              Create Your First Chit Fund
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-x-auto">
          <div className="p-2 sm:p-4 border-b flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
            <div className="flex items-center">
              <span className="text-sm text-gray-600">
                {selectedChitFunds.length > 0 ? `${selectedChitFunds.length} selected` : ''}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-xs sm:text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <span className="ml-2">Select</span>
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Amount
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Monthly Contribution
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration (Months)
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Members
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Next Auction
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {chitFunds.map((fund) => (
                  <tr
                    key={fund.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={(e) => {
                      // Prevent navigation when clicking on checkbox or action buttons
                      if (
                        e.target instanceof HTMLInputElement ||
                        e.target instanceof HTMLButtonElement ||
                        (e.target instanceof HTMLElement &&
                         (e.target.closest('button') || e.target.closest('input')))
                      ) {
                        return;
                      }
                      window.location.href = `/chit-funds/${fund.id}`;
                    }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedChitFunds.includes(fund.id)}
                          onChange={() => handleSelectChitFund(fund.id)}
                          className="h-4 w-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-blue-600">
                        {fund.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatCurrency(fund.totalAmount)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatCurrency(fund.monthlyContribution)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{fund.duration}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{fund._count?.members || 0}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(fund.status)}`}>
                        {fund.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatDate(fund.nextAuctionDate)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <Link href={`/chit-funds/${fund.id}/edit`} className="text-green-600 hover:text-green-900">
                          Edit
                        </Link>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const exportSingleChitFund = async () => {
                              try {
                                setIsExporting(true);

                                // Call the direct export API endpoint
                                const response = await fetch(`/api/chit-funds/${fund.id}/export`);

                                if (!response.ok) {
                                  throw new Error('Failed to export chit fund details');
                                }

                                // Get the blob from the response
                                const blob = await response.blob();

                                // Create a URL for the blob
                                const url = window.URL.createObjectURL(blob);

                                // Generate filename
                                const chitFundName = fund.name.replace(/[^a-zA-Z0-9]/g, '_');
                                const today = new Date();
                                const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
                                const filename = `${chitFundName}_${dateStr}.xlsx`;

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
                              } catch (error) {
                                console.error('Error exporting chit fund:', error);
                                alert('Failed to export chit fund. Please try again.');
                              } finally {
                                setIsExporting(false);
                              }
                            };
                            exportSingleChitFund();
                          }}
                          className="text-blue-600 hover:text-blue-900"
                          title="Export chit fund data"
                        >
                          Export
                        </button>
                        <button
                          onClick={() => handleDeleteChitFund(fund.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          <div className="p-2 sm:p-6 border-t">
            <div className="flex flex-col md:flex-row justify-between items-center gap-2 md:gap-0">
              <div className="mb-2 md:mb-0 flex items-center">
                <p className="text-xs sm:text-sm text-gray-600 mr-2 sm:mr-4">
                  Showing {chitFunds.length} of {totalCount} chit funds
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
                      setCurrentPage(1); // Reset to first page when changing page size
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
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
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
                              ? 'z-10 bg-blue-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                              : 'text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:outline-offset-0'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
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
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-2">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
            {deleteSuccess ? (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                <p>{deleteSuccess}</p>
              </div>
            ) : (
              <>
                <p className="mb-4">Are you sure you want to delete this chit fund? This action cannot be undone.</p>
                <p className="mb-4 text-red-600 font-semibold">Warning: This will also delete all members, contributions, and auctions associated with this chit fund.</p>
                {deleteError && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    <p>{deleteError}</p>
                  </div>
                )}
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300"
                    disabled={isDeleting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmDeleteChitFund}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-2">
          <div className="bg-white rounded-lg p-4 sm:p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Confirm Bulk Delete</h3>
            {bulkDeleteSuccess ? (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                <p>{bulkDeleteSuccess}</p>
              </div>
            ) : (
              <>
                <p className="mb-4">Are you sure you want to delete {selectedChitFunds.length} chit funds? This action cannot be undone.</p>
                <p className="mb-4 text-red-600 font-semibold">Warning: This will also delete all members, contributions, and auctions associated with these chit funds.</p>
                {bulkDeleteError && (
                  <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                    <p>{bulkDeleteError}</p>
                  </div>
                )}
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowBulkDeleteModal(false)}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300"
                    disabled={isBulkDeleting}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmBulkDeleteChitFunds}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
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