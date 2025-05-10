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

        // Fetch auctions
        const auctionsResponse = await fetch(`/api/chit-funds/${chitFundId}/auctions`);
        if (!auctionsResponse.ok) {
          throw new Error('Failed to fetch auctions');
        }
        const auctionsData = await auctionsResponse.json();
        setAuctions(auctionsData);

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setNewAuction({
      ...newAuction,
      [name]: value,
    });
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
      const response = await fetch(`/api/chit-funds/${chitFundId}/auctions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...newAuction,
          chitFundId: Number(chitFundId),
          winnerId: Number(newAuction.winnerId),
          month: Number(newAuction.month),
          amount: Number(newAuction.amount),
          lowestBid: newAuction.lowestBid ? Number(newAuction.lowestBid) : undefined,
          highestBid: newAuction.highestBid ? Number(newAuction.highestBid) : undefined,
          numberOfBidders: newAuction.numberOfBidders ? Number(newAuction.numberOfBidders) : undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to add auction');
      }

      const newAuctionData = await response.json();

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

  // Get eligible members (those who haven't won an auction yet)
  const eligibleMembers = members.filter(member => {
    return !auctions.some(auction => auction.winnerId === member.id);
  });

  // Get available months (those that don't have an auction yet)
  const availableMonths = chitFund ?
    Array.from({ length: chitFund.duration }, (_, i) => i + 1)
      .filter(month => !auctions.some(auction => auction.month === month)) :
    [];

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
          {chitFund.status === 'Active' && availableMonths.length > 0 && eligibleMembers.length > 0 && (
            <button
              onClick={() => setShowAddForm(true)}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition duration-300"
            >
              Record Auction
            </button>
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
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {auctions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center text-gray-500">
                    No auctions found. Record auctions for this chit fund.
                  </td>
                </tr>
              ) : (
                auctions.map((auction) => (
                  <tr key={auction.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">Month {auction.month}</div>
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
                          const details = [];
                          if (auction.numberOfBidders) details.push(`${auction.numberOfBidders} bidders`);
                          if (auction.lowestBid) details.push(`Lowest bid: ${formatCurrency(auction.lowestBid)}`);
                          if (auction.highestBid) details.push(`Highest bid: ${formatCurrency(auction.highestBid)}`);
                          if (auction.notes) details.push(`Notes: ${auction.notes}`);

                          if (details.length > 0) {
                            alert(`Auction Details:\n\n${details.join('\n')}`);
                          } else {
                            alert('No additional details recorded for this auction.');
                          }
                        }}
                        className="text-blue-600 hover:text-blue-900 underline"
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Auction Form */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
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
                  <option value="">Select a winner</option>
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
                  {availableMonths.map((month) => (
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
                  Auction Amount <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  id="amount"
                  name="amount"
                  value={newAuction.amount}
                  onChange={handleInputChange}
                  placeholder={chitFund.totalAmount.toString()}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    formErrors.amount ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
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
    </div>
  );
}
