'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiGet, apiPut } from './apiUtils';

interface GlobalMember {
  id: number;
  name: string;
  contact: string;
  email: string | null;
}

interface Member {
  id: number;
  globalMemberId: number;
  globalMember: GlobalMember;
  joinDate: string;
}

interface Contribution {
  id: number;
  amount: number;
  month: number;
  paidDate: string;
  memberId: number;
  balance: number;
  balancePaymentDate: string | null;
  balancePaymentStatus: string | null;
  actualBalancePaymentDate: string | null;
  notes: string | null;
}

interface ChitFund {
  id: number;
  name: string;
  totalAmount: number;
  monthlyContribution: number;
  duration: number;
  status: string;
  currentMonth: number;
}

export default function MemberContributionsPage() {
  const params = useParams();
  const router = useRouter();
  const chitFundId = params.id;
  const memberId = params.memberId;

  const [chitFund, setChitFund] = useState<ChitFund | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // For viewing contribution details
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null);

  // For updating balance payment status
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch chit fund details using the consolidated API endpoint
        const chitFundData = await apiGet(
          `/api/chit-funds/consolidated?action=detail&id=${chitFundId}`,
          'Failed to fetch chit fund details'
        );
        setChitFund(chitFundData);

        // Fetch member details using the consolidated API endpoint
        const memberData = await apiGet(
          `/api/chit-funds/consolidated?action=member-detail&id=${chitFundId}&memberId=${memberId}`,
          'Failed to fetch member details'
        );
        setMember(memberData);

        // Fetch member's contributions using the consolidated API endpoint
        const contributionsData = await apiGet(
          `/api/chit-funds/consolidated?action=contributions&id=${chitFundId}&memberId=${memberId}`,
          'Failed to fetch contributions'
        );

        // Check if the response has a contributions property (new format) or is an array (old format)
        if (contributionsData.contributions && Array.isArray(contributionsData.contributions)) {
          setContributions(contributionsData.contributions);
        } else {
          // Fallback for backward compatibility
          setContributions(Array.isArray(contributionsData) ? contributionsData : []);
        }

        setError(null);
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError(err.message || 'Failed to load data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    if (chitFundId && memberId) {
      fetchData();
    }
  }, [chitFundId, memberId]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return new Date(dateString).toLocaleDateString('en-IN', options);
  };

  // Generate all months with contribution status
  const getAllMonthsWithStatus = () => {
    if (!chitFund) return [];

    // Create an array of all months up to the current month
    const allMonths = [];
    const currentMonth = chitFund.currentMonth;

    for (let month = 1; month <= currentMonth; month++) {
      // Find contribution for this month if it exists
      const contribution = contributions.find(c => c.month === month);

      if (contribution) {
        // Contribution exists
        allMonths.push({
          month,
          status: 'paid',
          contribution
        });
      } else {
        // No contribution for this month
        allMonths.push({
          month,
          status: 'pending',
          contribution: null
        });
      }
    }

    return allMonths;
  };

  // Handle viewing contribution details
  const handleViewContribution = (contribution: Contribution) => {
    setSelectedContribution(contribution);
    setShowDetailModal(true);
    setUpdateError(null);
  };

  // Handle marking balance as paid
  const handleMarkBalanceAsPaid = async () => {
    if (!selectedContribution || !chitFund) return;

    setIsUpdating(true);
    setUpdateError(null);

    try {
      // Use the apiPut function from apiUtils
      const updatedContribution = await apiPut(
        `/api/chit-funds/consolidated?action=update-contribution&id=${chitFundId}`,
        {
          contributionId: selectedContribution.id,
          amount: selectedContribution.amount,
          paidDate: new Date(selectedContribution.paidDate).toISOString().split('T')[0],
          balancePaymentStatus: 'Paid',
          actualBalancePaymentDate: new Date().toISOString().split('T')[0],
        },
        'Failed to update balance payment status'
      );

      // Update the contributions list
      setContributions(contributions.map(c =>
        c.id === updatedContribution.id ? updatedContribution : c
      ));

      // Update the selected contribution
      setSelectedContribution(updatedContribution);

    } catch (error: any) {
      console.error('Error updating balance payment status:', error);
      setUpdateError(error.message || 'Failed to update balance payment status');
    } finally {
      setIsUpdating(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading member contributions...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Error</p>
          <p>{error}</p>
          <button
            onClick={() => router.back()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-300"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!chitFund || !member) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <p className="font-bold">Not Found</p>
          <p>The chit fund or member you are looking for does not exist or has been removed.</p>
          <Link href={`/chit-funds/${chitFundId}/members`} className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300">
            Back to Members
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-blue-700">{member.globalMember.name}'s Contributions</h1>
          <p className="text-gray-600">
            {chitFund.name} | Monthly Contribution: {formatCurrency(chitFund.monthlyContribution)}
          </p>
        </div>
        <div>
          <Link href={`/chit-funds/${chitFundId}/members`} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300">
            Back to Members
          </Link>
        </div>
      </div>

      {/* Member Info Card */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <p className="text-sm text-gray-500">Member Name</p>
            <p className="text-lg font-semibold">{member.globalMember.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Contact</p>
            <p className="text-lg font-semibold">{member.globalMember.contact}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Join Date</p>
            <p className="text-lg font-semibold">{formatDate(member.joinDate)}</p>
          </div>
        </div>
      </div>

      {/* Contributions Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Month
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Paid Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Balance
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Balance Payment Date
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {chitFund && getAllMonthsWithStatus().length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                    No months to display for this member.
                  </td>
                </tr>
              ) : (
                getAllMonthsWithStatus().map((monthData) => (
                  <tr
                    key={monthData.month}
                    className={`hover:bg-gray-50 ${monthData.status === 'paid' ? 'cursor-pointer' : ''}`}
                    onClick={() => monthData.contribution && handleViewContribution(monthData.contribution)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">Month {monthData.month}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {monthData.status === 'paid'
                          ? formatCurrency(monthData.contribution!.amount)
                          : formatCurrency(chitFund?.monthlyContribution || 0)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {monthData.status === 'paid' ? (
                        <div className="text-sm text-gray-900">{formatDate(monthData.contribution!.paidDate)}</div>
                      ) : (
                        <div className="text-sm text-red-600 font-semibold">Pending</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {monthData.status === 'paid' ? (
                        monthData.contribution!.balancePaymentStatus === 'Paid' ? (
                          <div className="text-sm text-green-600 font-semibold">Paid in full</div>
                        ) : monthData.contribution!.balance > 0 ? (
                          <div className="text-sm text-red-600 font-semibold">{formatCurrency(monthData.contribution!.balance)}</div>
                        ) : (
                          <div className="text-sm text-green-600 font-semibold">Paid in full</div>
                        )
                      ) : (
                        <div className="text-sm text-gray-500">-</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {monthData.status === 'paid' ? (
                        monthData.contribution!.balancePaymentStatus === 'Paid' && monthData.contribution!.actualBalancePaymentDate ? (
                          <div className="text-sm text-green-600">{formatDate(monthData.contribution!.actualBalancePaymentDate)}</div>
                        ) : monthData.contribution!.balancePaymentDate ? (
                          <div className="text-sm text-gray-900">{formatDate(monthData.contribution!.balancePaymentDate)}</div>
                        ) : (
                          <div className="text-sm text-gray-500">-</div>
                        )
                      ) : (
                        <div className="text-sm text-gray-500">-</div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Contribution Detail Modal */}
      {showDetailModal && selectedContribution && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-blue-700">Contribution Details</h2>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg mb-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Member</p>
                  <p className="text-md font-semibold">{member.globalMember.name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Month</p>
                  <p className="text-md font-semibold">Month {selectedContribution.month}</p>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">Payment Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Amount Paid</p>
                  <p className="text-md font-semibold">{formatCurrency(selectedContribution.amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Payment Date</p>
                  <p className="text-md font-semibold">{formatDate(selectedContribution.paidDate)}</p>
                </div>
              </div>
            </div>

            {(selectedContribution.balance > 0 || selectedContribution.balancePaymentStatus === 'Paid') && (
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2">Balance Information</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">Balance Amount</p>
                    {selectedContribution.balancePaymentStatus === 'Paid' ? (
                      <p className="text-md font-semibold text-green-600">Paid in full</p>
                    ) : (
                      <p className="text-md font-semibold text-red-600">{formatCurrency(selectedContribution.balance)}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Status</p>
                    <p className={`text-md font-semibold ${
                      selectedContribution.balancePaymentStatus === 'Paid'
                        ? 'text-green-600'
                        : selectedContribution.balancePaymentStatus === 'Overdue'
                        ? 'text-red-600'
                        : 'text-yellow-600'
                    }`}>
                      {selectedContribution.balancePaymentStatus || 'Pending'}
                    </p>
                  </div>

                  {selectedContribution.balancePaymentDate && (
                    <div className="col-span-2">
                      <p className="text-sm text-gray-500">Expected Payment Date</p>
                      <p className="text-md font-semibold">{formatDate(selectedContribution.balancePaymentDate)}</p>
                    </div>
                  )}

                  {selectedContribution.actualBalancePaymentDate && (
                    <div className="col-span-2">
                      <p className="text-sm text-gray-500">Actual Payment Date</p>
                      <p className="text-md font-semibold text-green-600">{formatDate(selectedContribution.actualBalancePaymentDate)}</p>
                    </div>
                  )}

                  {/* Mark as Paid button for pending balances */}
                  {selectedContribution.balance > 0 && selectedContribution.balancePaymentStatus !== 'Paid' && (
                    <div className="col-span-2 mt-3">
                      <button
                        onClick={handleMarkBalanceAsPaid}
                        disabled={isUpdating}
                        className={`w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-300 ${isUpdating ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {isUpdating ? (
                          <span className="flex items-center justify-center">
                            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Processing...
                          </span>
                        ) : (
                          'Mark Balance as Paid'
                        )}
                      </button>
                    </div>
                  )}

                  {/* Error message */}
                  {updateError && (
                    <div className="col-span-2 mt-2">
                      <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded text-sm">
                        {updateError}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowDetailModal(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
