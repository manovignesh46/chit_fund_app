'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChitFund, ChitFundMember, Auction, Contribution } from '@/lib/interfaces';
import { formatCurrency, formatDate, calculateChitFundProfit, calculateChitFundOutsideAmount } from '@/lib/formatUtils';
import ChitFundCard from '@/components/chit-funds/ChitFundCard';
import ChitFundMembersList from '@/components/chit-funds/ChitFundMembersList';
import ChitFundFinancialSummary from '@/components/chit-funds/ChitFundFinancialSummary';
import dynamic from 'next/dynamic';
import { ChitFundDetailSkeleton } from '../../components/skeletons/DetailSkeletons';
import {
  ExportButton,
  EditButton,
  BackButton,
  DeleteButton,
  ActionButtonGroup
} from '@/app/components/buttons/ActionButtons';

// Define Member type
type Member = ChitFundMember;

// Define interface for member balance data
interface MemberBalanceData {
  id: number;
  name: string;
  totalBalance: number;
  months: Array<{month: number; balance: number}>;
}

const ChitFundDetails = () => {
  const params = useParams();
  const id = params.id;
  const [chitFund, setChitFund] = useState<ChitFund | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [contributions, setContributions] = useState<any[]>([]);
  const [totalBalance, setTotalBalance] = useState<number>(0);
  // Define the type for member balance data
  interface MemberBalanceData {
    id: number;
    name: string;
    totalBalance: number;
    months: Array<{month: number; balance: number}>;
  }

  const [membersWithBalance, setMembersWithBalance] = useState<MemberBalanceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalProfit, setTotalProfit] = useState<number>(0);
  const [cashInflow, setCashInflow] = useState<number>(0);
  const [cashOutflow, setCashOutflow] = useState<number>(0);
  const [outsideAmount, setOutsideAmount] = useState<number>(0);
  const [isExporting, setIsExporting] = useState(false);

  // For deletion
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    const fetchChitFundData = async () => {
      try {
        setLoading(true);

        // Fetch chit fund details using the consolidated API endpoint
        const chitFundResponse = await fetch(`/api/chit-funds/consolidated?action=detail&id=${id}`);
        if (!chitFundResponse.ok) {
          const errorData = await chitFundResponse.json().catch(() => ({}));
          console.error('Chit fund fetch error response:', chitFundResponse.status, errorData);

          // Handle 404 errors specifically
          if (chitFundResponse.status === 404) {
            setChitFund(null);
            setError(`Chit fund with ID ${id} not found. It may have been deleted or you don't have permission to view it.`);
            setLoading(false);
            return; // Exit early
          }

          throw new Error(`Failed to fetch chit fund details: ${chitFundResponse.status} ${errorData.error || ''}`);
        }
        const chitFundData = await chitFundResponse.json();

        // Fetch members using the consolidated API endpoint
        const membersResponse = await fetch(`/api/chit-funds/consolidated?action=members&id=${id}`);
        if (!membersResponse.ok) {
          throw new Error('Failed to fetch members');
        }
        const membersData = await membersResponse.json();

        // Fetch auctions using the consolidated API endpoint
        const auctionsResponse = await fetch(`/api/chit-funds/consolidated?action=auctions&id=${id}`);
        if (!auctionsResponse.ok) {
          throw new Error('Failed to fetch auctions');
        }
        const auctionsData = await auctionsResponse.json();

        // Fetch contributions using the consolidated API endpoint
        const contributionsResponse = await fetch(`/api/chit-funds/consolidated?action=contributions&id=${id}`);
        if (!contributionsResponse.ok) {
          throw new Error('Failed to fetch contributions');
        }
        const contributionsData = await contributionsResponse.json();

        // Set the data
        setChitFund(chitFundData);

        // Handle the new paginated response format for members
        if (membersData.members && Array.isArray(membersData.members)) {
          setMembers(membersData.members);
        } else {
          // Fallback for backward compatibility
          setMembers(Array.isArray(membersData) ? membersData : []);
        }

        // Handle the paginated response format for auctions
        const auctionsArray = auctionsData.auctions && Array.isArray(auctionsData.auctions)
          ? auctionsData.auctions
          : (Array.isArray(auctionsData) ? auctionsData : []);

        setAuctions(auctionsArray);

        // Handle the paginated response format for contributions
        const contributionsArray = contributionsData.contributions && Array.isArray(contributionsData.contributions)
          ? contributionsData.contributions
          : (Array.isArray(contributionsData) ? contributionsData : []);

        // Set the contributions state
        setContributions(contributionsArray);

        // Calculate total balance and members with balance
        let totalBalanceAmount = 0;

        const membersWithBalanceData: MemberBalanceData[] = [];

        // Create a map to track balances by member
        const memberBalances = new Map<number, MemberBalanceData>();

        // Process all contributions to calculate balances
        for (const contribution of contributionsArray) {
          // Only count balances that are not marked as "Paid"
          if (contribution.balance > 0 && contribution.balancePaymentStatus !== 'Paid') {
            totalBalanceAmount += contribution.balance;

            // Track balance by member
            const memberId = contribution.memberId;
            const memberName = contribution.member?.globalMember?.name || 'Unknown';
            const currentBalance = memberBalances.get(memberId) || {
              id: memberId,
              name: memberName,
              totalBalance: 0,
              months: [] as Array<{month: number; balance: number}>
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

        // Calculate financial metrics using centralized utility functions
        let totalInflow = 0;
        let totalOutflow = 0;

        // Calculate cash inflow from contributions
        if (contributionsArray && contributionsArray.length > 0) {
          totalInflow = contributionsArray.reduce((sum: number, contribution: any) => sum + contribution.amount, 0);
        }

        // Calculate cash outflow from auctions
        if (auctionsArray && auctionsArray.length > 0) {
          totalOutflow = auctionsArray.reduce((sum: number, auction: any) => sum + auction.amount, 0);
        }

        // Calculate profit and outside amount using centralized utility functions
        const profitAmount = calculateChitFundProfit(chitFundData, contributionsArray, auctionsArray);
        const outsideAmountValue = calculateChitFundOutsideAmount(chitFundData, contributionsArray, auctionsArray);

        setCashInflow(totalInflow);
        setCashOutflow(totalOutflow);
        setTotalProfit(profitAmount);
        setOutsideAmount(outsideAmountValue);

        // Calculate next payout details if there are auctions
        if (auctionsArray.length > 0 && chitFundData.currentMonth < chitFundData.duration) {
          // Get the members array from the response
          const membersArray = membersData.members && Array.isArray(membersData.members)
            ? membersData.members
            : (Array.isArray(membersData) ? membersData : []);

          // Find members who haven't won an auction yet
          const eligibleMembers = membersArray.filter((member: Member) => !member.auctionWon);

          if (eligibleMembers.length > 0) {
            // For simplicity, we'll just pick the first eligible member as the next receiver
            const nextReceiver = eligibleMembers[0];
            chitFundData.nextPayoutReceiver = nextReceiver.name;

            // Calculate final payout based on previous auctions average or total amount
            if (auctionsArray.length > 0) {
              const avgAmount = auctionsArray.reduce((sum: number, auction: Auction) => sum + auction.amount, 0) / auctionsArray.length;
              chitFundData.finalPayout = Math.round(avgAmount);
            } else {
              chitFundData.finalPayout = chitFundData.totalAmount;
            }
          }
        }

        setError(null);
      } catch (err: any) {
        console.error('Error fetching data:', err);
        // Check if the error is related to authentication
        if (err.message && (
          err.message.includes('401') ||
          err.message.includes('Unauthorized') ||
          err.message.toLowerCase().includes('authentication')
        )) {
          setError('Authentication error. Please log in again to continue.');
          // Redirect to login page after a short delay
          setTimeout(() => {
            window.location.href = `/login?from=/chit-funds/${id}&error=session_expired`;
          }, 3000);
        } else {
          setError(`Failed to load data: ${err.message || 'Unknown error'}. Please try again later.`);
        }
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchChitFundData();
    }
  }, [id]);

  // Using centralized formatting functions from formatUtils.ts

  // Calculate end date based on start date and duration
  const calculateEndDate = (startDate: string | Date, durationMonths: number): string => {
    if (!startDate) return 'N/A';
    const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
    const end = new Date(start);

    // For a 10-month chit fund starting on April 1, 2025, the end date should be February 1, 2026
    // This is because the first month is April, and the 10th month is January (ending February 1)
    end.setMonth(start.getMonth() + durationMonths);

    return formatDate(end.toISOString());
  };

  // Calculate the current month based on start date
  const calculateCurrentMonth = (startDate: string | Date): number => {
    if (!startDate) return 1;

    const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
    const now = new Date();

    // If the start date is in the future, return 1
    if (start > now) {
      return 1;
    }

    // Calculate the difference in months
    const diffYears = now.getFullYear() - start.getFullYear();
    const diffMonths = now.getMonth() - start.getMonth();
    let monthDiff = diffYears * 12 + diffMonths + 1; // +1 because we count the first month

    // Adjust if we haven't reached the same day of the month yet
    if (now.getDate() < start.getDate()) {
      monthDiff--;
    }

    // Ensure the month is within the duration range
    return Math.min(Math.max(1, monthDiff), chitFund?.duration || 1);
  };

  // Handle update current month
  const handleUpdateCurrentMonth = async () => {
    if (!chitFund) return;

    try {
      const calculatedMonth = calculateCurrentMonth(chitFund.startDate);

      // Only update if the calculated month is different from the current month
      if (chitFund.currentMonth !== calculatedMonth) {
        const response = await fetch(`/api/chit-funds/consolidated?action=update&id=${chitFund.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            currentMonth: calculatedMonth
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to update current month');
        }

        // Refresh the page to show updated data
        window.location.reload();
      }
    } catch (error) {
      console.error('Error updating current month:', error);
    }
  };

  // Handle export chit fund
  const handleExportChitFund = async () => {
    if (!chitFund || isExporting) return;

    try {
      setIsExporting(true);

      // Generate filename directly from chit fund data
      const chitFundName = chitFund.name.replace(/[^a-zA-Z0-9]/g, '_');
      const today = new Date();
      const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
      const filename = `${chitFundName}_${dateStr}.xlsx`;

      console.log('Generated filename:', filename);

      // Call the direct export API endpoint
      // This bypasses the consolidated API and goes directly to the export route
      const response = await fetch(`/api/chit-funds/${id}/export`);

      if (!response.ok) {
        throw new Error('Failed to export chit fund details');
      }

      // Get the blob from the response
      const blob = await response.blob();

      // Create a URL for the blob
      const url = window.URL.createObjectURL(blob);

      // Create a temporary link element
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;

      // Append to the document and trigger a click
      document.body.appendChild(a);
      a.click();

      // Clean up
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error exporting chit fund details:', error);
      alert('Failed to export chit fund details. Please try again.');
    } finally {
      setIsExporting(false);
    }
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
      const response = await fetch(`/api/chit-funds/consolidated?action=delete&id=${id}`, {
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
    return <ChitFundDetailSkeleton />;
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
        <ActionButtonGroup>
          <ExportButton
            onClick={handleExportChitFund}
            disabled={isExporting}
            isExporting={isExporting}
          >
            Export as Excel
          </ExportButton>
          <EditButton
            href={`/chit-funds/${chitFund.id}/edit`}
          >
            Edit Chit Fund
          </EditButton>
          <BackButton
            href="/chit-funds"
          >
            Back to Chit Funds
          </BackButton>
        </ActionButtonGroup>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="p-6 border-b">
              <div className="flex justify-between items-start">
                <h2 className="text-xl font-semibold">Chit Fund Overview</h2>
                <div className="flex items-center space-x-3">
                  <div className="text-right flex flex-col items-end">
                    <div className="text-sm text-gray-500">Current Month</div>
                    <div className="flex items-center">
                      <div className="text-xl font-bold text-green-700 mr-2">
                        {calculateCurrentMonth(chitFund.startDate)} <span className="text-sm text-gray-500">/ {chitFund.duration}</span>
                      </div>
                      {chitFund.currentMonth !== calculateCurrentMonth(chitFund.startDate) && (
                        <button
                          onClick={handleUpdateCurrentMonth}
                          className="text-xs px-2 py-1 bg-green-100 text-green-800 rounded hover:bg-green-200 transition-colors"
                          title="Update current month based on start date"
                        >
                          Update
                        </button>
                      )}
                    </div>
                  </div>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm font-semibold">
                    {chitFund.status}
                  </span>
                </div>
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
                  <h3
                    className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center cursor-pointer"
                    onClick={() => {
                      const profitElement = document.getElementById('chitfund-profit');
                      if (profitElement) {
                        profitElement.classList.toggle('hidden');
                      }
                    }}
                  >
                    Total Profit
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </h3>
                  <p id="chitfund-profit" className="text-xl font-semibold text-green-600 hidden">
                    {formatCurrency(totalProfit)}
                  </p>
                </div>
                <div>
                  <h3
                    className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center cursor-pointer"
                    onClick={() => {
                      const inflowElement = document.getElementById('chitfund-inflow');
                      if (inflowElement) {
                        inflowElement.classList.toggle('hidden');
                      }
                    }}
                  >
                    Cash Inflow
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </h3>
                  <p id="chitfund-inflow" className="text-xl font-semibold text-blue-600 hidden">
                    {formatCurrency(cashInflow)}
                  </p>
                </div>
                <div>
                  <h3
                    className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center cursor-pointer"
                    onClick={() => {
                      const outflowElement = document.getElementById('chitfund-outflow');
                      if (outflowElement) {
                        outflowElement.classList.toggle('hidden');
                      }
                    }}
                  >
                    Cash Outflow
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </h3>
                  <p id="chitfund-outflow" className="text-xl font-semibold text-red-600 hidden">
                    {formatCurrency(cashOutflow)}
                  </p>
                </div>
                {outsideAmount > 0 && (
                  <div>
                    <h3
                      className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2 flex items-center cursor-pointer"
                      onClick={() => {
                        const outsideElement = document.getElementById('chitfund-outside');
                        if (outsideElement) {
                          outsideElement.classList.toggle('hidden');
                        }
                      }}
                    >
                      Outside Amount
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </h3>
                    <p id="chitfund-outside" className="text-xl font-semibold text-orange-600 hidden">
                      {formatCurrency(outsideAmount)}
                    </p>
                  </div>
                )}
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Members</h3>
                  <p className="text-xl font-semibold">{chitFund.membersCount}</p>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Next Auction Date</h3>
                  <p className="text-xl font-semibold">{formatDate(chitFund.nextAuctionDate)}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Start Date</h3>
                  <p className="text-xl font-semibold">{formatDate(chitFund.startDate)}</p>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Expected End Date</h3>
                  <p className="text-xl font-semibold">{calculateEndDate(chitFund.startDate, chitFund.duration)}</p>
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
                        <div className="text-sm font-medium text-blue-600">{auction.winner?.globalMember?.name || `Member ID: ${auction.winnerId}`}</div>
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
          {/* Use the ChitFundMembersList component */}
          <ChitFundMembersList
            members={members}
            showAuctionDetails={true}
            maxDisplay={5}
            showAll={false}
            onViewMore={() => window.location.href = `/chit-funds/${chitFund.id}/members`}
          />

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
              ) : !(chitFund as any).nextPayoutReceiver ? (
                <div className="text-center text-gray-500">
                  <p>No eligible members for next payout.</p>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Receiver</h3>
                    <p className="text-xl font-semibold">{(chitFund as any).nextPayoutReceiver}</p>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2">Estimated Amount</h3>
                    <p className="text-xl font-semibold">{(chitFund as any).finalPayout ? formatCurrency((chitFund as any).finalPayout) : 'To be determined'}</p>
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

          <DeleteButton
            onClick={handleDeleteChitFund}
          >
            Delete Chit Fund
          </DeleteButton>
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