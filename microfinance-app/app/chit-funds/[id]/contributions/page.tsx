'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiGet, apiPost, apiPut, apiDelete } from '@/lib/apiUtils';

interface GlobalMember {
  id: number;
  name: string;
  contact: string;
  email: string | null;
  address: string | null;
}

interface Member {
  id: number;
  globalMember: GlobalMember;
  contribution: number;
}

interface Contribution {
  id: number;
  amount: number;
  month: number;
  paidDate: string;
  memberId: number;
  member: Member;
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
  membersCount: number;
  status: string;
  currentMonth: number;
}

// This component has been optimized for performance
export default function ChitFundContributionsPage() {
  const params = useParams();
  const router = useRouter();
  const chitFundId = params.id;

  const [chitFund, setChitFund] = useState<ChitFund | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // For adding new contribution
  const [showAddForm, setShowAddForm] = useState(false);
  const [newContribution, setNewContribution] = useState({
    memberId: '',
    month: '',
    amount: '',
    paidDate: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
    balancePaymentDate: '',
    balancePaymentStatus: 'Pending',
    actualBalancePaymentDate: '',
  });
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // For filtering
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedMember, setSelectedMember] = useState<string>('all');

  // For view mode
  const [viewMode, setViewMode] = useState<'member' | 'month'>('member');

  // For deletion
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [contributionToDelete, setContributionToDelete] = useState<number | null>(null);

  // For editing
  const [showEditForm, setShowEditForm] = useState(false);
  const [contributionToEdit, setContributionToEdit] = useState<Contribution | null>(null);
  const [editFormData, setEditFormData] = useState({
    amount: '',
    paidDate: '',
    balancePaymentDate: '',
    balancePaymentStatus: '',
    actualBalancePaymentDate: '',
  });

  // For viewing contribution details
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedContribution, setSelectedContribution] = useState<Contribution | null>(null);
  const [editFormErrors, setEditFormErrors] = useState<{[key: string]: string}>({});
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch chit fund details using the consolidated API endpoint
        try {
          const chitFundData = await apiGet(
            `/api/chit-funds/consolidated?action=detail&id=${chitFundId}`,
            'Failed to fetch chit fund details'
          );
          console.log('Chit Fund Data:', chitFundData);
          setChitFund(chitFundData);
        } catch (error: any) {
          // Handle 404 errors specifically
          if (error.message.includes('not found')) {
            setChitFund(null);
            setError(`Chit fund with ID ${chitFundId} not found. It may have been deleted or you don't have permission to view it.`);
            setLoading(false);
            return; // Exit early
          }

          // Handle authentication errors
          if (error.message.includes('Authentication') || error.message.includes('Unauthorized')) {
            setError('Authentication error. Please log in again to continue.');
            // Redirect to login page after a short delay
            setTimeout(() => {
              window.location.href = `/login?from=/chit-funds/${chitFundId}/contributions&error=session_expired`;
            }, 3000);
            return; // Exit early
          }

          // Re-throw the error to be caught by the outer catch block
          throw error;
        }

        // Fetch members using the consolidated API endpoint
        const membersData = await apiGet(
          `/api/chit-funds/consolidated?action=members&id=${chitFundId}`,
          'Failed to fetch members'
        );
        console.log('Members Data:', membersData);

        // Check if the response has pagination metadata
        if (membersData.members && Array.isArray(membersData.members)) {
          setMembers(membersData.members);
        } else {
          // Fallback for backward compatibility
          setMembers(Array.isArray(membersData) ? membersData : []);
        }

        // Fetch contributions using the consolidated API endpoint
        const contributionsData = await apiGet(
          `/api/chit-funds/consolidated?action=contributions&id=${chitFundId}`,
          'Failed to fetch contributions'
        );
        console.log('Contributions Data:', contributionsData);

        // Check if the response has a contributions property (new format) or is an array (old format)
        if (contributionsData.contributions && Array.isArray(contributionsData.contributions)) {
          setContributions(contributionsData.contributions);
        } else {
          // Fallback for backward compatibility
          setContributions(Array.isArray(contributionsData) ? contributionsData : []);
        }

        setError(null);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError(`Failed to load data: ${err instanceof Error ? err.message : 'Unknown error'}. Please try again later.`);
      } finally {
        setLoading(false);
      }
    };

    if (chitFundId) {
      fetchData();
    }
  }, [chitFundId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNewContribution({
      ...newContribution,
      [name]: value,
    });
  };

  const validateForm = () => {
    const errors: {[key: string]: string} = {};

    if (!newContribution.memberId) {
      errors.memberId = 'Member is required';
    }

    if (!newContribution.month) {
      errors.month = 'Month is required';
    } else if (isNaN(Number(newContribution.month)) || Number(newContribution.month) < 1 || Number(newContribution.month) > (chitFund?.duration || 0)) {
      errors.month = `Month must be between 1 and ${chitFund?.duration || 0}`;
    }

    if (!newContribution.amount) {
      errors.amount = 'Amount is required';
    } else if (isNaN(Number(newContribution.amount)) || Number(newContribution.amount) <= 0) {
      errors.amount = 'Amount must be a positive number';
    }

    if (!newContribution.paidDate) {
      errors.paidDate = 'Paid date is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddContribution = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      console.log('Submitting contribution data:', {
        ...newContribution,
        chitFundId: Number(chitFundId),
        memberId: Number(newContribution.memberId),
        month: Number(newContribution.month),
        amount: Number(newContribution.amount),
      });

      // Use the apiPost utility function
      const responseData = await apiPost(
        `/api/chit-funds/consolidated?action=add-contribution&id=${chitFundId}`,
        {
          ...newContribution,
          chitFundId: Number(chitFundId),
          memberId: Number(newContribution.memberId),
          month: Number(newContribution.month),
          amount: Number(newContribution.amount),
          balancePaymentDate: newContribution.balancePaymentDate || null,
          balancePaymentStatus: chitFund && Number(newContribution.amount) < chitFund.monthlyContribution ? 'Pending' : null,
          actualBalancePaymentDate: newContribution.actualBalancePaymentDate || null,
          notes: null, // Add notes field with null value
        },
        'Failed to add contribution'
      );

      console.log('API Response:', responseData);

      // Update the contributions list
      setContributions([...contributions, responseData]);

      // Reset form
      setNewContribution({
        memberId: '',
        month: '',
        amount: chitFund?.monthlyContribution?.toString() || '',
        paidDate: new Date().toISOString().split('T')[0],
        balancePaymentDate: '',
        balancePaymentStatus: 'Pending',
        actualBalancePaymentDate: '',
      });
      setShowAddForm(false);

      // Refresh the page to get updated data
      window.location.reload();
    } catch (error: any) {
      console.error('Error adding contribution:', error);
      setFormErrors({
        submit: error.message || 'Failed to add contribution. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
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
  const formatDate = (dateString: string) => {
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return new Date(dateString).toLocaleDateString('en-IN', options);
  };

  // Filter contributions based on selected month and member
  const filteredContributions = contributions.filter(contribution => {
    const monthMatch = selectedMonth === 'all' || contribution.month.toString() === selectedMonth;
    const memberMatch = selectedMember === 'all' || contribution.memberId.toString() === selectedMember;
    return monthMatch && memberMatch;
  });

  // Generate months array for the filter dropdown
  const months = chitFund ? Array.from({ length: chitFund.duration }, (_, i) => i + 1) : [];

  // Generate all members with their contribution status for a specific month
  const getMembersWithStatusForMonth = (month: number) => {
    if (!chitFund || !members || members.length === 0) return [];

    const result = [];

    // For each member, check if they have a contribution for this month
    for (const member of members) {
      const contribution = contributions.find(c => c.memberId === member.id && c.month === month);

      if (contribution) {
        // Member has paid for this month
        result.push({
          member,
          status: 'paid',
          contribution
        });
      } else {
        // Member has not paid for this month
        result.push({
          member,
          status: 'pending',
          contribution: null
        });
      }
    }

    return result;
  };

  // Organize contributions by month
  const getContributionsByMonth = () => {
    if (!chitFund) return [];

    const monthlyContributions = [];

    // Create an array of all months up to the chit fund duration
    for (let month = 1; month <= (chitFund?.duration || 0); month++) {
      const contributionsForMonth = contributions.filter(c => c.month === month);

      // Get all members with their status for this month
      const membersWithStatus = getMembersWithStatusForMonth(month);
      const pendingMembers = membersWithStatus.filter(m => m.status === 'pending');

      // Calculate totals for this month
      const totalExpected = chitFund ? chitFund.monthlyContribution * chitFund.membersCount : 0;
      const totalCollected = contributionsForMonth.reduce((sum, c) => sum + c.amount, 0);
      const totalBalance = contributionsForMonth.reduce((sum, c) => sum + c.balance, 0);
      const contributionCount = contributionsForMonth.length;
      const pendingCount = pendingMembers.length;

      monthlyContributions.push({
        month,
        contributionsForMonth,
        pendingMembers,
        totalExpected,
        totalCollected,
        totalBalance,
        contributionCount,
        pendingCount,
        memberCount: chitFund?.membersCount || 0
      });
    }

    return monthlyContributions;
  };

  // Get contributions organized by month
  const contributionsByMonth = getContributionsByMonth();

  // Handle viewing contribution details
  const handleViewContribution = (contribution: Contribution) => {
    setSelectedContribution(contribution);
    setShowDetailModal(true);
  };

  // Handle edit contribution
  const handleEditContribution = (contribution: Contribution) => {
    setContributionToEdit(contribution);
    setEditFormData({
      amount: contribution.amount.toString(),
      paidDate: new Date(contribution.paidDate).toISOString().split('T')[0],
      balancePaymentDate: contribution.balancePaymentDate
        ? new Date(contribution.balancePaymentDate).toISOString().split('T')[0]
        : '',
      balancePaymentStatus: contribution.balancePaymentStatus || 'Pending',
      actualBalancePaymentDate: contribution.actualBalancePaymentDate
        ? new Date(contribution.actualBalancePaymentDate).toISOString().split('T')[0]
        : '',
    });
    setEditFormErrors({});
    setShowEditForm(true);
  };

  // Handle edit form input change
  const handleEditFormChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditFormData({
      ...editFormData,
      [name]: value,
    });
  };

  // Handle edit form submission
  const handleEditFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!contributionToEdit) return;

    // Validate form
    const errors: {[key: string]: string} = {};

    if (!editFormData.amount) {
      errors.amount = 'Amount is required';
    } else if (isNaN(Number(editFormData.amount)) || Number(editFormData.amount) <= 0) {
      errors.amount = 'Amount must be a positive number';
    }

    if (!editFormData.paidDate) {
      errors.paidDate = 'Paid date is required';
    }

    if (Object.keys(errors).length > 0) {
      setEditFormErrors(errors);
      return;
    }

    // Submit form
    setIsEditing(true);

    try {
      // Use the apiPut utility function
      const updatedContribution = await apiPut(
        `/api/chit-funds/consolidated?action=update-contribution&id=${chitFundId}`,
        {
          contributionId: contributionToEdit.id,
          amount: Number(editFormData.amount),
          paidDate: editFormData.paidDate,
          balancePaymentDate: editFormData.balancePaymentDate || null,
          balancePaymentStatus: editFormData.balancePaymentStatus || null,
          actualBalancePaymentDate: editFormData.actualBalancePaymentDate || null,
          notes: null, // Add notes field with null value
        },
        'Failed to update contribution'
      );

      // Update the contributions list
      setContributions(contributions.map(c =>
        c.id === updatedContribution.id ? updatedContribution : c
      ));

      // Close the form
      setShowEditForm(false);
      setContributionToEdit(null);
    } catch (error: any) {
      console.error('Error updating contribution:', error);
      setEditFormErrors({
        submit: error.message || 'Failed to update contribution. Please try again.',
      });
    } finally {
      setIsEditing(false);
    }
  };

  // Handle delete contribution
  const handleDeleteContribution = (id: number) => {
    setContributionToDelete(id);
    setShowDeleteModal(true);
  };

  // Confirm delete contribution
  const confirmDeleteContribution = async () => {
    if (!contributionToDelete) return;

    try {
      // Use the apiDelete utility function
      await apiDelete(
        `/api/chit-funds/consolidated?action=delete-contribution&id=${chitFundId}`,
        {
          contributionId: contributionToDelete
        },
        'Failed to delete contribution'
      );

      // Remove the deleted contribution from the state
      setContributions(contributions.filter(c => c.id !== contributionToDelete));

      // Close the modal
      setShowDeleteModal(false);
      setContributionToDelete(null);
    } catch (error: any) {
      console.error('Error deleting contribution:', error);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading contributions data...</p>
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

  if (!chitFund) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded">
          <p className="font-bold">Chit Fund Not Found</p>
          <p>The chit fund you are looking for does not exist or has been removed.</p>
          <Link href="/chit-funds" className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300">
            Back to Chit Funds
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-blue-700">{chitFund.name} - Contributions</h1>
          <p className="text-gray-600">
            Month {chitFund.currentMonth} of {chitFund.duration} |
            Monthly Contribution: {formatCurrency(chitFund.monthlyContribution)}
          </p>
        </div>
        <div className="flex space-x-4">
          <Link href={`/chit-funds/${chitFundId}`} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300">
            Back to Chit Fund
          </Link>
          <Link href={`/chit-funds/${chitFundId}/members`} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300">
            View Members
          </Link>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-300"
          >
            Record Contribution
          </button>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex justify-center space-x-4 mb-4">
          <button
            onClick={() => setViewMode('member')}
            className={`px-4 py-2 rounded-lg transition duration-300 ${
              viewMode === 'member'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Member View
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`px-4 py-2 rounded-lg transition duration-300 ${
              viewMode === 'month'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Month View
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="monthFilter" className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Month
            </label>
            <select
              id="monthFilter"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Months</option>
              {months.map((month) => (
                <option key={month} value={month}>
                  Month {month}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label htmlFor="memberFilter" className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Member
            </label>
            <select
              id="memberFilter"
              value={selectedMember}
              onChange={(e) => setSelectedMember(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Members</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.globalMember.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Contributions Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
        <div className="overflow-x-auto">
          {viewMode === 'member' ? (
            // Member View
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Member
                  </th>
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
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {selectedMonth !== 'all' && chitFund && members && members.length > 0 ? (
                  // Show all members with their status for the selected month
                  getMembersWithStatusForMonth(parseInt(selectedMonth)).map((memberData) => (
                    <tr
                      key={memberData.member.id}
                      className={`hover:bg-gray-50 ${memberData.status === 'paid' ? 'cursor-pointer' : ''}`}
                      onClick={() => memberData.status === 'paid' && handleViewContribution(memberData.contribution!)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-blue-600">
                          {memberData.member.globalMember.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">Month {selectedMonth}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {memberData.status === 'paid' ? (
                          <div className="text-sm text-gray-900">{formatCurrency(memberData.contribution!.amount)}</div>
                        ) : (
                          <div className="text-sm text-gray-400">{formatCurrency(chitFund.monthlyContribution)}</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {memberData.status === 'paid' ? (
                          <div className="text-sm text-gray-900">{formatDate(memberData.contribution!.paidDate)}</div>
                        ) : (
                          <div className="text-sm text-red-600 font-semibold">Pending</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {memberData.status === 'paid' ? (
                          memberData.contribution!.balance > 0 || memberData.contribution!.balancePaymentStatus === 'Paid' ? (
                            <div>
                              {memberData.contribution!.balancePaymentStatus === 'Paid' ? (
                                <div className="text-sm text-green-600 font-semibold">Paid in full</div>
                              ) : (
                                <div className="text-sm text-red-600 font-semibold">{formatCurrency(memberData.contribution!.balance)}</div>
                              )}

                              <div className="text-xs mt-1">
                                <span className={`px-2 py-1 rounded-full ${
                                  memberData.contribution!.balancePaymentStatus === 'Paid'
                                    ? 'bg-green-100 text-green-800'
                                    : memberData.contribution!.balancePaymentStatus === 'Overdue'
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                  {memberData.contribution!.balancePaymentStatus || 'Pending'}
                                </span>
                              </div>

                              {memberData.contribution!.balancePaymentDate && (
                                <div className="text-xs text-gray-500 mt-1">
                                  Expected payment: {formatDate(memberData.contribution!.balancePaymentDate)}
                                </div>
                              )}

                              {memberData.contribution!.actualBalancePaymentDate && (
                                <div className="text-xs text-green-600 mt-1">
                                  Paid on: {formatDate(memberData.contribution!.actualBalancePaymentDate)}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="text-sm text-green-600 font-semibold">Paid in full</div>
                          )
                        ) : (
                          <div className="text-sm text-gray-400">-</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end space-x-3">
                          {memberData.status === 'paid' ? (
                            <>
                              <button
                                onClick={() => handleEditContribution(memberData.contribution!)}
                                className="text-blue-600 hover:text-blue-900"
                                title="Edit contribution"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                              </button>
                              <button
                                onClick={() => handleDeleteContribution(memberData.contribution!.id)}
                                className="text-red-600 hover:text-red-900"
                                title="Delete contribution"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => {
                                setNewContribution({
                                  ...newContribution,
                                  memberId: memberData.member.id.toString(),
                                  month: selectedMonth
                                });
                                setShowAddForm(true);
                              }}
                              className="text-green-600 hover:text-green-900"
                              title="Add payment"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                ) : filteredContributions.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                      No contributions found. Record contributions for this chit fund.
                    </td>
                  </tr>
                ) : (
                  filteredContributions.map((contribution) => (
                    <tr
                      key={contribution.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleViewContribution(contribution)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-blue-600">
                          {contribution.member?.globalMember?.name || `Member ID: ${contribution.memberId}`}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">Month {contribution.month}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatCurrency(contribution.amount)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatDate(contribution.paidDate)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {contribution.balance > 0 || contribution.balancePaymentStatus === 'Paid' ? (
                          <div>
                            {contribution.balancePaymentStatus === 'Paid' ? (
                              <div className="text-sm text-green-600 font-semibold">Paid in full</div>
                            ) : (
                              <div className="text-sm text-red-600 font-semibold">{formatCurrency(contribution.balance)}</div>
                            )}

                            <div className="text-xs mt-1">
                              <span className={`px-2 py-1 rounded-full ${
                                contribution.balancePaymentStatus === 'Paid'
                                  ? 'bg-green-100 text-green-800'
                                  : contribution.balancePaymentStatus === 'Overdue'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                              }`}>
                                {contribution.balancePaymentStatus || 'Pending'}
                              </span>
                            </div>

                            {contribution.balancePaymentDate && (
                              <div className="text-xs text-gray-500 mt-1">
                                Expected payment: {formatDate(contribution.balancePaymentDate)}
                              </div>
                            )}

                            {contribution.actualBalancePaymentDate && (
                              <div className="text-xs text-green-600 mt-1">
                                Paid on: {formatDate(contribution.actualBalancePaymentDate)}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="text-sm text-green-600 font-semibold">Paid in full</div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex justify-end space-x-3">
                          <button
                            onClick={() => handleEditContribution(contribution)}
                            className="text-blue-600 hover:text-blue-900"
                            title="Edit contribution"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleDeleteContribution(contribution.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete contribution"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            // Month View
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Month
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contributions
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Expected Amount
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Collected Amount
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Outstanding Balance
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {contributionsByMonth.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                      No contributions found. Record contributions for this chit fund.
                    </td>
                  </tr>
                ) : (
                  contributionsByMonth
                    .filter(monthData => selectedMonth === 'all' || monthData.month.toString() === selectedMonth)
                    .map((monthData) => (
                      <tr key={monthData.month} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-blue-600">Month {monthData.month}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {monthData.contributionCount} of {monthData.memberCount} members
                            {monthData.pendingCount > 0 && (
                              <span className="ml-2 px-2 py-1 bg-red-100 text-red-800 text-xs rounded-full">
                                {monthData.pendingCount} pending
                              </span>
                            )}
                          </div>
                          {monthData.pendingCount > 0 && (
                            <div className="mt-2 text-xs text-gray-500">
                              <details>
                                <summary className="cursor-pointer text-blue-600 hover:text-blue-800">Show pending members</summary>
                                <ul className="mt-1 pl-4 list-disc">
                                  {monthData.pendingMembers.map(memberData => (
                                    <li key={memberData.member.id} className="text-red-600">
                                      {memberData.member.globalMember.name}
                                    </li>
                                  ))}
                                </ul>
                              </details>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{formatCurrency(monthData.totalExpected)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{formatCurrency(monthData.totalCollected)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {monthData.totalBalance > 0 ? (
                            <div className="text-sm text-red-600 font-semibold">{formatCurrency(monthData.totalBalance)}</div>
                          ) : (
                            <div className="text-sm text-green-600 font-semibold">Fully collected</div>
                          )}
                        </td>
                      </tr>
                    ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-red-700 mb-4">Confirm Deletion</h2>
            <p className="mb-6">Are you sure you want to delete this contribution? This action cannot be undone.</p>
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setContributionToDelete(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteContribution}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-300"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Contribution Form */}
      {showEditForm && contributionToEdit && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-blue-700 mb-4">Edit Contribution</h2>
            <form onSubmit={handleEditFormSubmit}>
              <div className="mb-4">
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                  Amount <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center">
                  <input
                    type="number"
                    id="amount"
                    name="amount"
                    value={editFormData.amount}
                    onChange={handleEditFormChange}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      editFormErrors.amount ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setEditFormData({...editFormData, amount: chitFund.monthlyContribution.toString()})}
                    className="ml-2 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300"
                  >
                    Full Amount
                  </button>
                </div>
                {Number(editFormData.amount) < chitFund.monthlyContribution && Number(editFormData.amount) > 0 && (
                  <p className="mt-1 text-sm text-orange-500">
                    This is a partial payment. Balance of {formatCurrency(chitFund.monthlyContribution - Number(editFormData.amount))} will be recorded.
                  </p>
                )}
                {editFormErrors.amount && (
                  <p className="mt-1 text-sm text-red-500">{editFormErrors.amount}</p>
                )}
              </div>
              <div className="mb-4">
                <label htmlFor="paidDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Paid Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="paidDate"
                  name="paidDate"
                  value={editFormData.paidDate}
                  onChange={handleEditFormChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    editFormErrors.paidDate ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {editFormErrors.paidDate && (
                  <p className="mt-1 text-sm text-red-500">{editFormErrors.paidDate}</p>
                )}
              </div>

              {Number(editFormData.amount) < chitFund.monthlyContribution && (
                <>
                  <div className="mb-4">
                    <label htmlFor="balancePaymentStatus" className="block text-sm font-medium text-gray-700 mb-1">
                      Balance Payment Status
                    </label>
                    <select
                      id="balancePaymentStatus"
                      name="balancePaymentStatus"
                      value={editFormData.balancePaymentStatus}
                      onChange={(e) => setEditFormData({...editFormData, balancePaymentStatus: e.target.value})}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Paid">Paid</option>
                      <option value="Overdue">Overdue</option>
                    </select>
                  </div>

                  <div className="mb-4">
                    <label htmlFor="balancePaymentDate" className="block text-sm font-medium text-gray-700 mb-1">
                      Expected Payment Date
                    </label>
                    <input
                      type="date"
                      id="balancePaymentDate"
                      name="balancePaymentDate"
                      value={editFormData.balancePaymentDate}
                      onChange={handleEditFormChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Date when the remaining balance is expected to be paid
                    </p>
                  </div>

                  {editFormData.balancePaymentStatus === 'Paid' && (
                    <div className="mb-4">
                      <label htmlFor="actualBalancePaymentDate" className="block text-sm font-medium text-gray-700 mb-1">
                        Actual Payment Date
                      </label>
                      <input
                        type="date"
                        id="actualBalancePaymentDate"
                        name="actualBalancePaymentDate"
                        value={editFormData.actualBalancePaymentDate}
                        onChange={handleEditFormChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Date when the balance was actually paid
                      </p>
                    </div>
                  )}
                </>
              )}
              {editFormErrors.submit && (
                <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  <p>{editFormErrors.submit}</p>
                </div>
              )}
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setShowEditForm(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEditing}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300 disabled:opacity-50"
                >
                  {isEditing ? 'Updating...' : 'Update Contribution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                  <p className="text-md font-semibold">
                    {selectedContribution.member?.globalMember?.name || `Member ID: ${selectedContribution.memberId}`}
                  </p>
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
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  handleEditContribution(selectedContribution);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300"
              >
                Edit
              </button>
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

      {/* Add Contribution Form */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-blue-700 mb-4">Record New Contribution</h2>
            <form onSubmit={handleAddContribution}>
              <div className="mb-4">
                <label htmlFor="memberId" className="block text-sm font-medium text-gray-700 mb-1">
                  Member <span className="text-red-500">*</span>
                </label>
                <select
                  id="memberId"
                  name="memberId"
                  value={newContribution.memberId}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.memberId ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select a member</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.globalMember.name}
                    </option>
                  ))}
                </select>
                {formErrors.memberId && (
                  <p className="mt-1 text-sm text-red-500">{formErrors.memberId}</p>
                )}
              </div>
              <div className="mb-4">
                <label htmlFor="month" className="block text-sm font-medium text-gray-700 mb-1">
                  Month <span className="text-red-500">*</span>
                </label>
                <select
                  id="month"
                  name="month"
                  value={newContribution.month}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.month ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select a month</option>
                  {months.map((month) => (
                    <option key={month} value={month}>
                      Month {month}
                    </option>
                  ))}
                </select>
                {formErrors.month && (
                  <p className="mt-1 text-sm text-red-500">{formErrors.month}</p>
                )}
              </div>
              <div className="mb-4">
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                  Amount <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center">
                  <input
                    type="number"
                    id="amount"
                    name="amount"
                    value={newContribution.amount}
                    onChange={handleInputChange}
                    placeholder={chitFund.monthlyContribution.toString()}
                    className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                      formErrors.amount ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setNewContribution({...newContribution, amount: chitFund.monthlyContribution.toString()})}
                    className="ml-2 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300"
                  >
                    Full Amount
                  </button>
                </div>
                {Number(newContribution.amount) < chitFund.monthlyContribution && Number(newContribution.amount) > 0 && (
                  <p className="mt-1 text-sm text-orange-500">
                    This is a partial payment. Balance of {formatCurrency(chitFund.monthlyContribution - Number(newContribution.amount))} will be recorded.
                  </p>
                )}
                {formErrors.amount && (
                  <p className="mt-1 text-sm text-red-500">{formErrors.amount}</p>
                )}
              </div>
              <div className="mb-4">
                <label htmlFor="paidDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Paid Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="paidDate"
                  name="paidDate"
                  value={newContribution.paidDate}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.paidDate ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {formErrors.paidDate && (
                  <p className="mt-1 text-sm text-red-500">{formErrors.paidDate}</p>
                )}
              </div>

              {Number(newContribution.amount) > 0 && Number(newContribution.amount) < chitFund.monthlyContribution && (
                <>
                  <div className="mb-4">
                    <label htmlFor="balancePaymentStatus" className="block text-sm font-medium text-gray-700 mb-1">
                      Balance Payment Status
                    </label>
                    <select
                      id="balancePaymentStatus"
                      name="balancePaymentStatus"
                      value={newContribution.balancePaymentStatus}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="Pending">Pending</option>
                      <option value="Paid">Paid</option>
                      <option value="Overdue">Overdue</option>
                    </select>
                  </div>

                  <div className="mb-4">
                    <label htmlFor="balancePaymentDate" className="block text-sm font-medium text-gray-700 mb-1">
                      Expected Payment Date
                    </label>
                    <input
                      type="date"
                      id="balancePaymentDate"
                      name="balancePaymentDate"
                      value={newContribution.balancePaymentDate}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Date when the remaining balance is expected to be paid
                    </p>
                  </div>

                  {newContribution.balancePaymentStatus === 'Paid' && (
                    <div className="mb-4">
                      <label htmlFor="actualBalancePaymentDate" className="block text-sm font-medium text-gray-700 mb-1">
                        Actual Payment Date
                      </label>
                      <input
                        type="date"
                        id="actualBalancePaymentDate"
                        name="actualBalancePaymentDate"
                        value={newContribution.actualBalancePaymentDate}
                        onChange={handleInputChange}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Date when the balance was actually paid
                      </p>
                    </div>
                  )}
                </>
              )}
              {formErrors.submit && (
                <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                  <p>{formErrors.submit}</p>
                </div>
              )}
              <div className="flex justify-end space-x-4">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-300 disabled:opacity-50"
                >
                  {isSubmitting ? 'Recording...' : 'Record Contribution'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
