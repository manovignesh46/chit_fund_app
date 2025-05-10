'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

// Define interfaces for type safety
interface Member {
  id: number;
  name: string;
  contribution: number;
  auctionWon: boolean;
  auctionMonth: number | null;
  contributionsCount: number;
}

interface Auction {
  id: number;
  month: number;
  date: string;
  amount: number;
  winner: {
    id: number;
    name: string;
    contact: string;
  };
}

interface ChitFund {
  id: number;
  name: string;
  totalAmount: number;
  monthlyContribution: number;
  duration: number;
  membersCount: number;
  status: string;
  nextAuctionDate: string | null;
  currentMonth: number;
  members?: Member[];
  auctions?: Auction[];
  nextPayoutReceiver?: string;
  finalPayout?: number;
}

const ChitFundDetails = () => {
  const params = useParams();
  const id = params.id;
  const [chitFund, setChitFund] = useState<ChitFund | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [contributions, setContributions] = useState<any[]>([]);
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [membersWithBalance, setMembersWithBalance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // For deletion
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const fetchChitFundData = async () => {
      try {
        setLoading(true);

        // Fetch chit fund details
        const chitFundResponse = await fetch(`/api/chit-funds/${id}`);
        if (!chitFundResponse.ok) {
          throw new Error('Failed to fetch chit fund details');
        }
        const chitFundData = await chitFundResponse.json();

        // Fetch members
        const membersResponse = await fetch(`/api/chit-funds/${id}/members`);
        if (!membersResponse.ok) {
          throw new Error('Failed to fetch members');
        }
        const membersData = await membersResponse.json();

        // Fetch auctions
        const auctionsResponse = await fetch(`/api/chit-funds/${id}/auctions`);
        if (!auctionsResponse.ok) {
          throw new Error('Failed to fetch auctions');
        }
        const auctionsData = await auctionsResponse.json();

        // Fetch contributions
        const contributionsResponse = await fetch(`/api/chit-funds/${id}/contributions`);
        if (!contributionsResponse.ok) {
          throw new Error('Failed to fetch contributions');
        }
        const contributionsData = await contributionsResponse.json();

        // Set the data
        setChitFund(chitFundData);
        setMembers(membersData);
        setAuctions(auctionsData);
        setContributions(contributionsData);

        // Calculate total balance and members with balance
        let totalBalanceAmount = 0;
        const membersWithBalanceData = [];

        // Create a map to track balances by member
        const memberBalances = new Map();

        // Process all contributions to calculate balances
        for (const contribution of contributionsData) {
          if (contribution.balance > 0) {
            totalBalanceAmount += contribution.balance;

            // Track balance by member
            const memberId = contribution.memberId;
            const memberName = contribution.member.name;
            const currentBalance = memberBalances.get(memberId) || {
              id: memberId,
              name: memberName,
              totalBalance: 0,
              months: []
            };

            currentBalance.totalBalance += contribution.balance;
            currentBalance.months.push({
              month: contribution.month,
              balance: contribution.balance
            });

            memberBalances.set(memberId, currentBalance);
          }
        }

        // Convert map to array for state
        memberBalances.forEach(memberData => {
          membersWithBalanceData.push(memberData);
        });

        setTotalBalance(totalBalanceAmount);
        setMembersWithBalance(membersWithBalanceData);

        // Calculate next payout details if there are auctions
        if (auctionsData.length > 0 && chitFundData.currentMonth < chitFundData.duration) {
          // Find members who haven't won an auction yet
          const eligibleMembers = membersData.filter(member => !member.auctionWon);

          if (eligibleMembers.length > 0) {
            // For simplicity, we'll just pick the first eligible member as the next receiver
            const nextReceiver = eligibleMembers[0];
            chitFundData.nextPayoutReceiver = nextReceiver.name;

            // Calculate final payout based on previous auctions average or total amount
            if (auctionsData.length > 0) {
              const avgAmount = auctionsData.reduce((sum, auction) => sum + auction.amount, 0) / auctionsData.length;
              chitFundData.finalPayout = Math.round(avgAmount);
            } else {
              chitFundData.finalPayout = chitFundData.totalAmount;
            }
          }
        }

        setError(null);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchChitFundData();
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
  const formatDate = (dateString: string | null | undefined): string => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-IN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date);
  };

  // Handle delete chit fund
  const handleDeleteChitFund = () => {
    setShowDeleteModal(true);
    setDeleteError(null);
  };

  // Confirm delete chit fund
  const confirmDeleteChitFund = async () => {
    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/chit-funds/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete chit fund');
      }

      // Redirect to chit funds list page
      window.location.href = '/chit-funds';
    } catch (error: any) {
      console.error('Error deleting chit fund:', error);
      setDeleteError(error.message || 'Failed to delete chit fund. Please try again.');
      setIsDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading chit fund details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <h2 className="text-xl font-bold mb-2">Error</h2>
          <p>{error}</p>
          <Link href="/chit-funds" className="mt-4 inline-block text-blue-600 hover:underline">
            Return to Chit Funds
          </Link>
        </div>
      </div>
    );
  }

  if (!chitFund) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <h2 className="text-xl font-bold mb-2">Chit Fund Not Found</h2>
          <p>The chit fund you are looking for does not exist or has been removed.</p>
          <Link href="/chit-funds" className="mt-4 inline-block text-blue-600 hover:underline">
            Return to Chit Funds
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-blue-700">{chitFund.name}</h1>
        <Link href="/chit-funds" className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300">
          Back to Chit Funds
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex justify-between items-start">
                <h2 className="text-xl font-semibold">Chit Fund Overview</h2>
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                  {chitFund.status}
                </span>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Total Amount</h3>
                  <p className="text-xl font-semibold">{formatCurrency(chitFund.totalAmount)}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Monthly Contribution</h3>
                  <p className="text-xl font-semibold">{formatCurrency(chitFund.monthlyContribution)}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Duration</h3>
                  <p className="text-xl font-semibold">{chitFund.duration} months</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Members</h3>
                  <p className="text-xl font-semibold">{chitFund.membersCount}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Current Month</h3>
                  <p className="text-xl font-semibold">{chitFund.currentMonth} of {chitFund.duration}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Next Auction Date</h3>
                  <p className="text-xl font-semibold">{formatDate(chitFund.nextAuctionDate)}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-hidden mt-6">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">Auction History</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Month
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Winner
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {auctions.map((auction) => (
                    <tr key={auction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{auction.month}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatDate(auction.date)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-blue-600">{auction.winner.name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{formatCurrency(auction.amount)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {chitFund.status === 'Active' && (
              <div className="p-6 border-t">
                <Link href={`/chit-funds/${chitFund.id}/auctions`} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300">
                  Conduct Next Auction
                </Link>
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">Members</h2>
            </div>
            <div className="p-6">
              <ul className="divide-y divide-gray-200">
                {members.length === 0 ? (
                  <li className="py-3 text-center text-gray-500">No members found</li>
                ) : (
                  members.slice(0, 5).map((member) => (
                    <li key={member.id} className="py-3 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium text-gray-900">{member.name}</p>
                        <p className="text-sm text-gray-500">
                          {member.auctionWon ? `Won auction in month ${member.auctionMonth}` : 'No auction won yet'}
                        </p>
                      </div>
                      <div className="text-sm font-semibold">
                        {formatCurrency(member.contribution)}
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div className="p-6 border-t">
              <Link href={`/chit-funds/${chitFund.id}/members`} className="text-blue-600 hover:underline block text-center">
                View All Members
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-md overflow-hidden mt-6">
            <div className="p-6 border-b">
              <h2 className="text-xl font-semibold">Next Payout</h2>
            </div>
            <div className="p-6">
              {chitFund.status === 'Completed' ? (
                <div className="text-center text-gray-500">
                  <p>This chit fund has been completed.</p>
                </div>
              ) : chitFund.currentMonth >= chitFund.duration ? (
                <div className="text-center text-gray-500">
                  <p>All payouts have been distributed.</p>
                </div>
              ) : !chitFund.nextPayoutReceiver ? (
                <div className="text-center text-gray-500">
                  <p>No eligible members for next payout.</p>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Receiver</h3>
                    <p className="text-xl font-semibold">{chitFund.nextPayoutReceiver}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Estimated Amount</h3>
                    <p className="text-xl font-semibold">{chitFund.finalPayout ? formatCurrency(chitFund.finalPayout) : 'To be determined'}</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Outstanding Balances Section */}
          {membersWithBalance.length > 0 && (
            <div className="bg-white rounded-lg shadow-md overflow-hidden mt-6">
              <div className="p-6 border-b">
                <div className="flex justify-between items-center">
                  <h2 className="text-xl font-semibold">Outstanding Balances</h2>
                  <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-semibold">
                    {formatCurrency(totalBalance)}
                  </span>
                </div>
              </div>
              <div className="p-6">
                <ul className="divide-y divide-gray-200">
                  {membersWithBalance.map((member) => (
                    <li key={member.id} className="py-3">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-sm font-medium text-gray-900">{member.name}</p>
                        <div className="text-sm font-semibold text-red-600">
                          {formatCurrency(member.totalBalance)}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {member.months.map((monthData, index) => (
                          <span key={index} className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700">
                            Month {monthData.month}: {formatCurrency(monthData.balance)}
                          </span>
                        ))}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Actions Section */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mt-6">
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Actions</h2>
        </div>
        <div className="p-6 flex flex-wrap gap-4">
          <Link href={`/chit-funds/${chitFund.id}/members`} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300">
            Manage Members
          </Link>
          <Link href={`/chit-funds/${chitFund.id}/contributions`} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-300">
            Manage Contributions
          </Link>
          {chitFund.status === 'Active' && (
            <Link href={`/chit-funds/${chitFund.id}/auctions`} className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition duration-300">
              Conduct Auction
            </Link>
          )}
          <button
            onClick={handleDeleteChitFund}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-300"
          >
            Delete Chit Fund
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-red-700 mb-4">Confirm Deletion</h2>
            <p className="mb-6">Are you sure you want to delete this chit fund? This action cannot be undone.</p>
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
                  setDeleteError(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition duration-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeleteChitFund}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition duration-300"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChitFundDetails;