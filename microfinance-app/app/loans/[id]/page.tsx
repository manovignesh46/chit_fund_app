'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

// Define interface for Loan type
interface Repayment {
  id: number;
  paidDate: string;
  amount: number;
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

  useEffect(() => {
    const fetchLoanDetails = async () => {
      try {
        setLoading(true);

        // Fetch loan details
        const loanResponse = await fetch(`/api/loans/${id}`);
        if (!loanResponse.ok) {
          throw new Error('Failed to fetch loan details');
        }
        const loanData = await loanResponse.json();

        // Fetch repayments for this loan
        const repaymentsResponse = await fetch(`/api/loans/${id}/repayments`);
        if (!repaymentsResponse.ok) {
          throw new Error('Failed to fetch repayments');
        }
        const repaymentsData = await repaymentsResponse.json();

        // Combine the data
        const combinedData = {
          ...loanData,
          repayments: repaymentsData || [],
          // Map remainingAmount to remainingBalance for compatibility
          remainingBalance: loanData.remainingAmount
        };

        setLoan(combinedData);
      } catch (error) {
        console.error('Error fetching loan details:', error);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchLoanDetails();
    }
  }, [id]);

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

  // Calculate end date based on disbursement date and duration
  const calculateEndDate = (disbursementDate: string, durationMonths: number): string => {
    if (!disbursementDate) return '';

    const startDate = new Date(disbursementDate);
    const endDate = new Date(startDate);
    endDate.setMonth(startDate.getMonth() + durationMonths);

    return endDate.toISOString();
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

        // Get the day of week for the start date (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
        const startDayOfWeek = startDateClean.getDay();
        const currentDayOfWeek = currentDateClean.getDay();

        // Calculate completed weeks
        const completedWeeks = Math.floor(daysDiff / 7);

        // For weekly loans, if we're on the same day of the week as the start date,
        // we're still in the current week number. Only after that day passes do we move to the next week.
        // Example:
        // - Disbursement Date: April 26, 2025 (Saturday, day 6)
        // - Current Date: May 10, 2025 (Saturday, day 6) -> Week 2
        // - Current Date: May 11, 2025 (Sunday, day 0) -> Week 3

        // If current day of week is the same as start day of week, we're exactly at completedWeeks + 1
        // Otherwise, we need to check if we've passed that day in the current week
        const currentWeek = completedWeeks + 1;

        console.log('Weekly loan calculation:', {
          startDate: startDateClean.toISOString(),
          currentDate: currentDateClean.toISOString(),
          daysDiff,
          startDayOfWeek,
          currentDayOfWeek,
          completedWeeks,
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
          const refreshResponse = await fetch(`/api/loans/${id}`);
          if (refreshResponse.ok) {
            const refreshedData = await refreshResponse.json();
            setLoan(prev => {
              if (!prev) return refreshedData;
              return {
                ...refreshedData,
                repayments: prev.repayments || []
              };
            });
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
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-green-700">Loan Details</h1>
        <div className="flex space-x-3">
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
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Interest Amount</h3>
              <p className="text-xl font-semibold">{formatCurrency(loan.interestRate)}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Document Charge</h3>
              <p className="text-xl font-semibold">{formatCurrency(loan.documentCharge || 0)}</p>
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
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Repayment History</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Payment Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {loan.repayments.map((repayment) => (
                <tr key={repayment.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{formatDate(repayment.paidDate)}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{formatCurrency(repayment.amount)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-6 border-t">
          <div className="flex justify-between items-center">
            <div>
              <span className="text-sm text-gray-500">Total Paid:</span>
              <span className="ml-2 text-lg font-semibold">{formatCurrency(loan.repayments.reduce((sum, item) => sum + item.amount, 0))}</span>
            </div>
            {loan.status === 'Active' && (
              <Link href={`/loans/${loan.id}/repayments/new`} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-300">
                Record New Payment
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoanDetailPage;