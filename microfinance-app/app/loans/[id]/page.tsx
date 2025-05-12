'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

// Define interface for Loan type
interface Repayment {
  id: number;
  paidDate: string;
  amount: number;
  paymentType?: string; // "full" or "interestOnly"
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

// ParamValue type from Next.js is string | string[] | undefined
type ParamValue = string | string[] | undefined;

interface GlobalMember {
  id: number;
  name: string;
  contact: string;
  email?: string | null;
  address?: string | null;
}

interface Loan {
  installmentAmount?: number;
  id: ParamValue;
  borrowerId: number;
  borrower: GlobalMember;
  amount: number;
  interestRate: number;
  documentCharge?: number;
  loanType: string;
  disbursementDate: string;
  duration: number;
  currentMonth: number;
  repaymentType: string;
  remainingBalance: number;
  overdueAmount: number;
  missedPayments: number;
  nextPaymentDate: string;
  status: string;
  repayments: Repayment[];
}

const LoanDetailPage = () => {
  const params = useParams();
  const id = params.id;
  const [loan, setLoan] = useState<Loan | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Payment schedule state
  const [paymentSchedules, setPaymentSchedules] = useState<PaymentSchedule[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [updatingSchedule, setUpdatingSchedule] = useState<number | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [repaymentToDelete, setRepaymentToDelete] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  // Export state
  const [isExporting, setIsExporting] = useState(false);

  // Mock data for loan details
  const mockLoan = {
    id: id,
    borrowerId: 1,
    borrower: {
      id: 1,
      name: 'Rahul Sharma',
      contact: '+91 9876543210',
      email: 'rahul@example.com',
      address: 'Delhi, India'
    },
    amount: 50000,
    interestRate: 12000, // Now as amount instead of percentage
    documentCharge: 1000,
    loanType: 'Business',
    disbursementDate: '2023-01-15',
    duration: 12,
    currentMonth: 5,
    repaymentType: 'Monthly',
    remainingBalance: 35000,
    nextPaymentDate: '2023-05-15',
    status: 'Active',
    repayments: [
      { id: 1, paidDate: '2023-02-15', amount: 5000 },
      { id: 2, paidDate: '2023-03-15', amount: 5000 },
      { id: 3, paidDate: '2023-04-15', amount: 5000 },
    ]
  };

  // Fetch payment schedules
  const fetchPaymentSchedules = async () => {
    if (!id) return;

    try {
      setLoadingSchedules(true);
      setScheduleError(null);

      // Build the URL with query parameters
      const url = `/api/loans/${id}/payment-schedules?page=${currentPage}&pageSize=${pageSize}`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch payment schedules');
      }

      const data = await response.json();

      if (data.schedules && Array.isArray(data.schedules)) {
        // Schedules are already sorted in descending order by the API
        setPaymentSchedules(data.schedules);
        setTotalCount(data.totalCount || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        setPaymentSchedules([]);
        setTotalCount(0);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Error fetching payment schedules:', error);
      setScheduleError('Failed to load payment schedules');
    } finally {
      setLoadingSchedules(false);
    }
  };

  // Record a payment for a specific period
  const handleRecordPayment = async (period: number, paymentType: string) => {
    try {
      setUpdatingSchedule(period);
      setScheduleError(null);

      // Get the amount from the loan's installment amount
      const amount = loan?.installmentAmount || 0;

      console.log(`Recording payment for period ${period}, amount ${amount}, type ${paymentType}`);

      const response = await fetch(`/api/loans/${id}/payment-schedules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'recordPayment',
          period,
          amount,
          paidDate: new Date().toISOString().split('T')[0],
          paymentType: paymentType === 'InterestOnly' ? 'interestOnly' : 'full'
        }),
      });

      // Log the response status
      console.log(`Payment API response status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Error response data:', errorData);
        throw new Error(errorData.error || 'Failed to record payment');
      }

      // Parse the response to get the repayment data
      const responseData = await response.json();
      console.log('Payment recorded successfully:', responseData);

      // Add a small delay before refreshing data
      console.log('Waiting before refreshing data...');
      await new Promise(resolve => setTimeout(resolve, 500));

      // Refresh loan details to get updated overdue amount and missed payments
      console.log('Refreshing loan details...');
      await fetchLoanDetails();

      // Explicitly refresh payment schedules after recording a payment
      console.log('Refreshing payment schedules...');
      await fetchPaymentSchedules();

      console.log('Data refresh complete');

    } catch (error) {
      console.error('Error recording payment:', error);
      setScheduleError(error instanceof Error ? error.message : 'Failed to record payment');
    } finally {
      setUpdatingSchedule(null);
    }
  };

  const fetchLoanDetails = async () => {
    try {
      setLoading(true);

      // First, update the overdue amount to ensure it's current
      try {
        console.log('Updating overdue amount...');
        const overdueResponse = await fetch(`/api/loans/${id}/payment-schedules`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'updateOverdue'
          }),
        });

        if (overdueResponse.ok) {
          console.log('Overdue amount updated successfully');
        } else {
          console.warn('Failed to update overdue amount');
        }
      } catch (overdueError) {
        console.error('Error updating overdue amount:', overdueError);
        // Continue with fetching loan details even if updating overdue amount fails
      }

      // Fetch loan details
      const loanResponse = await fetch(`/api/loans/${id}`);
      if (!loanResponse.ok) {
        throw new Error('Failed to fetch loan details');
      }
      const loanData = await loanResponse.json();

      console.log('Loan data from API:', loanData);

      // Fetch paginated repayments for this loan
      const repaymentsResponse = await fetch(`/api/loans/${id}/repayments?page=${currentPage}&pageSize=${pageSize}`);
      if (!repaymentsResponse.ok) {
        throw new Error('Failed to fetch repayments');
      }
      const repaymentsData = await repaymentsResponse.json();

      console.log('Repayments data from API:', repaymentsData);

      // Extract repayments and pagination data
      let repaymentsList = [];
      if (repaymentsData.repayments && Array.isArray(repaymentsData.repayments)) {
        repaymentsList = repaymentsData.repayments;
      } else {
        // Fallback for backward compatibility
        repaymentsList = Array.isArray(repaymentsData) ? repaymentsData : [];
      }

      console.log('Extracted repayments list:', repaymentsList);

      // Combine the data
      const combinedData = {
        ...loanData,
        repayments: repaymentsList,
        // Map remainingAmount to remainingBalance for compatibility
        remainingBalance: loanData.remainingAmount
      };

      console.log('Combined data for loan state:', combinedData);

      // Log specific details about the loan for debugging profit calculation
      console.log('Loan details for profit calculation:', {
        interestRate: combinedData.interestRate,
        documentCharge: combinedData.documentCharge,
        repayments: combinedData.repayments.map((r: Repayment) => ({
          id: r.id,
          amount: r.amount,
          paymentType: r.paymentType,
          paidDate: r.paidDate
        }))
      });

      setLoan(combinedData);

      // Fetch payment schedules
      await fetchPaymentSchedules();
    } catch (error) {
      console.error('Error fetching loan details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchLoanDetails();
    }
  }, [id]);

  // Fetch payment schedules when page or page size changes
  useEffect(() => {
    if (id && !loading) {
      fetchPaymentSchedules();
    }
  }, [id, currentPage, pageSize]);

  // Effect to show profit elements
  useEffect(() => {
    if (!loading && loan) {
      // Show profit elements
      const profitElement = document.getElementById('loan-profit');
      const profitExplanationElement = document.getElementById('loan-profit-explanation');

      if (profitElement) {
        profitElement.classList.remove('hidden');
      }

      if (profitExplanationElement) {
        profitExplanationElement.classList.remove('hidden');
      }
    }
  }, [loading, loan]);

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string | undefined): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  // Format period to show month and year
  const formatPeriod = (period: number, dueDate: string, repaymentType: string): string => {
    const date = new Date(dueDate);

    if (repaymentType === 'Weekly') {
      return `Week ${period} (${date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })})`;
    } else {
      return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    }
  };

  // Calculate end date based on disbursement date and duration
  const calculateEndDate = (disbursementDate: string, durationMonths: number): string => {
    if (!disbursementDate) return '';

    const startDate = new Date(disbursementDate);
    const endDate = new Date(startDate);
    endDate.setMonth(startDate.getMonth() + durationMonths);

    return endDate.toISOString();
  };

  // Handle delete repayment
  const handleDeleteRepayment = (repaymentId: number) => {
    setRepaymentToDelete(repaymentId);
    setShowDeleteModal(true);
    setDeleteError(null);
    setDeleteSuccess(null);
  };

  // Confirm delete repayment
  const confirmDeleteRepayment = async () => {
    if (!repaymentToDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/loans/${id}/repayments`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ repaymentId: repaymentToDelete }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete repayment');
      }

      // Show success message
      setDeleteSuccess('Repayment deleted successfully');

      // Refresh data after a short delay
      setTimeout(() => {
        setShowDeleteModal(false);
        setRepaymentToDelete(null);
        setDeleteSuccess(null);
        fetchLoanDetails();
      }, 1500);
    } catch (error) {
      console.error('Error deleting repayment:', error);
      setDeleteError(error instanceof Error ? error.message : 'An error occurred');
    } finally {
      setIsDeleting(false);
    }
  };

  // Helper function to update the loan's current month
  const updateLoanCurrentMonth = async (monthValue: number) => {
    console.log(`Updating loan ID ${id} to month ${monthValue}`);
    try {
      const response = await fetch(`/api/loans/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentMonth: monthValue,
        }),
      });

      if (!response.ok) {
        // Try to get more detailed error information
        let errorDetails = response.statusText;
        try {
          const errorResponse = await response.json();
          console.error('API error response:', errorResponse);
          if (errorResponse.message) {
            errorDetails = `${errorResponse.message}${errorResponse.details ? ': ' + errorResponse.details : ''}`;
          }
        } catch (e) {
          console.error('Could not parse error response as JSON');
        }

        throw new Error(`Failed to update current month: ${errorDetails}`);
      }

      // Parse the response
      const updatedLoan = await response.json();
      console.log('Updated loan data:', updatedLoan);

      // Update the local state
      setLoan(prev => {
        if (!prev) return null;
        return {
          ...prev,
          currentMonth: updatedLoan.currentMonth || monthValue
        };
      });

      return true;
    } catch (error) {
      console.error('Error updating loan month:', error);
      return false;
    } finally {
      setUpdating(false);
    }
  };

  // Handle export to Excel
  const handleExport = async () => {
    if (!loan || isExporting) return;

    try {
      setIsExporting(true);

      // Generate filename directly from loan data
      const borrowerName = loan.borrower.name.replace(/[^a-zA-Z0-9]/g, '_');
      const loanAmount = Math.round(loan.amount).toString();
      const disbursementDate = new Date(loan.disbursementDate)
        .toISOString()
        .split('T')[0];

      const filename = `${borrowerName}_${loanAmount}_${disbursementDate}.xlsx`;
      console.log('Generated filename:', filename);

      // Call the export API endpoint
      const response = await fetch(`/api/loans/${id}/export`);

      if (!response.ok) {
        throw new Error('Failed to export loan details');
      }

      // Get the blob from the response
      const blob = await response.blob();

      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);

      // Create a temporary link element
      const a = document.createElement('a');
      a.href = url;
      a.download = filename; // Set the filename explicitly

      // Append to the document and trigger a click
      document.body.appendChild(a);
      a.click();

      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting loan details:', error);
      alert('Failed to export loan details. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Update the current month/week
  const updateCurrentMonth = async () => {
    if (!loan || updating) return;

    try {
      setUpdating(true);

      // Calculate the current period (month or week) based on the disbursement date
      const startDate = new Date(loan.disbursementDate);
      const currentDate = new Date();

      // Check if disbursement date is in the future
      if (startDate > currentDate) {
        console.log('Disbursement date is in the future, setting current period to 0');
        // If disbursement date is in the future, current period should be 0 (not started yet)
        if (loan.currentMonth !== 0) {
          // Only update if it's not already 0
          setUpdating(true);
          return updateLoanCurrentMonth(0);
        } else {
          // Already at period 0, no need to update
          console.log('Loan is already at period 0, no update needed');
          return;
        }
      }

      let newCurrentPeriod;

      if (loan.loanType === 'Weekly') {
        // Calculate weeks difference for weekly loans
        // Get the start date and current date without time components
        const startDateClean = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
        const currentDateClean = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());

        // Calculate days difference (inclusive of start date)
        const daysDiff = Math.floor((currentDateClean.getTime() - startDateClean.getTime()) / (24 * 60 * 60 * 1000));

        // For weekly loans, we consider:
        // Week 1: Days 0-6 (first 7 days including start date)
        // Week 2: Days 7-13
        // And so on...

        // Calculate which week we're in (1-indexed)
        // For weekly loans, we need to be precise about when a week changes

        // For the specific case:
        // - Disbursement Date: April 26, 2025 (Saturday)
        // - Current Date: May 10, 2025 (Saturday, 14 days later)
        // We want this to be week 2, not week 3

        // Calculate weeks by dividing days by 7, but we need to adjust the calculation
        // to ensure we get week 2 for the 14-day case

        // If we're exactly at a multiple of 7 days (like 14 days), we want to be in the week
        // that just completed, not the next week
        const isExactMultipleOfSeven = daysDiff % 7 === 0;

        // Calculate the week number
        // For your specific example:
        // - 14 days = 2 weeks exactly
        // We want to be in week 2, not week 3
        const currentWeek = Math.floor(daysDiff / 7) + (isExactMultipleOfSeven ? 0 : 1);

        console.log('Weekly loan calculation:', {
          startDate: startDateClean.toISOString(),
          currentDate: currentDateClean.toISOString(),
          daysDiff,
          isExactMultipleOfSeven,
          currentWeek,
          // For debugging specific dates
          startDay: startDateClean.getDate(),
          currentDay: currentDateClean.getDate(),
          startMonth: startDateClean.getMonth() + 1,
          currentMonth: currentDateClean.getMonth() + 1
        });

        // Set the current period
        newCurrentPeriod = currentWeek;
      } else {
        // Calculate months difference for monthly loans
        let monthsDiff = (currentDate.getFullYear() - startDate.getFullYear()) * 12 +
                        (currentDate.getMonth() - startDate.getMonth());

        // Add 1 because first month is month 1
        monthsDiff = monthsDiff + 1;

        // Adjust if we haven't reached the same day of the month yet
        if (currentDate.getDate() < startDate.getDate()) {
          monthsDiff--;
        }

        console.log('Monthly loan calculation:', {
          startDate: startDate.toISOString(),
          currentDate: currentDate.toISOString(),
          startDay: startDate.getDate(),
          currentDay: currentDate.getDate(),
          startMonth: startDate.getMonth() + 1,
          currentMonth: currentDate.getMonth() + 1,
          monthsDiffBeforeAdjustment: (currentDate.getFullYear() - startDate.getFullYear()) * 12 +
                        (currentDate.getMonth() - startDate.getMonth()) + 1,
          monthsDiffAfterAdjustment: monthsDiff
        });

        // Ensure we don't go below 1
        newCurrentPeriod = Math.max(1, monthsDiff);
      }

      // Ensure we don't exceed the duration
      newCurrentPeriod = Math.min(newCurrentPeriod, loan.duration);

      console.log(`Calculated current ${loan.loanType === 'Weekly' ? 'week' : 'month'}:`,
                 newCurrentPeriod, 'from disbursement date:', loan.disbursementDate);

      if (newCurrentPeriod === loan.currentMonth) {
        // Don't show an alert, just silently return
        console.log('Current period is already up to date');
        setUpdating(false);
        return;
      }

      // Call the helper function to update the current period
      await updateLoanCurrentMonth(newCurrentPeriod);

    } catch (error) {
      console.error('Error in updateCurrentMonth:', error);

      // Refresh the page data to ensure we have the latest state
      if (id) {
        try {
          // Fetch loan details
          const refreshResponse = await fetch(`/api/loans/${id}`);
          if (refreshResponse.ok) {
            const refreshedLoanData = await refreshResponse.json();

            // Fetch repayments again
            const refreshRepaymentsResponse = await fetch(`/api/loans/${id}/repayments`);
            if (refreshRepaymentsResponse.ok) {
              const refreshedRepaymentsData = await refreshRepaymentsResponse.json();

              // Extract repayments from the paginated response
              const refreshedRepaymentsList = Array.isArray(refreshedRepaymentsData)
                ? refreshedRepaymentsData
                : (refreshedRepaymentsData?.repayments || []);

              // Update the loan state with fresh data
              setLoan({
                ...refreshedLoanData,
                repayments: refreshedRepaymentsList,
                remainingBalance: refreshedLoanData.remainingAmount
              });
            } else {
              // If we can't get repayments, at least update the loan data
              setLoan(prev => {
                if (!prev) return refreshedLoanData;
                return {
                  ...refreshedLoanData,
                  repayments: prev.repayments || [],
                  remainingBalance: refreshedLoanData.remainingAmount
                };
              });
            }
          }
        } catch (refreshError) {
          console.error('Failed to refresh loan data:', refreshError);
        }
      }
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading loan details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!loan) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <h2 className="text-xl font-bold mb-2">Loan Not Found</h2>
          <p>The loan you are looking for does not exist or has been removed.</p>
          <Link href="/loans" className="mt-4 inline-block text-blue-600 hover:underline">
            Return to Loans
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Confirm Delete</h3>
            <p className="mb-6">Are you sure you want to delete this repayment? This action cannot be undone.</p>

            {deleteError && (
              <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                <p>{deleteError}</p>
              </div>
            )}

            {deleteSuccess && (
              <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
                <p>{deleteSuccess}</p>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteRepayment}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-green-700">Loan Details</h1>
        <div className="flex space-x-3">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
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
                Export as Excel
              </>
            )}
          </button>
          <Link href={`/loans/${id}/edit`} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300">
            Edit Loan
          </Link>
          <Link href="/loans" className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300">
            Back to Loans
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
        <div className="p-6 border-b">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-semibold">{loan.borrower?.name || 'Unknown'}</h2>
              <p className="text-gray-600">{loan.borrower?.contact || 'No contact'}</p>
            </div>
            <div className="flex items-center space-x-3">
              <div className="text-right flex flex-col items-end">
                <div className="text-sm text-gray-500">Current {loan.loanType === 'Weekly' ? 'Week' : 'Month'}</div>
                <div className="flex items-center">
                  <div className="text-xl font-bold text-green-700 mr-2">
                    {loan.currentMonth === 0 ?
                      <span className="text-yellow-600">Not Started</span> :
                      <>{loan.currentMonth} <span className="text-sm text-gray-500">/ {loan.duration}</span></>
                    }
                  </div>
                  <button
                    onClick={updateCurrentMonth}
                    disabled={updating}
                    className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {updating ? 'Updating...' : 'Update'}
                  </button>
                </div>
              </div>
              <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold">
                {loan.status}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Loan Amount</h3>
              <p className="text-xl font-semibold">{formatCurrency(loan.amount)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Remaining Balance</h3>
              <p className="text-xl font-semibold">{formatCurrency(loan.remainingBalance)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center">
                Overdue Amount
                {loan.overdueAmount > 0 && (
                  <span className="ml-2 px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                    {loan.missedPayments} {loan.missedPayments === 1 ? 'payment' : 'payments'} missed
                  </span>
                )}
              </h3>
              <p className={`text-xl font-semibold ${loan.overdueAmount > 0 ? 'text-red-600' : 'text-gray-500'}`}>
                {formatCurrency(loan.overdueAmount)}
              </p>
            </div>
            {loan.repaymentType === 'Monthly' && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Interest Amount</h3>
                <p className="text-xl font-semibold">{formatCurrency(loan.interestRate)}</p>
              </div>
            )}
            {loan.repaymentType === 'Monthly' && (
              <div>
                <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Document Charge</h3>
                <p className="text-xl font-semibold">{formatCurrency(loan.documentCharge || 0)}</p>
              </div>
            )}
            <div>
              <h3
                className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center cursor-pointer"
                onClick={() => {
                  const profitElement = document.getElementById('loan-profit');
                  const profitExplanation = document.getElementById('loan-profit-explanation');
                  if (profitElement) {
                    profitElement.classList.toggle('hidden');
                  }
                  if (profitExplanation) {
                    profitExplanation.classList.toggle('hidden');
                  }
                }}
              >
                Total Profit
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </h3>
              <div>
                <p id="loan-profit" className="text-xl font-semibold text-green-600 hidden">
                  {loan.repaymentType === 'Monthly' ? (
                    (() => {
                      // SPECIAL CASE: For loans with only interest-only payments
                      const onlyHasInterestOnlyPayments =
                        loan.repayments.length > 0 &&
                        loan.repayments.every(r => r.paymentType === 'interestOnly');

                      if (onlyHasInterestOnlyPayments) {
                        // For loans with only interest-only payments, the profit is the interest rate
                        // multiplied by the number of interest-only payments made
                        const interestOnlyPaymentsCount = loan.repayments.length;
                        const profit = (loan.interestRate || 0) * interestOnlyPaymentsCount;
                        console.log('Detected interest-only payments only case - profit:', profit, 'from', interestOnlyPaymentsCount, 'payments');
                        return formatCurrency(profit);
                      }

                      // Document charge (one-time)
                      const documentCharge = (loan.documentCharge || 0);

                      // Sum of all interest-only payments
                      // For interest-only payments, the entire payment amount is interest (profit)
                      const interestOnlyPayments = loan.repayments
                        .filter(repayment => repayment.paymentType === 'interestOnly')
                        .reduce((sum, repayment) => sum + repayment.amount, 0);

                      // Log the interest-only payments for debugging
                      console.log('Interest-only payments:', loan.repayments
                        .filter(r => r.paymentType === 'interestOnly')
                        .map(r => ({
                          id: r.id,
                          amount: r.amount,
                          paymentType: r.paymentType,
                          paidDate: r.paidDate
                        })));

                      // Interest from regular payments (if any)
                      // Regular payments are those that are NOT interest-only payments
                      // These include full payments (principal + interest)
                      const regularPayments = loan.repayments.filter(r => r.paymentType !== 'interestOnly');
                      const regularPaymentsCount = regularPayments.length;

                      // Log the regular payments for debugging
                      console.log('Regular payments:', regularPayments.map(r => ({
                        id: r.id,
                        amount: r.amount,
                        paymentType: r.paymentType,
                        paidDate: r.paidDate
                      })));

                      // Count the number of regular payments that have been made
                      // For each regular payment, we count ONLY the interest portion (interestRate)
                      // NOT the full installment amount

                      // For monthly loans, each regular payment includes the interest amount
                      // So we need to extract just the interest portion from each payment

                      // Calculate interest from regular payments
                      // For monthly loans, each regular payment includes both principal and interest
                      // We need to extract ONLY the interest portion from each payment
                      const interestRate = loan.interestRate || 0;

                      // The interest portion of each payment is exactly equal to the interest rate
                      // For example, if interest rate is ₹800, then each regular payment includes ₹800 of interest
                      // This is the correct calculation for monthly loans
                      const interestFromRegularPayments = regularPaymentsCount > 0
                        ? interestRate * regularPaymentsCount
                        : 0;

                      console.log('Interest calculation details:', {
                        interestRate,
                        regularPaymentsCount,
                        calculatedInterest: interestRate * regularPaymentsCount,
                        interestFromRegularPayments
                      });

                      // Total profit
                      // This should be the sum of:
                      // 1. Document charge
                      // 2. Interest-only payments
                      // 3. Interest portion of regular payments

                      // IMPORTANT: For monthly loans, the profit is:
                      // - Document charge (one-time fee)
                      // - Interest from interest-only payments (the full payment amount)
                      // - Interest portion of regular payments (interest rate * number of regular payments)

                      // SIMPLE DIRECT FIX: Just multiply interest rate by number of dues paid
                      // Total Profit = (Interest Amount × Number of Dues Paid) + Document Charge

                      // Count total number of payments (both interest-only and regular)
                      const totalPaymentsMade = loan.repayments.length;

                      // Calculate profit using the simple formula
                      const totalProfit = (loan.interestRate * totalPaymentsMade) + documentCharge;

                      console.log('Simple direct profit calculation:', {
                        interestRate: loan.interestRate,
                        totalPaymentsMade,
                        documentCharge,
                        totalProfit,
                        formula: `(${loan.interestRate} × ${totalPaymentsMade}) + ${documentCharge} = ${totalProfit}`
                      });

                      // Double-check the calculation
                      console.log('Final profit calculation check:', {
                        documentCharge,
                        interestRate: loan.interestRate,
                        totalPaymentsMade,
                        totalProfit,
                        // For the example in the bug report:
                        // - Loan Amount: ₹40,000
                        // - Interest Amount: ₹800/month
                        // - Document Charge: ₹0
                        // - Repayment History:
                        //   - April 2025 – InterestOnly → Profit = ₹800
                        //   - May 2025 – Full Payment → Profit = ₹800
                        // Expected Profit: ₹1,600
                        expectedProfit: (loan.interestRate * totalPaymentsMade) + documentCharge
                      });

                      // Log for debugging
                      console.log('Profit calculation details:', {
                        documentCharge,
                        interestRate: loan.interestRate,
                        totalPaymentsMade,
                        totalProfit,
                        loanAmount: loan.amount,
                        interestOnlyCount: loan.repayments.filter(r => r.paymentType === 'interestOnly').length,
                        regularCount: regularPaymentsCount
                      });

                      // Log for debugging
                      console.log('Profit calculation:', {
                        documentCharge,
                        interestRate: loan.interestRate,
                        totalPaymentsMade,
                        totalProfit,
                        formula: `(${loan.interestRate} × ${totalPaymentsMade}) + ${documentCharge} = ${totalProfit}`,
                        repayments: loan.repayments.map(r => ({
                          amount: r.amount,
                          paymentType: r.paymentType,
                          paidDate: r.paidDate
                        }))
                      });

                      return formatCurrency(totalProfit);
                    })()
                  ) : (
                    // For weekly loans, profit is 10% of principal
                    formatCurrency(loan.amount * 0.1)
                  )}
                </p>
                <p id="loan-profit-explanation" className="text-xs text-gray-500 mt-1 hidden">
                  {loan.repaymentType === 'Monthly' ? (
                    (() => {
                      // SPECIAL CASE: For loans with only interest-only payments
                      const onlyHasInterestOnlyPayments =
                        loan.repayments.length > 0 &&
                        loan.repayments.every(r => r.paymentType === 'interestOnly');

                      if (onlyHasInterestOnlyPayments) {
                        const interestOnlyPaymentsCount = loan.repayments.length;
                        return `Interest from ${interestOnlyPaymentsCount} payment${interestOnlyPaymentsCount !== 1 ? 's' : ''}`;
                      }

                      // Check if there are any repayments
                      if (loan.repayments.length === 0) {
                        return 'No profit yet - no payments have been made';
                      }

                      // Check for document charge
                      const hasDocumentCharge = loan.documentCharge && loan.documentCharge > 0;

                      // Check for interest-only payments
                      const hasInterestOnlyPayments = loan.repayments.filter(r => r.paymentType === 'interestOnly').length > 0;

                      // Check for regular payments
                      const hasRegularPayments = loan.repayments.filter(r => r.paymentType !== 'interestOnly').length > 0;

                      // Build explanation text
                      let explanation = '';

                      if (hasDocumentCharge) {
                        explanation += 'Document charge';
                      }

                      if (hasInterestOnlyPayments) {
                        if (explanation) explanation += ' + ';
                        explanation += 'Interest-only payments';
                      }

                      if (hasRegularPayments) {
                        if (explanation) explanation += ' + ';
                        const months = Math.min(loan.repayments.filter(r => r.paymentType !== 'interestOnly').length, loan.currentMonth);
                        explanation += `Interest from ${months} regular payment${months !== 1 ? 's' : ''}`;
                      }

                      return explanation;
                    })()
                  ) : (
                    <>
                      Fixed profit for {loan.duration} weeks payment schedule
                    </>
                  )}
                </p>
              </div>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Installment Amount</h3>
              <p className="text-xl font-semibold">{formatCurrency(loan.installmentAmount || 0)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Loan Type</h3>
              <p className="text-xl font-semibold">{loan.loanType}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Repayment Type</h3>
              <p className="text-xl font-semibold">{loan.repaymentType}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Duration</h3>
              <p className="text-xl font-semibold">{loan.duration} {loan.loanType === 'Weekly' ? 'weeks' : 'months'}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Disbursement Date</h3>
              <p className="text-xl font-semibold">{formatDate(loan.disbursementDate)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Next Payment Date</h3>
              <p className="text-xl font-semibold">{formatDate(loan.nextPaymentDate)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">End Date</h3>
              <p className="text-xl font-semibold">
                {formatDate(calculateEndDate(loan.disbursementDate, loan.duration))}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        <div className="p-6 border-b flex flex-col md:flex-row justify-between items-start md:items-center space-y-4 md:space-y-0">
          <div className="flex items-center">
            <h2 className="text-xl font-semibold">Payment Schedule</h2>
            <div className="ml-4">
              <span className="text-sm text-gray-600">
                Showing all due, overdue, and upcoming payment schedules
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <Link href={`/loans/${id}/repayments`} className="text-blue-600 hover:text-blue-800">
              View All Repayments
            </Link>
          </div>
        </div>

        {scheduleError && (
          <div className="p-4 bg-red-100 border-l-4 border-red-500 text-red-700">
            <p>{scheduleError}</p>
          </div>
        )}

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
              {loadingSchedules ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center">
                    <div className="flex justify-center items-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-green-700 mr-2"></div>
                      <p>Loading payment schedules...</p>
                    </div>
                  </td>
                </tr>
              ) : paymentSchedules.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    <p className="mb-4">
                      No payment schedules are due, overdue, or upcoming.
                    </p>
                    <p className="mb-4 text-sm">
                      Payment schedules appear automatically when they are due within the next 7 days, when overdue, or when payments have been made. The next upcoming payment is always shown.
                    </p>
                  </td>
                </tr>
              ) : (
                paymentSchedules.map((schedule) => (
                  <tr key={schedule.id} className={`hover:bg-gray-50 ${
                    new Date(schedule.dueDate) <= new Date() && schedule.status === 'Pending' ? 'bg-red-50' : ''
                  }`}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {formatPeriod(schedule.period, schedule.dueDate, loan.repaymentType)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatDate(schedule.dueDate)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatCurrency(schedule.amount)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        schedule.status === 'Paid' ? 'bg-green-100 text-green-800' :
                        schedule.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                        schedule.status === 'Missed' ? 'bg-red-100 text-red-800' :
                        schedule.status === 'InterestOnly' ? 'bg-blue-100 text-blue-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
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
                              disabled={updatingSchedule === schedule.period}
                              className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                            >
                              {updatingSchedule === schedule.period ? 'Processing...' : 'Mark Paid'}
                            </button>
                            {loan.repaymentType === 'Monthly' && (
                              <button
                                onClick={() => handleRecordPayment(schedule.period, 'InterestOnly')}
                                disabled={updatingSchedule === schedule.period}
                                className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                              >
                                {updatingSchedule === schedule.period ? 'Processing...' : 'Interest Only'}
                              </button>
                            )}
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
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination controls */}
        {paymentSchedules.length > 0 && (
          <div className="p-6 border-t">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <div className="mb-4 md:mb-0">
                <span className="text-sm text-gray-500">Total Schedules:</span>
                <span className="ml-2 text-lg font-semibold">{totalCount}</span>
              </div>

              <div className="flex flex-col md:flex-row items-center justify-between w-full md:w-auto space-y-4 md:space-y-0">
                <div className="flex items-center space-x-4">
                  <div className="flex items-center mr-4">
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
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                      </svg>
                    </button>
                    <span className="relative inline-flex items-center px-4 py-2 text-sm font-semibold text-gray-700 bg-white">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className={`relative inline-flex items-center px-2 py-2 ${
                        currentPage === totalPages ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
                      }`}
                    >
                      <span className="sr-only">Next</span>
                      <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
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

                {loan.status === 'Active' && (
                  <Link href={`/loans/${loan.id}/repayments/new`} className="ml-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-300">
                    Record New Payment
                  </Link>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LoanDetailPage;