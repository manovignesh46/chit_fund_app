// @ts-nocheck
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Loan, Repayment, PaymentSchedule } from '../../../lib/interfaces';
import { formatCurrency, formatDate, calculateLoanProfit } from '../../../lib/formatUtils';
import dynamic from 'next/dynamic';
import { LoanDetailSkeleton } from '../../components/skeletons/DetailSkeletons';
import {

ExportButton,
  EditButton,
  BackButton,
  DeleteButton,
  ActionButtonGroup
} from '../../components/buttons/ActionButtons';

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

  const [showProfit, setShowProfit] = useState(false); // default is hidden


  // Fetch payment schedules
  const fetchPaymentSchedules = async () => {
    if (!id) return;

    try {
      setLoadingSchedules(true);
      setScheduleError(null);

      // Ensure ID is a valid number
      const numericId = typeof id === 'string' ? parseInt(id, 10) : Array.isArray(id) ? parseInt(id[0], 10) : 0;

      if (!numericId || isNaN(numericId)) {
        console.error(`Invalid loan ID: Unable to parse "${id}" as a number`);
        throw new Error('Invalid loan ID format');
      }

      // Build the URL with query parameters
      // Explicitly set includeAll=false to maintain original filtering behavior
      const url = `/api/loans/consolidated?action=payment-schedules&id=${numericId}&page=${currentPage}&pageSize=${pageSize}&includeAll=false`;

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch payment schedules');
      }

      const data = await response.json();
      console.log('Payment schedules API response:', data);

      if (data.schedules && Array.isArray(data.schedules)) {
        // Response has a schedules property (paginated format)
        setPaymentSchedules(data.schedules);
        setTotalCount(data.totalCount || 0);
        setTotalPages(data.totalPages || 1);
      } else if (Array.isArray(data)) {
        // Response is a direct array of schedules
        setPaymentSchedules(data);
        setTotalCount(data.length);
        setTotalPages(1);
        console.log('Found direct array of schedules:', data);
      } else {
        console.warn('No valid payment schedules found in response:', data);
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

      // Validate the ID parameter
      if (!id) {
        console.error('Invalid loan ID: ID is undefined or null');
        throw new Error('Invalid loan ID');
      }

      // Ensure ID is a valid number
      const numericId = typeof id === 'string' ? parseInt(id, 10) : Array.isArray(id) ? parseInt(id[0], 10) : 0;

      if (!numericId || isNaN(numericId)) {
        console.error(`Invalid loan ID: Unable to parse "${id}" as a number`);
        throw new Error('Invalid loan ID format');
      }

      // Get the amount from the loan's installment amount
      const amount = loan?.installmentAmount || 0;

      console.log(`Recording payment for period ${period}, amount ${amount}, type ${paymentType}`);

      // The API expects scheduleId, not period
      const response = await fetch(`/api/loans/consolidated?action=add-repayment&id=${numericId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scheduleId: period, // Use period as scheduleId
          amount,
          paidDate: new Date().toISOString().split('T')[0],
          paymentType: paymentType === 'InterestOnly' ? 'interestOnly' : 'full'
        }),
      });

      // Log the response status
      console.log(`Payment API response status: ${response.status}`);

      if (!response.ok) {
        // Get the response text first
        const errorText = await response.text();
        console.error('Error response text:', errorText);

        // Try to parse as JSON if possible
        let errorMessage = 'Failed to record payment';
        try {
          if (errorText) {
            const errorData = JSON.parse(errorText);
            console.error('Error response data:', errorData);
            if (errorData.error) {
              errorMessage = errorData.error;
            }
          }
        } catch (e) {
          console.error('Could not parse error response as JSON:', e);
          errorMessage = errorText || errorMessage;
        }

        throw new Error(errorMessage);
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

      // Validate the ID parameter
      if (!id) {
        console.error('Invalid loan ID: ID is undefined or null');
        throw new Error('Invalid loan ID');
      }

      // Ensure ID is a valid number
      const numericId = typeof id === 'string' ? parseInt(id, 10) : Array.isArray(id) ? parseInt(id[0], 10) : 0;

      if (!numericId || isNaN(numericId)) {
        console.error(`Invalid loan ID: Unable to parse "${id}" as a number`);
        throw new Error('Invalid loan ID format');
      }

      console.log(`Fetching loan details for ID: ${numericId}`);

      // First, update the overdue amount to ensure it's current
      try {
        console.log('Updating overdue amount...');
        const overdueResponse = await fetch(`/api/loans/consolidated?action=update-overdue&id=${numericId}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        });

        if (overdueResponse.ok) {
          console.log('Overdue amount updated successfully');
        } else {
          const errorText = await overdueResponse.text();
          console.warn(`Failed to update overdue amount: ${overdueResponse.status} ${overdueResponse.statusText}`, errorText);
        }
      } catch (overdueError) {
        console.error('Error updating overdue amount:', overdueError);
        // Continue with fetching loan details even if updating overdue amount fails
      }

      // Fetch loan details
      const loanResponse = await fetch(`/api/loans/consolidated?action=detail&id=${numericId}`);
      if (!loanResponse.ok) {
        const errorText = await loanResponse.text();
        console.error(`Failed to fetch loan details: ${loanResponse.status} ${loanResponse.statusText}`, errorText);
        throw new Error(`Failed to fetch loan details: ${loanResponse.statusText}`);
      }
      const loanData = await loanResponse.json();

      console.log('Loan data from API:', loanData);

      // Fetch paginated repayments for this loan
      const repaymentsResponse = await fetch(`/api/loans/consolidated?action=repayments&id=${numericId}&page=${currentPage}&pageSize=${pageSize}`);
      if (!repaymentsResponse.ok) {
        const errorText = await repaymentsResponse.text();
        console.error(`Failed to fetch repayments: ${repaymentsResponse.status} ${repaymentsResponse.statusText}`, errorText);
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
        repayments: repaymentsList || []
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
  const formatDate = (dateString: string | Date | null | undefined): string => {
    if (!dateString) return 'N/A';
    const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
    return new Intl.DateTimeFormat('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  // Format period to show month and year
  const formatPeriod = (period: number, dueDate: string | Date, repaymentType: string): string => {
    const date = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;

    if (repaymentType === 'Weekly') {
      return `Week ${period} (${date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })})`;
    } else {
      return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    }
  };

  // Calculate end date based on disbursement date and duration
  const calculateEndDate = (disbursementDate: string | Date, durationMonths: number): string => {
    if (!disbursementDate) return '';

    const startDate = typeof disbursementDate === 'string' ? new Date(disbursementDate) : disbursementDate;
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
      // Validate the ID parameter
      if (!id) {
        console.error('Invalid loan ID: ID is undefined or null');
        throw new Error('Invalid loan ID');
      }

      // Ensure ID is a valid number
      const numericId = typeof id === 'string' ? parseInt(id, 10) : Array.isArray(id) ? parseInt(id[0], 10) : 0;

      if (!numericId || isNaN(numericId)) {
        console.error(`Invalid loan ID: Unable to parse "${id}" as a number`);
        throw new Error('Invalid loan ID format');
      }

      const response = await fetch(`/api/loans/consolidated?action=delete-repayment&id=${numericId}`, {
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
    try {
      // Validate the ID parameter
      if (!id) {
        console.error('Invalid loan ID: ID is undefined or null');
        throw new Error('Invalid loan ID');
      }

      // Ensure ID is a valid number
      const numericId = typeof id === 'string' ? parseInt(id, 10) : Array.isArray(id) ? parseInt(id[0], 10) : 0;

      if (!numericId || isNaN(numericId)) {
        console.error(`Invalid loan ID: Unable to parse "${id}" as a number`);
        throw new Error('Invalid loan ID format');
      }

      console.log(`Updating loan ID ${numericId} to month ${monthValue}`);

      const response = await fetch(`/api/loans/consolidated?action=update&id=${numericId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          currentMonth: monthValue,
        }),
      });

      // Check if the response is OK
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response text:', errorText);

        // Try to parse as JSON if possible
        let errorDetails = response.statusText;
        try {
          if (errorText) {
            const errorJson = JSON.parse(errorText);
            if (errorJson.error) {
              errorDetails = errorJson.error;
            }
          }
        } catch (e) {
          console.error('Could not parse error response as JSON:', e);
          errorDetails = errorText || errorDetails;
        }

        throw new Error(`Failed to update current month: ${errorDetails}`);
      }

      // Parse the response
      const responseText = await response.text();
      console.log('Raw response:', responseText);

      let updatedLoan;
      try {
        updatedLoan = responseText ? JSON.parse(responseText) : { currentMonth: monthValue };
      } catch (e) {
        console.error('Error parsing response JSON:', e);
        // If we can't parse the response, just use the month value we sent
        updatedLoan = { currentMonth: monthValue };
      }

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
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      alert(`Failed to update current month: ${errorMessage}`);
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

      // Validate the ID parameter
      if (!id) {
        console.error('Invalid loan ID: ID is undefined or null');
        throw new Error('Invalid loan ID');
      }

      // Ensure ID is a valid number
      const numericId = typeof id === 'string' ? parseInt(id, 10) : Array.isArray(id) ? parseInt(id[0], 10) : 0;

      if (!numericId || isNaN(numericId)) {
        console.error(`Invalid loan ID: Unable to parse "${id}" as a number`);
        throw new Error('Invalid loan ID format');
      }

      // Generate filename directly from loan data
      const borrowerName = loan.borrower.name.replace(/[^a-zA-Z0-9]/g, '_');
      const loanAmount = Math.round(loan.amount).toString();
      const disbursementDate = new Date(loan.disbursementDate)
        .toISOString()
        .split('T')[0];

      const filename = `${borrowerName}_${loanAmount}_${disbursementDate}.xlsx`;
      console.log('Generated filename:', filename);

      // Call the export API endpoint
      const response = await fetch(`/api/loans/consolidated?action=export&id=${numericId}`);

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

      console.log('Updating current month with dates:', {
        startDate: startDate.toISOString(),
        currentDate: currentDate.toISOString(),
        currentMonth: loan.currentMonth,
        duration: loan.duration
      });

      // Check if disbursement date is in the future
      if (startDate > currentDate) {
        console.log('Disbursement date is in the future, setting current period to 0');
        // If disbursement date is in the future, current period should be 0 (not started yet)
        if (loan.currentMonth !== 0) {
          // Only update if it's not already 0
          return updateLoanCurrentMonth(0);
        } else {
          // Already at period 0, no need to update
          console.log('Loan is already at period 0, no update needed');
          setUpdating(false);
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
      console.log(`Updating loan current month from ${loan.currentMonth} to ${newCurrentPeriod}`);
      await updateLoanCurrentMonth(newCurrentPeriod);

    } catch (error) {
      console.error('Error in updateCurrentMonth:', error);

      // Refresh the page data to ensure we have the latest state
      if (id) {
        try {
          // Ensure ID is a valid number
          const numericId = typeof id === 'string' ? parseInt(id, 10) : Array.isArray(id) ? parseInt(id[0], 10) : 0;

          if (!numericId || isNaN(numericId)) {
            console.error(`Invalid loan ID: Unable to parse "${id}" as a number`);
            throw new Error('Invalid loan ID format');
          }

          // Fetch loan details
          const refreshResponse = await fetch(`/api/loans/consolidated?action=detail&id=${numericId}`);
          if (refreshResponse.ok) {
            const refreshedLoanData = await refreshResponse.json();

            // Fetch repayments again
            const refreshRepaymentsResponse = await fetch(`/api/loans/consolidated?action=repayments&id=${numericId}&page=${currentPage}&pageSize=${pageSize}`);
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

  const toggleProfit = () => {
    setShowProfit(!showProfit);
  };

  if (loading) {
    return <LoanDetailSkeleton />;
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
        <ActionButtonGroup>
          <ExportButton
            onClick={handleExport}
            disabled={isExporting}
            isExporting={isExporting}
          >
            Export as Excel
          </ExportButton>
          <EditButton
            href={`/loans/${id}/edit`}
          >
            Edit Loan
          </EditButton>
          <BackButton
            href="/loans"
          >
            Back to Loans
          </BackButton>
        </ActionButtonGroup>
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
                    {(() => {
                      // Calculate the current period based on disbursement date
                      const startDate = new Date(loan.disbursementDate);
                      const currentDate = new Date();

                      // Check if disbursement date is in the future
                      if (startDate > currentDate) {
                        return <span className="text-yellow-600">Not Started</span>;
                      }

                      let calculatedPeriod;

                      if (loan.loanType === 'Weekly') {
                        // Calculate weeks difference for weekly loans
                        const startDateClean = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
                        const currentDateClean = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());

                        // Calculate days difference
                        const daysDiff = Math.floor((currentDateClean.getTime() - startDateClean.getTime()) / (24 * 60 * 60 * 1000));

                        // Calculate the week number
                        const isExactMultipleOfSeven = daysDiff % 7 === 0;
                        const currentWeek = Math.floor(daysDiff / 7) + (isExactMultipleOfSeven ? 0 : 1);

                        // Ensure we don't exceed the duration
                        calculatedPeriod = Math.min(Math.max(1, currentWeek), loan.duration);
                      } else {
                        // Calculate months difference for monthly loans
                        let monthsDiff = (currentDate.getFullYear() - startDate.getFullYear()) * 12 +
                                        (currentDate.getMonth() - startDate.getMonth()) + 1;

                        // Adjust if we haven't reached the same day of the month yet
                        if (currentDate.getDate() < startDate.getDate()) {
                          monthsDiff--;
                        }

                        // Ensure we don't exceed the duration
                        calculatedPeriod = Math.min(Math.max(1, monthsDiff), loan.duration);
                      }

                      return (
                        <>{calculatedPeriod} <span className="text-sm text-gray-500">/ {loan.duration}</span></>
                      );
                    })()}
                  </div>
                  {(() => {
                    // Calculate the current period to check if update is needed
                    const startDate = new Date(loan.disbursementDate);
                    const currentDate = new Date();

                    // Check if disbursement date is in the future
                    if (startDate > currentDate) {
                      // Should be "Not Started" (period 0)
                      return loan.currentMonth !== 0 && (
                        <button
                          onClick={updateCurrentMonth}
                          disabled={updating}
                          className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {updating ? 'Updating...' : 'Update'}
                        </button>
                      );
                    }

                    let calculatedPeriod;

                    if (loan.loanType === 'Weekly') {
                      // Calculate weeks difference for weekly loans
                      const startDateClean = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
                      const currentDateClean = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate());

                      // Calculate days difference
                      const daysDiff = Math.floor((currentDateClean.getTime() - startDateClean.getTime()) / (24 * 60 * 60 * 1000));

                      // Calculate the week number
                      const isExactMultipleOfSeven = daysDiff % 7 === 0;
                      const currentWeek = Math.floor(daysDiff / 7) + (isExactMultipleOfSeven ? 0 : 1);

                      // Ensure we don't exceed the duration
                      calculatedPeriod = Math.min(Math.max(1, currentWeek), loan.duration);
                    } else {
                      // Calculate months difference for monthly loans
                      let monthsDiff = (currentDate.getFullYear() - startDate.getFullYear()) * 12 +
                                      (currentDate.getMonth() - startDate.getMonth()) + 1;

                      // Adjust if we haven't reached the same day of the month yet
                      if (currentDate.getDate() < startDate.getDate()) {
                        monthsDiff--;
                      }

                      // Ensure we don't exceed the duration
                      calculatedPeriod = Math.min(Math.max(1, monthsDiff), loan.duration);
                    }

                    // Only show update button if the calculated period differs from the current period
                    return loan.currentMonth !== calculatedPeriod && (
                      <button
                        onClick={updateCurrentMonth}
                        disabled={updating}
                        className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {updating ? 'Updating...' : 'Update'}
                      </button>
                    );
                  })()}
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
              <p className="text-xl font-semibold">{formatCurrency(loan.remainingAmount)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">
                Overdue
              </h3>
              <p className={`text-xl font-semibold ${loan.missedPayments > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {loan.missedPayments > 0 ? `${loan.missedPayments} ${loan.missedPayments === 1 ? 'payment' : 'payments'}` : 'None'}
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
                  // if (profitElement) {
                  //   profitElement.classList.toggle('hidden');
                  // }
                  // if (profitExplanation) {
                  //   profitExplanation.classList.toggle('hidden');
                  // }
                  toggleProfit
                console.log("showProfit->", showProfit)
                }}
              >
                Total Profit
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </h3>
              <div>
              {showProfit && <p id="loan-profit" className="text-xl font-semibold text-green-600">
                  {loan.repaymentType === 'Monthly' ? (
                    (() => {
                      // SPECIAL CASE: For loans with only interest-only payments
                      const onlyHasInterestOnlyPayments =
                        loan.repayments && loan.repayments.length > 0 &&
                        loan.repayments.every((r: any) => r.paymentType === 'interestOnly');

                      if (onlyHasInterestOnlyPayments) {
                        // For loans with only interest-only payments, the profit is the interest rate
                        // multiplied by the number of interest-only payments made
                        const interestOnlyPaymentsCount = loan.repayments ? loan.repayments.length : 0;
                        const profit = (loan.interestRate || 0) * interestOnlyPaymentsCount;
                        console.log('Detected interest-only payments only case - profit:', profit, 'from', interestOnlyPaymentsCount, 'payments');
                        return formatCurrency(profit);
                      }

                      // Document charge (one-time)
                      const documentCharge = (loan.documentCharge || 0);

                      // Sum of all interest-only payments
                      // For interest-only payments, the entire payment amount is interest (profit)
                      // This calculation is no longer used but kept for reference
                      // const interestOnlyPayments = loan.repayments
                      //   ? loan.repayments
                      //       .filter((repayment: any) => repayment.paymentType === 'interestOnly')
                      //       .reduce((sum: number, repayment: any) => sum + repayment.amount, 0)
                      //   : 0;

                      // Log the interest-only payments for debugging
                      console.log('Interest-only payments:', loan.repayments
                        ? loan.repayments
                            .filter((r: any) => r.paymentType === 'interestOnly')
                            .map((r: any) => ({
                              id: r.id,
                              amount: r.amount,
                              paymentType: r.paymentType,
                              paidDate: r.paidDate
                            }))
                        : []);

                      // Interest from regular payments (if any)
                      // Regular payments are those that are NOT interest-only payments
                      // These include full payments (principal + interest)
                      const regularPayments = loan.repayments
                        ? loan.repayments.filter((r: any) => r.paymentType !== 'interestOnly')
                        : [];
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
                      const totalPaymentsMade = loan.repayments ? loan.repayments.length : 0;

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
                        interestOnlyCount: loan.repayments
                          ? loan.repayments.filter((r: any) => r.paymentType === 'interestOnly').length
                          : 0,
                        regularCount: regularPaymentsCount
                      });

                      // Log for debugging
                      console.log('Profit calculation:', {
                        documentCharge,
                        interestRate: loan.interestRate,
                        totalPaymentsMade,
                        totalProfit,
                        formula: `(${loan.interestRate} × ${totalPaymentsMade}) + ${documentCharge} = ${totalProfit}`,
                        repayments: loan.repayments
                          ? loan.repayments.map((r: any) => ({
                              amount: r.amount,
                              paymentType: r.paymentType,
                              paidDate: r.paidDate
                            }))
                          : []
                      });

                      return formatCurrency(totalProfit);
                    })()
                  ) : (
                    // For weekly loans, profit is 10% of principal
                    formatCurrency(loan.amount * 0.1)
                  )}
                </p>}
                <p id="loan-profit-explanation" className="text-xs text-gray-500 mt-1 hidden">
                  {loan.repaymentType === 'Monthly' ? (
                    (() => {
                      // SPECIAL CASE: For loans with only interest-only payments
                      const onlyHasInterestOnlyPayments =
                        loan.repayments && loan.repayments.length > 0 &&
                        loan.repayments.every((r: any) => r.paymentType === 'interestOnly');

                      if (onlyHasInterestOnlyPayments) {
                        const interestOnlyPaymentsCount = loan.repayments ? loan.repayments.length : 0;
                        return `Interest from ${interestOnlyPaymentsCount} payment${interestOnlyPaymentsCount !== 1 ? 's' : ''}`;
                      }

                      // Check if there are any repayments
                      if (!loan.repayments || loan.repayments.length === 0) {
                        return 'No profit yet - no payments have been made';
                      }

                      // Check for document charge
                      const hasDocumentCharge = loan.documentCharge && loan.documentCharge > 0;

                      // Check for interest-only payments
                      const hasInterestOnlyPayments = loan.repayments
                        ? loan.repayments.filter((r: any) => r.paymentType === 'interestOnly').length > 0
                        : false;

                      // Check for regular payments
                      const hasRegularPayments = loan.repayments
                        ? loan.repayments.filter((r: any) => r.paymentType !== 'interestOnly').length > 0
                        : false;

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
                        const months = Math.min(
                          loan.repayments
                            ? loan.repayments.filter((r: any) => r.paymentType !== 'interestOnly').length
                            : 0,
                          loan.currentMonth
                        );
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
                paymentSchedules.map((schedule) => {
                  // Check if payment is due tomorrow
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);

                  const tomorrow = new Date(today);
                  tomorrow.setDate(tomorrow.getDate() + 1);

                  const dueDate = new Date(schedule.dueDate);
                  dueDate.setHours(0, 0, 0, 0);

                  const isDueTomorrow = dueDate.getTime() === tomorrow.getTime();

                  // Calculate the grace period date (3 days after due date)
                  const gracePeriodDate = new Date(dueDate);
                  gracePeriodDate.setDate(gracePeriodDate.getDate() + 3);

                  // Only mark as overdue if it's past the grace period (3 days after due date)
                  const isOverdue = dueDate < today && today >= gracePeriodDate &&
                    (schedule.status === 'Pending' || schedule.status === 'Overdue');

                  return (
                    <tr key={schedule.id} className={`hover:bg-gray-50 ${
                      isOverdue ? 'bg-red-50' :
                      isDueTomorrow ? 'bg-yellow-50' : ''
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
                      <div className="flex flex-col space-y-1">
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          schedule.status === 'Paid' ? 'bg-green-100 text-green-800' :
                          schedule.status === 'Pending' ? (
                            isOverdue ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                          ) :
                          schedule.status === 'Overdue' ? 'bg-red-100 text-red-800' :
                          schedule.status === 'Missed' ? 'bg-red-100 text-red-800' :
                          schedule.status === 'InterestOnly' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {isOverdue ? 'Overdue' : schedule.status}
                        </span>

                        {isDueTomorrow && (
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200"
                                title="This loan payment is due tomorrow">
                            Due Tomorrow
                          </span>
                        )}
                      </div>
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
                );
              })
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