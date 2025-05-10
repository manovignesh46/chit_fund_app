'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface Member {
  id: number;
  name: string;
  contact: string;
  contribution: number;
}

interface Contribution {
  id: number;
  amount: number;
  month: number;
  paidDate: string;
  memberId: number;
  member: Member;
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
  });
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // For filtering
  const [selectedMonth, setSelectedMonth] = useState<string>('all');
  const [selectedMember, setSelectedMember] = useState<string>('all');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch chit fund details
        const chitFundResponse = await fetch(`/api/chit-funds/${chitFundId}`);
        if (!chitFundResponse.ok) {
          throw new Error('Failed to fetch chit fund details');
        }
        const chitFundData = await chitFundResponse.json();
        console.log('Chit Fund Data:', chitFundData);
        setChitFund(chitFundData);

        // Fetch members
        const membersResponse = await fetch(`/api/chit-funds/${chitFundId}/members`);
        if (!membersResponse.ok) {
          throw new Error('Failed to fetch members');
        }
        const membersData = await membersResponse.json();
        console.log('Members Data:', membersData);
        setMembers(membersData);

        // Fetch contributions
        const contributionsResponse = await fetch(`/api/chit-funds/${chitFundId}/contributions`);
        if (!contributionsResponse.ok) {
          throw new Error('Failed to fetch contributions');
        }
        const contributionsData = await contributionsResponse.json();
        console.log('Contributions Data:', contributionsData);
        setContributions(contributionsData);

        setError(null);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data. Please try again later.');
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

      const response = await fetch(`/api/chit-funds/${chitFundId}/contributions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newContribution,
          chitFundId: Number(chitFundId),
          memberId: Number(newContribution.memberId),
          month: Number(newContribution.month),
          amount: Number(newContribution.amount),
        }),
      });

      const responseData = await response.json();
      console.log('API Response:', responseData);

      if (!response.ok) {
        throw new Error(responseData.error || 'Failed to add contribution');
      }

      // Update the contributions list
      setContributions([...contributions, responseData]);

      // Reset form
      setNewContribution({
        memberId: '',
        month: '',
        amount: chitFund?.monthlyContribution?.toString() || '',
        paidDate: new Date().toISOString().split('T')[0],
      });
      setShowAddForm(false);

      // Show success message
      alert('Contribution recorded successfully!');

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

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
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
                  {member.name}
                </option>
              ))}
            </select>
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
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredContributions.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center text-gray-500">
                    No contributions found. Record contributions for this chit fund.
                  </td>
                </tr>
              ) : (
                filteredContributions.map((contribution) => (
                  <tr key={contribution.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-blue-600">
                        {contribution.member?.name || `Member ID: ${contribution.memberId}`}
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
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

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
                      {member.name}
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
