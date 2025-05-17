'use client';

import React from 'react';
const { useEffect, useState } = React;
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { loanAPI } from '../../../../lib/api';

// Define interfaces
interface Loan {
  id: number;
  borrowerId: number;
  borrower: {
    name: string;
  };
  amount: number;
  remainingAmount: number;
  status: string;
  repaymentType: string;
}

interface PaymentSchedule {
  id: number;
  period: number;
  dueDate: string;
  amount: number;
  status: string;
  actualPaymentDate?: string;
  notes?: string;
  repayment?: {
    id: number;
    amount: number;
    paidDate: string;
    paymentType: string;
  };
}

const PaymentSchedulesPage = () => {
  const params = useParams();
  const id = params.id;

  // State variables
  const [loan, setLoan] = useState(null);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updating, setUpdating] = useState(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Filter state
  const [statusFilter, setStatusFilter] = useState(null);

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch loan details
      const loanResponse = await loanAPI.getById(Number(id));
      setLoan(loanResponse);

      // Fetch payment schedules
      const schedulesResponse = await loanAPI.getPaymentSchedules(Number(id));

      if (schedulesResponse.schedules && Array.isArray(schedulesResponse.schedules)) {
        setSchedules(schedulesResponse.schedules);
        setTotalCount(schedulesResponse.totalCount || 0);
        setTotalPages(schedulesResponse.totalPages || 1);
      } else {
        setSchedules([]);
        setTotalPages(1);
        setTotalCount(0);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load payment schedules. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchData();
    }
  }, [id, currentPage, pageSize, statusFilter]);

  // Record a payment
  const handleRecordPayment = async (period: number, status: string) => {
    try {
      setUpdating(period);

      // Determine payment type based on status
      const paymentType = status === 'InterestOnly' ? 'interestOnly' : 'full';

      // Get the amount from the schedule
      const amount = schedules.find((s: PaymentSchedule) => s.period === period)?.amount || 0;

      console.log(`Recording payment for period ${period}, amount ${amount}, type ${paymentType}`);

      // Record the payment
      const result = await loanAPI.recordPayment(
        Number(id),
        {
          scheduleId: period,
          amount,
          paidDate: new Date().toISOString().split('T')[0],
          paymentType
        }
      );

      console.log('Payment recorded successfully:', result);

      // Add a small delay before refreshing data
      console.log('Waiting before refreshing data...');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Fetch all data to ensure loan details and payment schedules are refreshed
      console.log('Refreshing data...');
      await fetchData();

      console.log('Data refresh complete');
    } catch (err) {
      console.error('Error recording payment:', err);
      setError('Failed to record payment. Please try again later.');
    } finally {
      setUpdating(null);
    }
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amount);
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Handle page size change
  const handlePageSizeChange = (e: any) => {
    setPageSize(Number(e.target.value));
    setCurrentPage(1);
  };

  // Handle status filter change
  const handleStatusFilterChange = (e: any) => {
    setStatusFilter(e.target.value === 'all' ? null : e.target.value);
    setCurrentPage(1);
  };

  // Get status badge color
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Paid':
        return 'bg-green-100 text-green-800';
      case 'Pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'Missed':
        return 'bg-red-100 text-red-800';
      case 'InterestOnly':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Loading state
  if (loading && !schedules.length) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-700 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading payment schedules...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <h2 className="text-xl font-bold mb-2">Error</h2>
          <p>{error}</p>
          <Link href={`/loans/${id}`} className="mt-4 inline-block text-blue-600 hover:underline">
            Return to Loan Details
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-green-700">Payment Schedule</h1>
        <div className="flex space-x-4">
          <Link href={`/loans/${id}`} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300">
            Back to Loan Details
          </Link>
        </div>
      </div>

      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded-md">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              The payment schedule now shows all past due dates (including missed payments), upcoming payments (next 7 days), and any payments that have been made.
            </p>
          </div>
        </div>
      </div>

      {loan && (
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold">Loan Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              <div>
                <p className="text-sm text-gray-500">Borrower</p>
                <p className="font-medium">{loan.borrower?.name || 'Unknown'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Total Amount</p>
                <p className="font-medium">{formatCurrency(loan.amount)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Remaining Balance</p>
                <p className="font-medium">{formatCurrency(loan.remainingAmount)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
        <div className="p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
          <h2 className="text-xl font-semibold">Payment Schedule</h2>
          <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-4">
            <div>
              <label htmlFor="statusFilter" className="mr-2 text-sm text-gray-600">Status:</label>
              <select
                id="statusFilter"
                value={statusFilter || 'all'}
                onChange={handleStatusFilterChange}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="all">All</option>
                <option value="Pending">Pending</option>
                <option value="Paid">Paid</option>
                <option value="Missed">Missed</option>
                <option value="InterestOnly">Interest Only</option>
              </select>
            </div>
            <div>
              <label htmlFor="pageSize" className="mr-2 text-sm text-gray-600">Show:</label>
              <select
                id="pageSize"
                value={pageSize}
                onChange={handlePageSizeChange}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </div>
          </div>
        </div>

        {schedules.length === 0 ? (
          <div className="p-6 text-center">
            <p className="text-gray-600 mb-4">No payment schedules found for this loan.</p>
            <p className="text-sm text-gray-500">
              Payment schedules are generated dynamically based on the loan's disbursement date and repayment history.
              <br />
              The schedule shows all past due dates (including missed payments), current and upcoming due dates (within the next 7 days), and any payments that have been made.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Period
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Due Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Payment Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {schedules.map((schedule: PaymentSchedule) => (
                    <tr key={schedule.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {loan?.repaymentType === 'Weekly' ? `Week ${schedule.period}` : `Month ${schedule.period}`}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatDate(schedule.dueDate)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatCurrency(schedule.amount)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(schedule.status)}`}>
                          {schedule.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {schedule.actualPaymentDate ? formatDate(schedule.actualPaymentDate) : '-'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex space-x-2">
                          {(schedule.status === 'Pending' || schedule.status === 'Missed') && (
                            <>
                              <button
                                onClick={() => handleRecordPayment(schedule.period, 'Paid')}
                                disabled={updating === schedule.period}
                                className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                              >
                                {updating === schedule.period ? 'Processing...' : 'Mark Paid'}
                              </button>
                              <button
                                onClick={() => handleRecordPayment(schedule.period, 'InterestOnly')}
                                disabled={updating === schedule.period}
                                className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                              >
                                {updating === schedule.period ? 'Processing...' : 'Interest Only'}
                              </button>
                            </>
                          )}
                          {schedule.repayment && (
                            <Link
                              href={`/loans/${id}/repayments`}
                              className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                            >
                              View Payment
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-6 py-4 flex items-center justify-between border-t border-gray-200">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                      currentPage === 1 ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className={`ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                      currentPage === totalPages ? 'bg-gray-100 text-gray-400' : 'bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    Next
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Showing <span className="font-medium">{(currentPage - 1) * pageSize + 1}</span> to{' '}
                      <span className="font-medium">{Math.min(currentPage * pageSize, totalCount)}</span> of{' '}
                      <span className="font-medium">{totalCount}</span> results
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                      <button
                        onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                        disabled={currentPage === 1}
                        className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${
                          currentPage === 1 ? 'text-gray-300' : 'text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        <span className="sr-only">Previous</span>
                        &larr;
                      </button>
                      {/* Page numbers */}
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum: number;
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
                            onClick={() => handlePageChange(pageNum)}
                            className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                              currentPage === pageNum
                                ? 'z-10 bg-green-50 border-green-500 text-green-600'
                                : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      })}
                      <button
                        onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                        disabled={currentPage === totalPages}
                        className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${
                          currentPage === totalPages ? 'text-gray-300' : 'text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        <span className="sr-only">Next</span>
                        &rarr;
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default PaymentSchedulesPage;
