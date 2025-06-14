// @ts-nocheck
'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { apiGet, apiPost, apiDelete } from '../../../lib/apiUtils';

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
}

interface Auction {
  id: number;
  month: number;
  amount: number;
  date: string;
  winnerId: number;
  winner: Member;
  lowestBid?: number;
  highestBid?: number;
  numberOfBidders?: number;
  notes?: string;
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

export default function ChitFundAuctionsPage() {
  const params = useParams();
  const router = useRouter();
  const chitFundId = params.id;

  const [chitFund, setChitFund] = useState<ChitFund | null>(null);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // For deleting auction
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [auctionToDelete, setAuctionToDelete] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // For adding new auction
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAuction, setNewAuction] = useState({
    winnerId: '',
    month: '',
    amount: '',
    date: new Date().toISOString().split('T')[0], // Today's date in YYYY-MM-DD format
    lowestBid: '',
    highestBid: '',
    numberOfBidders: '',
    notes: '',
  });
  const [formErrors, setFormErrors] = useState<{[key: string]: string}>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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

        // Fetch members using the consolidated API endpoint
        const membersData = await apiGet(
          `/api/chit-funds/consolidated?action=members&id=${chitFundId}`,
          'Failed to fetch members'
        );

        // Check if the response is paginated or a direct array
        if (membersData && membersData.members && Array.isArray(membersData.members)) {
          // Handle paginated response
          setMembers(membersData.members);
        } else if (Array.isArray(membersData)) {
          // Handle direct array response (for backward compatibility)
          setMembers(membersData);
        } else {
          // Handle unexpected response format
          console.error('Unexpected members data format:', membersData);
          setMembers([]);
        }

        // Fetch auctions using the consolidated API endpoint
        const auctionsData = await apiGet(
          `/api/chit-funds/consolidated?action=auctions&id=${chitFundId}`,
          'Failed to fetch auctions'
        );

        // Check if the response has an auctions property (new format) or is an array (old format)
        if (auctionsData.auctions && Array.isArray(auctionsData.auctions)) {
          setAuctions(auctionsData.auctions);
        } else {
          // Fallback for backward compatibility
          setAuctions(Array.isArray(auctionsData) ? auctionsData : []);
        }

        setError(null);
      } catch (err: any) {
        console.error('Error fetching data:', err);
        setError(err.message || 'Failed to load data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    if (chitFundId) {
      fetchData();
    }
  }, [chitFundId]);

  // Handle ESC key to close modals
  useEffect(() => {
    const handleEscKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showAddForm) {
          setShowAddForm(false);
        } else if (showDeleteModal) {
          setShowDeleteModal(false);
          setAuctionToDelete(null);
        } else if (showDetailModal) {
          setShowDetailModal(false);
        }
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, [showAddForm, showDeleteModal, showDetailModal]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;

    // If month is changed and chit fund type is Fixed, auto-populate the amount
    if (name === 'month' && chitFund?.chitFundType === 'Fixed' && chitFund.fixedAmounts && value) {
      const selectedMonth = parseInt(value);
      const fixedAmount = chitFund.fixedAmounts.find(fa => fa.month === selectedMonth);

      setNewAuction({
        ...newAuction,
        [name]: value,
        amount: fixedAmount ? fixedAmount.amount.toString() : '',
      });
    } else {
      setNewAuction({
        ...newAuction,
        [name]: value,
      });
    }
  };

  const validateForm = () => {
    const errors: {[key: string]: string} = {};

    if (!newAuction.winnerId) {
      errors.winnerId = 'Winner is required';
    }

    if (!newAuction.month) {
      errors.month = 'Month is required';
    } else if (isNaN(Number(newAuction.month)) || Number(newAuction.month) < 1 || Number(newAuction.month) > (chitFund?.duration || 0)) {
      errors.month = `Month must be between 1 and ${chitFund?.duration || 0}`;
    }

    if (!newAuction.amount) {
      errors.amount = 'Amount is required';
    } else if (isNaN(Number(newAuction.amount)) || Number(newAuction.amount) <= 0) {
      errors.amount = 'Amount must be a positive number';
    }

    if (!newAuction.date) {
      errors.date = 'Auction date is required';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleAddAuction = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Use the apiPost function with the consolidated API endpoint
      const newAuctionData = await apiPost(
        `/api/chit-funds/consolidated?action=add-auction&id=${chitFundId}`,
        {
          ...newAuction,
          chitFundId: Number(chitFundId),
          winnerId: Number(newAuction.winnerId),
          month: Number(newAuction.month),
          amount: Number(newAuction.amount),
          lowestBid: newAuction.lowestBid ? Number(newAuction.lowestBid) : undefined,
          highestBid: newAuction.highestBid ? Number(newAuction.highestBid) : undefined,
          numberOfBidders: newAuction.numberOfBidders ? Number(newAuction.numberOfBidders) : undefined,
        },
        'Failed to add auction'
      );

      // Update the auctions list
      setAuctions([...auctions, newAuctionData]);

      // Reset form
      setNewAuction({
        winnerId: '',
        month: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        lowestBid: '',
        highestBid: '',
        numberOfBidders: '',
        notes: '',
      });
      setShowAddForm(false);

      // Refresh the page to get updated data
      window.location.reload();
    } catch (error) {
      console.error('Error adding auction:', error);
      setFormErrors({ submit: 'Failed to add auction. Please try again.' });
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

  // Get eligible members (those who haven't won any auction yet)
  const eligibleMembers = members.filter(member => {
    return !auctions.some(auction => auction.winnerId === member.id);
  });

  // Get all months (allow multiple auctions per month)
  const availableMonths = chitFund ?
    Array.from({ length: chitFund.duration }, (_, i) => i + 1) :
    [];

  // Handle delete auction
  const handleDeleteAuction = (id: number) => {
    setAuctionToDelete(id);
    setShowDeleteModal(true);
    setDeleteError(null);
  };

  // Confirm delete auction
  const confirmDeleteAuction = async () => {
    if (!auctionToDelete) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      // Use the apiDelete function with the consolidated API endpoint
      await apiDelete(
        `/api/chit-funds/consolidated?action=delete-auction&id=${chitFundId}`,
        { auctionId: auctionToDelete },
        'Failed to delete auction'
      );

      // Remove the deleted auction from the state
      setAuctions(auctions.filter(a => a.id !== auctionToDelete));

      // Close the modal
      setShowDeleteModal(false);
      setAuctionToDelete(null);
    } catch (error: any) {
      console.error('Error deleting auction:', error);
      setDeleteError(error.message || 'Failed to delete auction. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading auctions data...</p>
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
          <h1 className="text-3xl font-bold text-blue-700">{chitFund.name} - Auctions</h1>
          <p className="text-gray-600">
            Month {chitFund.currentMonth} of {chitFund.duration} |
            Monthly Contribution: {formatCurrency(chitFund.monthlyContribution)} |
            Type: <span className="font-semibold">{chitFund.chitFundType || 'Auction'}</span>
            {chitFund.chitFundType === 'Fixed' && (
              <span className="text-blue-600 ml-2">(Fixed amounts per month)</span>
            )}
          </p>
        </div>
        <div className="flex space-x-4">
          <Link href={`/chit-funds/${chitFundId}`} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300">
            Back to Chit Fund
          </Link>
          <Link href={`/chit-funds/${chitFundId}/members`} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300">
            View Members
          </Link>
          {chitFund.status === 'Active' && (
            eligibleMembers.length > 0 ? (
              <button
                onClick={() => setShowAddForm(true)}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition duration-300"
              >
                Record Auction
              </button>
            ) : (
              <div className="px-4 py-2 bg-gray-300 text-gray-600 rounded-lg cursor-not-allowed" title="All members have already won auctions">
                Record Auction (No Eligible Members)
              </div>
            )
          )}
        </div>
      </div>

      {/* Auctions Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-8">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Month
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Winner
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Auction Date
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Discount
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Details
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {auctions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-gray-500">
                    No auctions found. Record auctions for this chit fund.
                  </td>
                </tr>
              ) : (
                auctions
                  .sort((a, b) => a.month - b.month || new Date(a.date).getTime() - new Date(b.date).getTime())
                  .map((auction, index) => {
                    // Check if this is a duplicate month
                    const sameMonthAuctions = auctions.filter(a => a.month === auction.month);
                    const isDuplicateMonth = sameMonthAuctions.length > 1;
                    const auctionIndex = sameMonthAuctions.findIndex(a => a.id === auction.id) + 1;

                    return (
                      <tr key={auction.id} className={`hover:bg-gray-50 ${isDuplicateMonth ? 'bg-yellow-50' : ''}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            Month {auction.month}
                            {isDuplicateMonth && (
                              <span className="ml-2 px-2 py-1 text-xs bg-yellow-200 text-yellow-800 rounded-full">
                                #{auctionIndex}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-blue-600">
                            {auction.winner?.globalMember?.name || `Member ID: ${auction.winnerId}`}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{formatCurrency(auction.amount)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">{formatDate(auction.date)}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-green-600">
                            {formatCurrency(chitFund.totalAmount - auction.amount)}
                            ({Math.round((1 - auction.amount / chitFund.totalAmount) * 100)}%)
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => {
                              // Show details in a modal instead of an alert
                              setSelectedAuction(auction);
                              setShowDetailModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-900 underline"
                          >
                            View Details
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleDeleteAuction(auction.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete auction"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Auction Form */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-blue-700 mb-4">Record New Auction</h2>
            <form onSubmit={handleAddAuction}>
              <div className="mb-4">
                <label htmlFor="winnerId" className="block text-sm font-medium text-gray-700 mb-1">
                  Winner <span className="text-red-500">*</span>
                </label>
                <select
                  id="winnerId"
                  name="winnerId"
                  value={newAuction.winnerId}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.winnerId ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">
                    {eligibleMembers.length > 0 ? 'Select a member' : 'No eligible members (all have won)'}
                  </option>
                  {eligibleMembers.map((member) => (
                    <option key={member.id} value={member.id}>
                      {member.globalMember.name}
                    </option>
                  ))}
                </select>
                {formErrors.winnerId && (
                  <p className="mt-1 text-sm text-red-500">{formErrors.winnerId}</p>
                )}
              </div>
              <div className="mb-4">
                <label htmlFor="month" className="block text-sm font-medium text-gray-700 mb-1">
                  Month <span className="text-red-500">*</span>
                </label>
                <select
                  id="month"
                  name="month"
                  value={newAuction.month}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.month ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">Select a month</option>
                  {availableMonths.map((month) => {
                    const existingAuctions = auctions.filter(a => a.month === month);
                    const hasExisting = existingAuctions.length > 0;
                    return (
                      <option key={month} value={month}>
                        Month {month} {hasExisting ? `(${existingAuctions.length} existing)` : ''}
                      </option>
                    );
                  })}
                </select>
                {formErrors.month && (
                  <p className="mt-1 text-sm text-red-500">{formErrors.month}</p>
                )}
              </div>
              <div className="mb-4">
                <label htmlFor="amount" className="block text-sm font-medium text-gray-700 mb-1">
                  Auction Amount <span className="text-red-500">*</span>
                  {chitFund?.chitFundType === 'Fixed' && newAuction.month && (
                    <span className="text-xs text-blue-600 ml-2">(Auto-populated from fixed amount)</span>
                  )}
                </label>
                <input
                  type="number"
                  id="amount"
                  name="amount"
                  value={newAuction.amount}
                  onChange={handleInputChange}
                  placeholder={chitFund.totalAmount.toString()}
                  readOnly={chitFund?.chitFundType === 'Fixed' && newAuction.month && newAuction.amount}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.amount ? 'border-red-500' : 'border-gray-300'
                  } ${chitFund?.chitFundType === 'Fixed' && newAuction.month && newAuction.amount ? 'bg-gray-100 cursor-not-allowed' : ''}`}
                />
                {chitFund?.chitFundType === 'Fixed' && newAuction.month && newAuction.amount && (
                  <p className="mt-1 text-xs text-blue-600">
                    This amount is predefined for Month {newAuction.month} in this Fixed type chit fund.
                  </p>
                )}
                {formErrors.amount && (
                  <p className="mt-1 text-sm text-red-500">{formErrors.amount}</p>
                )}
              </div>
              <div className="mb-4">
                <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
                  Auction Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id="date"
                  name="date"
                  value={newAuction.date}
                  onChange={handleInputChange}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.date ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
                {formErrors.date && (
                  <p className="mt-1 text-sm text-red-500">{formErrors.date}</p>
                )}
              </div>

              {/* Only show Auction Details for Auction type chit funds */}
              {chitFund?.chitFundType === 'Auction' && (
                <>
                  <h3 className="text-lg font-semibold text-gray-700 mb-3 mt-6 border-t pt-4">Auction Details</h3>

                  <div className="mb-4">
                    <label htmlFor="lowestBid" className="block text-sm font-medium text-gray-700 mb-1">
                      Lowest Bid Amount
                    </label>
                    <input
                      type="number"
                      id="lowestBid"
                      name="lowestBid"
                      value={newAuction.lowestBid}
                      onChange={handleInputChange}
                      placeholder="Lowest bid in the auction"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300"
                    />
                  </div>

                  <div className="mb-4">
                    <label htmlFor="highestBid" className="block text-sm font-medium text-gray-700 mb-1">
                      Highest Bid Amount
                    </label>
                    <input
                      type="number"
                      id="highestBid"
                      name="highestBid"
                      value={newAuction.highestBid}
                      onChange={handleInputChange}
                      placeholder="Highest bid in the auction"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300"
                    />
                  </div>

                  <div className="mb-4">
                    <label htmlFor="numberOfBidders" className="block text-sm font-medium text-gray-700 mb-1">
                      Number of Bidders
                    </label>
                    <input
                      type="number"
                      id="numberOfBidders"
                      name="numberOfBidders"
                      value={newAuction.numberOfBidders}
                      onChange={handleInputChange}
                      placeholder="How many members participated in bidding"
                      className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300"
                    />
                  </div>
                </>
              )}

              <div className="mb-4">
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
                  Auction Notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  value={newAuction.notes}
                  onChange={handleInputChange}
                  placeholder="Any additional notes about the auction process"
                  rows={3}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent border-gray-300"
                />
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
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition duration-300 disabled:opacity-50"
                >
                  {isSubmitting ? 'Recording...' : 'Record Auction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-red-700 mb-4">Confirm Deletion</h2>
            <p className="mb-6">Are you sure you want to delete this auction? This action cannot be undone.</p>
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
                  setAuctionToDelete(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteAuction}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-300 disabled:opacity-50"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Auction Details Modal */}
      {showDetailModal && selectedAuction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-blue-700">Auction Details</h2>
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
                  <p className="text-sm text-gray-500">Month</p>
                  <p className="text-md font-semibold">Month {selectedAuction.month}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Winner</p>
                  <p className="text-md font-semibold">{selectedAuction.winner?.globalMember?.name || `Member ID: ${selectedAuction.winnerId}`}</p>
                </div>
              </div>
            </div>

            <div className="mb-4">
              <h3 className="text-lg font-semibold mb-2">Auction Information</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">Amount</p>
                  <p className="text-md font-semibold">{formatCurrency(selectedAuction.amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Date</p>
                  <p className="text-md font-semibold">{formatDate(selectedAuction.date)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Discount</p>
                  <p className="text-md font-semibold text-green-600">
                    {formatCurrency(chitFund.totalAmount - selectedAuction.amount)}
                    ({Math.round((1 - selectedAuction.amount / chitFund.totalAmount) * 100)}%)
                  </p>
                </div>
              </div>
            </div>

            {(selectedAuction.lowestBid || selectedAuction.highestBid || selectedAuction.numberOfBidders || selectedAuction.notes) && (
              <div className="mb-4">
                <h3 className="text-lg font-semibold mb-2">Additional Details</h3>
                <div className="space-y-2">
                  {selectedAuction.numberOfBidders && (
                    <div>
                      <p className="text-sm text-gray-500">Number of Bidders</p>
                      <p className="text-md">{selectedAuction.numberOfBidders}</p>
                    </div>
                  )}
                  {selectedAuction.lowestBid && (
                    <div>
                      <p className="text-sm text-gray-500">Lowest Bid</p>
                      <p className="text-md">{formatCurrency(selectedAuction.lowestBid)}</p>
                    </div>
                  )}
                  {selectedAuction.highestBid && (
                    <div>
                      <p className="text-sm text-gray-500">Highest Bid</p>
                      <p className="text-md">{formatCurrency(selectedAuction.highestBid)}</p>
                    </div>
                  )}
                  {selectedAuction.notes && (
                    <div>
                      <p className="text-sm text-gray-500">Notes</p>
                      <p className="text-md whitespace-pre-line">{selectedAuction.notes}</p>
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
