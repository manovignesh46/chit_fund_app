'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { LoansListSkeleton } from '../components/skeletons/ListSkeletons';
import { loanAPI } from '../../lib/api';

// Define interfaces for Loan type
interface GlobalMember {
  id: number;
  name: string;
  contact: string;
  email?: string | null;
  address?: string | null;
}

interface Loan {
  id: number;
  borrowerId: number;
  borrower: GlobalMember;
  loanType: string;
  amount: number;
  interestRate: number;
  duration: number;
  remainingAmount: number;
  nextPaymentDate: string | null;
  status: string;
  overdueAmount: number;
  missedPayments: number;
}

interface PaginatedResponse {
  loans: Loan[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Selection state
  const [selectedLoans, setSelectedLoans] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [loanToDelete, setLoanToDelete] = useState<number | null>(null);
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

  // Fetch loans function
  const fetchLoans = async () => {
    try {
      setLoading(true);
      let url = `/api/loans/consolidated?action=list&page=${currentPage}&pageSize=${pageSize}`;

      // Add status filter if selected
      if (statusFilter) {
        url += `&status=${statusFilter}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch loans');
      }

      const data: PaginatedResponse = await response.json();
      console.log('Fetched loans:', data);

      // Check if the response has pagination metadata
      if (data.loans && Array.isArray(data.loans)) {
        setLoans(data.loans);
        setTotalCount(data.totalCount || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        // Fallback for backward compatibility
        setLoans(Array.isArray(data) ? data : []);
        setTotalPages(1);
        setTotalCount(Array.isArray(data) ? data.length : 0);
      }

      // Clear selected loans when page changes
      setSelectedLoans([]);
      setSelectAll(false);
      setError(null);
    } catch (err) {
      console.error('Error fetching loans:', err);
      setError('Failed to load loans. Please try again later.');
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
    fetchLoans();
  }, [currentPage, pageSize, statusFilter]);

  // Handle selecting/deselecting a loan
  const handleSelectLoan = (loanId: number) => {
    if (selectedLoans.includes(loanId)) {
      setSelectedLoans(selectedLoans.filter(id => id !== loanId));
      setSelectAll(false);
    } else {
      setSelectedLoans([...selectedLoans, loanId]);
      if (selectedLoans.length + 1 === loans.length) {
        setSelectAll(true);
      }
    }
  };

  // Handle select all loans
  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedLoans([]);
      setSelectAll(false);
    } else {
      setSelectedLoans(loans.map(loan => loan.id));
      setSelectAll(true);
    }
  };

  // Handle delete loan
  const handleDeleteLoan = (loanId: number) => {
    setLoanToDelete(loanId);
    setShowDeleteModal(true);
    setDeleteError(null);
    setDeleteSuccess(null);
  };

  // Confirm delete loan
  const confirmDeleteLoan = async () => {
    if (!loanToDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch('/api/loans/consolidated?action=delete', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: loanToDelete }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete loan');
      }

      // Show success message
      setDeleteSuccess('Loan deleted successfully');

      // Refresh data after a short delay
      setTimeout(() => {
        setShowDeleteModal(false);
        setLoanToDelete(null);
        setDeleteSuccess(null);
        fetchLoans();
      }, 1500);
    } catch (error) {
      console.error('Error deleting loan:', error);
      setDeleteError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle bulk delete loans
  const handleBulkDeleteClick = () => {
    if (selectedLoans.length === 0) return;
    setShowBulkDeleteModal(true);
    setBulkDeleteError(null);
    setBulkDeleteSuccess(null);
  };

  // Handle export selected loans
  const handleExportSelected = async () => {
    if (selectedLoans.length === 0 || isExporting) return;

    try {
      setIsExporting(true);
      console.log('Exporting selected loans:', selectedLoans);

      // Use the API client to export selected loans
      await loanAPI.exportSelectedLoans(selectedLoans);

      // No need to handle the response as the API client will trigger the download
    } catch (error) {
      console.error('Error exporting loans:', error);
      alert('Failed to export loans. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Confirm bulk delete loans
  const confirmBulkDeleteLoans = async () => {
    if (selectedLoans.length === 0) return;

    setIsBulkDeleting(true);
    setBulkDeleteError(null);

    try {
      // Delete loans one by one
      const deletePromises = selectedLoans.map(loanId =>
        fetch('/api/loans/consolidated?action=delete', {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: loanId }),
        })
      );

      const results = await Promise.allSettled(deletePromises);
      const failedCount = results.filter(result => result.status === 'rejected').length;

      if (failedCount > 0) {
        throw new Error(`Failed to delete ${failedCount} loans`);
      }

      // Show success message
      setBulkDeleteSuccess(`${selectedLoans.length} loans deleted successfully`);

      // Refresh data after a short delay
      setTimeout(() => {
        setShowBulkDeleteModal(false);
        setSelectedLoans([]);
        setSelectAll(false);
        setBulkDeleteSuccess(null);
        fetchLoans();
      }, 1500);
    } catch (error) {
      console.error('Error deleting loans:', error);
      setBulkDeleteError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsBulkDeleting(false);
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
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'Completed':
        return 'bg-blue-100 text-blue-800';
      case 'Defaulted':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-green-700">Loans</h1>
        <div className="flex space-x-4">
          <button
            onClick={handleExportSelected}
            disabled={selectedLoans.length === 0 || isExporting}
            className={`px-4 py-2 rounded-lg ${
              selectedLoans.length === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            } transition duration-300 flex items-center`}
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
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
                </svg>
                Export Selected
              </>
            )}
          </button>
          <button
            onClick={handleBulkDeleteClick}
            disabled={selectedLoans.length === 0}
            className={`px-4 py-2 rounded-lg ${
              selectedLoans.length === 0
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-red-600 text-white hover:bg-red-700'
            } transition duration-300`}
          >
            Delete Selected
          </button>
          <Link href="/loans/new" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-300">
            Create New Loan
          </Link>
        </div>
      </div>

      {/* Status filter - always visible */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-4">
        <div className="p-4 flex items-center">
          <label htmlFor="statusFilter" className="text-sm text-gray-600 mr-2">
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
            <option value="Pending">Pending</option>
            <option value="Completed">Completed</option>
            <option value="Defaulted">Defaulted</option>
          </select>

          {statusFilter && (
            <button
              onClick={() => setStatusFilter('')}
              className="ml-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Clear Filter
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <LoansListSkeleton />
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      ) : loans.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-6 text-center">
          <p className="text-gray-600 mb-4">
            {statusFilter ? `No loans found with status "${statusFilter}".` : "No loans found."}
          </p>
          {!statusFilter && (
            <Link href="/loans/new" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-300">
              Create Your First Loan
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center">
            <div className="flex items-center">
              <span className="text-sm text-gray-600">
                {selectedLoans.length > 0 ? `${selectedLoans.length} selected` : ''}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        checked={selectAll}
                        onChange={handleSelectAll}
                        className="h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                      />
                      <span className="ml-2">Select</span>
                    </div>
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Borrower
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Loan Type
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Interest Amount
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Remaining
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Missed Payments
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Next Payment
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loans.map((loan) => (
                  <tr
                    key={loan.id}
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
                      window.location.href = `/loans/${loan.id}`;
                    }}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={selectedLoans.includes(loan.id)}
                          onChange={() => handleSelectLoan(loan.id)}
                          className="h-4 w-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-green-600">
                        {loan.borrower?.name || 'Unknown'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{loan.loanType}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatCurrency(loan.amount)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatCurrency(loan.interestRate)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{loan.duration} {loan.loanType === 'Weekly' ? 'weeks' : 'months'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatCurrency(loan.remainingAmount)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm ${loan.missedPayments > 0 ? 'text-red-600 font-medium' : 'text-green-600'}`}>
                        {loan.missedPayments > 0 ? `${loan.missedPayments} ${loan.missedPayments === 1 ? 'payment' : 'payments'}` : 'None'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatDate(loan.nextPaymentDate)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(loan.status)}`}>
                        {loan.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-2">
                        <Link href={`/loans/${loan.id}/edit`} className="text-green-600 hover:text-green-900">
                          Edit
                        </Link>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            const exportSingleLoan = async () => {
                              try {
                                setIsExporting(true);
                                await loanAPI.exportSelectedLoans([loan.id]);
                              } catch (error) {
                                console.error('Error exporting loan:', error);
                                alert('Failed to export loan. Please try again.');
                              } finally {
                                setIsExporting(false);
                              }
                            };
                            exportSingleLoan();
                          }}
                          className="text-blue-600 hover:text-blue-900"
                          title="Export loan data"
                        >
                          Export
                        </button>
                        <button
                          onClick={() => handleDeleteLoan(loan.id)}
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
          <div className="p-6 border-t">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="mb-4 md:mb-0 flex items-center">
                <p className="text-sm text-gray-600 mr-4">
                  Showing {loans.length} of {totalCount} loans
                </p>
                <div className="flex items-center">
                  <label htmlFor="pageSize" className="text-sm text-gray-600 mr-2">
                    Show:
                  </label>
                  <select
                    id="pageSize"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1); // Reset to first page when changing page size
                    }}
                    className="border border-gray-300 rounded-md text-sm py-1 pl-2 pr-8"
                  >
                    <option value="5">5</option>
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                    <option value="100">100</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0">
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
                              ? 'z-10 bg-green-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600'
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
            {deleteSuccess ? (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                <p>{deleteSuccess}</p>
              </div>
            ) : (
              <>
                <p className="mb-4">Are you sure you want to delete this loan? This action cannot be undone.</p>
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
                    onClick={confirmDeleteLoan}
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Confirm Bulk Delete</h3>
            {bulkDeleteSuccess ? (
              <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                <p>{bulkDeleteSuccess}</p>
              </div>
            ) : (
              <>
                <p className="mb-4">Are you sure you want to delete {selectedLoans.length} loans? This action cannot be undone.</p>
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
                    onClick={confirmBulkDeleteLoans}
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