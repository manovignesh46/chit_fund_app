'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

interface GlobalMember {
  id: number;
  name: string;
  contact: string;
  email: string | null;
  address: string | null;
}

interface Member {
  id: number;
  globalMemberId: number;
  globalMember: GlobalMember;
  joinDate: string;
  auctionWon: boolean;
  auctionMonth: number | null;
  contribution: number;
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

export default function ChitFundMembersPage() {
  const params = useParams();
  const router = useRouter();
  const chitFundId = params.id;

  const [chitFund, setChitFund] = useState<ChitFund | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [allContributions, setAllContributions] = useState<{memberId: number, month: number}[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // For adding new member
  const [showAddForm, setShowAddForm] = useState(false);
  const [newMember, setNewMember] = useState({
    name: '',
    contact: '',
  });
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // For deleting member
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [memberToDelete, setMemberToDelete] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // For adding current month contribution
  const [isAddingContribution, setIsAddingContribution] = useState(false);
  const [contributionMemberId, setContributionMemberId] = useState<number | null>(null);
  const [contributionSuccess, setContributionSuccess] = useState<string | null>(null);
  const [contributionError, setContributionError] = useState<string | null>(null);

  useEffect(() => {
    const fetchChitFundAndMembers = async () => {
      try {
        setLoading(true);

        // Fetch chit fund details
        const chitFundResponse = await fetch(`/api/chit-funds/${chitFundId}`);
        if (!chitFundResponse.ok) {
          throw new Error('Failed to fetch chit fund details');
        }
        const chitFundData = await chitFundResponse.json();
        setChitFund(chitFundData);

        // Fetch members
        const membersResponse = await fetch(`/api/chit-funds/${chitFundId}/members`);
        if (!membersResponse.ok) {
          throw new Error('Failed to fetch members');
        }
        const membersData = await membersResponse.json();
        setMembers(membersData);

        // Fetch all contributions for this chit fund
        const contributionsResponse = await fetch(`/api/chit-funds/${chitFundId}/contributions`);
        if (!contributionsResponse.ok) {
          throw new Error('Failed to fetch contributions');
        }
        const contributionsData = await contributionsResponse.json();

        // Create a simplified array of member IDs and months for easy checking
        const contributionMap = contributionsData.map((contribution: any) => ({
          memberId: contribution.memberId,
          month: contribution.month
        }));
        setAllContributions(contributionMap);

        setError(null);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    if (chitFundId) {
      fetchChitFundAndMembers();
    }
  }, [chitFundId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewMember({
      ...newMember,
      [name]: value,
    });
  };

  const validateForm = () => {
    const errors: {[key: string]: string} = {};

    if (!newMember.name.trim()) {
      errors.name = 'Name is required';
    }

    if (!newMember.contact.trim()) {
      errors.contact = 'Contact information is required';
    } else if (!/^[0-9+\s-]{10,15}$/.test(newMember.contact.trim())) {
      errors.contact = 'Please enter a valid phone number';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(`/api/chit-funds/${chitFundId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newMember,
          chitFundId: Number(chitFundId),
          contribution: chitFund?.monthlyContribution || 0,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add member');
      }

      const newMemberData = await response.json();

      // Update the members list
      setMembers([...members, newMemberData]);

      // Reset form
      setNewMember({
        name: '',
        contact: '',
      });
      setShowAddForm(false);

      // Refresh the page to get updated data
      window.location.reload();
    } catch (error) {
      console.error('Error adding member:', error);
      setFormErrors({ submit: 'Failed to add member. Please try again.' });
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

  // Handle delete member
  const handleDeleteMember = (id: number) => {
    setMemberToDelete(id);
    setShowDeleteModal(true);
    setDeleteError(null);
  };

  // Confirm delete member
  const confirmDeleteMember = async () => {
    if (!memberToDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/chit-funds/${chitFundId}/members`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memberId: memberToDelete
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete member');
      }

      // Remove the deleted member from the state
      setMembers(members.filter(m => m.id !== memberToDelete));

      // Close the modal
      setShowDeleteModal(false);
      setMemberToDelete(null);

      // Show success message
      alert('Member deleted successfully!');
    } catch (error: any) {
      console.error('Error deleting member:', error);
      setDeleteError(error.message || 'Failed to delete member. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Handle adding current month contribution
  const handleAddCurrentMonthContribution = async (memberId: number) => {
    if (!chitFund) return;

    // Clear previous messages
    setContributionSuccess(null);
    setContributionError(null);

    // Set the current member ID and loading state
    setContributionMemberId(memberId);
    setIsAddingContribution(true);

    try {
      // We're already checking in the UI if a contribution exists, but double-check here as well
      if (allContributions.some(c => c.memberId === memberId && c.month === chitFund.currentMonth)) {
        throw new Error(`Contribution for month ${chitFund.currentMonth} already exists for this member`);
      }

      // Create the contribution
      const response = await fetch(`/api/chit-funds/${chitFundId}/contributions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          memberId: memberId,
          month: chitFund.currentMonth,
          amount: chitFund.monthlyContribution, // Default to full amount
          paidDate: new Date().toISOString().split('T')[0], // Today's date
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create contribution');
      }

      // Show success message
      const member = members.find(m => m.id === memberId);
      setContributionSuccess(`Added month ${chitFund.currentMonth} contribution for ${member?.globalMember.name}`);

      // Update the contributions list
      setAllContributions([...allContributions, { memberId, month: chitFund.currentMonth }]);

      // Auto-hide success message after 3 seconds
      setTimeout(() => {
        setContributionSuccess(null);
      }, 3000);

    } catch (error: any) {
      console.error('Error adding contribution:', error);
      setContributionError(error.message || 'Failed to add contribution. Please try again.');

      // Auto-hide error message after 3 seconds
      setTimeout(() => {
        setContributionError(null);
      }, 3000);
    } finally {
      setIsAddingContribution(false);
      setContributionMemberId(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading members data...</p>
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
          <h1 className="text-3xl font-bold text-blue-700">{chitFund.name} - Members</h1>
          <p className="text-gray-600">
            Month {chitFund.currentMonth} of {chitFund.duration} |
            Monthly Contribution: {formatCurrency(chitFund.monthlyContribution)}
          </p>
        </div>
        <div className="flex space-x-4">
          <Link href={`/chit-funds/${chitFundId}`} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300">
            Back to Chit Fund
          </Link>
          <Link href={`/chit-funds/${chitFundId}/contributions`} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-300">
            View Contributions
          </Link>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300"
          >
            Add Member
          </button>
        </div>
      </div>

      {/* Notification Messages */}
      {contributionSuccess && (
        <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative">
          <span className="block sm:inline">{contributionSuccess}</span>
        </div>
      )}

      {contributionError && (
        <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative">
          <span className="block sm:inline">{contributionError}</span>
        </div>
      )}

      {/* Members Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Join Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contribution
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Auction Status
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {members.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    No members found. Add members to this chit fund.
                  </td>
                </tr>
              ) : (
                members.map((member) => (
                  <tr key={member.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-blue-600">{member.globalMember.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{member.globalMember.contact}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatDate(member.joinDate)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{formatCurrency(member.contribution)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {member.auctionWon ? (
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                          Won in Month {member.auctionMonth}
                        </span>
                      ) : (
                        <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                          Not Won Yet
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex space-x-4">
                        <Link href={`/chit-funds/${chitFundId}/members/${member.id}/contributions`} className="text-blue-600 hover:text-blue-900">
                          Contributions
                        </Link>
                        {/* Only show the Add Month Due button if no contribution exists for this month */}
                        {!allContributions.some(c => c.memberId === member.id && c.month === chitFund.currentMonth) && (
                          <button
                            onClick={() => handleAddCurrentMonthContribution(member.id)}
                            className={`${isAddingContribution && contributionMemberId === member.id
                              ? 'text-gray-400 cursor-not-allowed'
                              : 'text-green-600 hover:text-green-900'}`}
                            title="Add current month contribution"
                            disabled={isAddingContribution && contributionMemberId === member.id}
                          >
                            {isAddingContribution && contributionMemberId === member.id
                              ? 'Adding...'
                              : `Add Month ${chitFund.currentMonth} Due`}
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteMember(member.id)}
                          className="text-red-600 hover:text-red-900"
                          title="Delete member"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-red-700 mb-4">Confirm Deletion</h2>
            <p className="mb-2">Are you sure you want to delete this member? This action cannot be undone.</p>
            <div className="mb-6 bg-yellow-50 border border-yellow-400 text-yellow-700 p-3 rounded">
              <p className="font-bold">Warning:</p>
              <ul className="list-disc pl-5 mt-1">
                <li>All contributions made by this member will be deleted</li>
                <li>Any auctions won by this member will be deleted</li>
                <li>This may affect the chit fund's financial records</li>
              </ul>
            </div>
            {deleteError && (
              <div className="mb-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                <p>{deleteError}</p>
              </div>
            )}
            <div className="flex justify-end space-x-4">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setMemberToDelete(null);
                  setDeleteError(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteMember}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-300 disabled:opacity-50"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Member Form */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-blue-700 mb-4">Add Member to Chit Fund</h2>

            <div className="mb-6">
              <Link href={`/chit-funds/${chitFundId}/assign-member`} className="w-full px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition duration-300 flex items-center justify-center">
                <span className="mr-2">📋</span> Select from Global Members
              </Link>

              <div className="text-center my-4 relative">
                <hr className="my-4" />
                <span className="px-3 bg-white text-gray-500 text-sm absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">OR</span>
              </div>

              <p className="text-sm text-gray-600 mb-4">Create a new member and add them to this chit fund:</p>
            </div>

            <form onSubmit={handleAddMember}>
              <div className="mb-4">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={newMember.name}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.name ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {formErrors.name && (
                  <p className="mt-1 text-sm text-red-500">{formErrors.name}</p>
                )}
              </div>
              <div className="mb-4">
                <label htmlFor="contact" className="block text-sm font-medium text-gray-700 mb-1">
                  Contact Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="contact"
                  name="contact"
                  value={newMember.contact}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.contact ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {formErrors.contact && (
                  <p className="mt-1 text-sm text-red-500">{formErrors.contact}</p>
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
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300 disabled:opacity-50"
                >
                  {isSubmitting ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}