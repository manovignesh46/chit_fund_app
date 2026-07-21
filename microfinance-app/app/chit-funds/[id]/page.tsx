// @ts-nocheck
'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ChitFund, ChitFundMember, Auction, Contribution } from '../../../lib/interfaces';
import { formatCurrency, formatDate, calculateChitFundProfit, calculateChitFundProfitUpToCurrentMonth, calculateChitFundOutsideAmount } from '../../../lib/formatUtils';
import ChitFundCard from '../../../components/chit-funds/ChitFundCard';
// import ChitFundMembersList from '../../../components/chit-funds/ChitFundMembersList';
import ChitFundMembersList from './../../../components/chit-funds/ChitFundMembersList';
import ChitFundContributionsOverview from '../../../components/chit-funds/ChitFundContributionsOverview';
import ChitFundFinancialSummary from '../../../components/chit-funds/ChitFundFinancialSummary';
import dynamic from 'next/dynamic';
import { ChitFundDetailSkeleton } from '../../components/skeletons/DetailSkeletons';
import {

ExportButton,
  EditButton,
  DeleteButton,
  ActionButtonGroup
} from '../../components/buttons/ActionButtons';
import BackTitle from '../../components/common/BackTitle';
import SwipeableTabs from '../../components/SwipeableTabs';

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
  const [allContributions, setAllContributions] = useState<any[]>([]);
  const [contributionsByMonth, setContributionsByMonth] = useState<any[]>([]);
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

  // Individual loading states for progressive rendering
  const [chitFundLoading, setChitFundLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(true);
  const [auctionsLoading, setAuctionsLoading] = useState(true);
  const [contributionsLoading, setContributionsLoading] = useState(true);
  const [totalProfit, setTotalProfit] = useState<number>(0);
  const [cashInflow, setCashInflow] = useState<number>(0);
  const [cashOutflow, setCashOutflow] = useState<number>(0);
  const [outsideAmount, setOutsideAmount] = useState<number>(0);
  const [isExporting, setIsExporting] = useState(false);

  // Tab state
  const [activeTab, setActiveTab] = useState<"overview" | "contributions" | "auctions">("overview");

  // For deletion
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch chit fund details first
    const fetchChitFundDetails = async () => {
      try {
        setChitFundLoading(true);
        const chitFundResponse = await fetch(`/api/chit-funds/consolidated?action=detail&id=${id}`);
        if (!chitFundResponse.ok) {
          const errorData = await chitFundResponse.json().catch(() => ({}));
          console.error('Chit fund fetch error response:', chitFundResponse.status, errorData);

          // Handle 404 errors specifically
          if (chitFundResponse.status === 404) {
            setChitFund(null);
            setError(`Chit fund with ID ${id} not found. It may have been deleted or you don't have permission to view it.`);
            setChitFundLoading(false);
            setLoading(false);
            return;
          }

          throw new Error(`Failed to fetch chit fund details: ${chitFundResponse.status} ${errorData.error || ''}`);
        }
        const chitFundData = await chitFundResponse.json();
        setChitFund(chitFundData);
        setChitFundLoading(false);
      } catch (error) {
        console.error('Error fetching chit fund details:', error);
        setError(error.message || 'Failed to fetch chit fund details');
        setChitFundLoading(false);
        setLoading(false);
      }
    };

    // Fetch members independently
    const fetchMembers = async () => {
      try {
        setMembersLoading(true);
        const membersResponse = await fetch(`/api/chit-funds/consolidated?action=members&id=${id}&page=1&pageSize=1000`);
        if (!membersResponse.ok) {
          throw new Error('Failed to fetch members');
        }
        const membersData = await membersResponse.json();

        // Handle the new paginated response format for members
        if (membersData.members && Array.isArray(membersData.members)) {
          setMembers(membersData.members);
        } else {
          // Fallback for backward compatibility
          setMembers(Array.isArray(membersData) ? membersData : []);
        }
        setMembersLoading(false);
      } catch (error) {
        console.error('Error fetching members:', error);
        setMembersLoading(false);
      }
    };

    // Fetch auctions independently
    const fetchAuctions = async () => {
      try {
        setAuctionsLoading(true);
        const auctionsResponse = await fetch(`/api/chit-funds/consolidated?action=auctions&id=${id}`);
        if (!auctionsResponse.ok) {
          throw new Error('Failed to fetch auctions');
        }
        const auctionsData = await auctionsResponse.json();

        // Handle the paginated response format for auctions
        const auctionsArray = auctionsData.auctions && Array.isArray(auctionsData.auctions)
          ? auctionsData.auctions
          : (Array.isArray(auctionsData) ? auctionsData : []);

        setAuctions(auctionsArray);
        setAuctionsLoading(false);
      } catch (error) {
        console.error('Error fetching auctions:', error);
        setAuctionsLoading(false);
      }
    };

    // Fetch contributions independently
    const fetchContributions = async () => {
      try {
        setContributionsLoading(true);
        const contributionsResponse = await fetch(`/api/chit-funds/consolidated?action=contributions&id=${id}&page=1&pageSize=1000`);
        if (!contributionsResponse.ok) {
          throw new Error('Failed to fetch contributions');
        }
        const contributionsData = await contributionsResponse.json();

        // Handle the paginated response format for contributions
        const contributionsArray = contributionsData.contributions && Array.isArray(contributionsData.contributions)
          ? contributionsData.contributions
          : (Array.isArray(contributionsData) ? contributionsData : []);

        // Set the contributions state
        setContributions(contributionsArray);

        // Set all contributions for month-wise analysis
        const allContributionsArray = contributionsData.allContributions && Array.isArray(contributionsData.allContributions)
          ? contributionsData.allContributions
          : contributionsArray;
        setAllContributions(allContributionsArray);

        setContributionsLoading(false);
      } catch (error) {
        console.error('Error fetching contributions:', error);
        setContributionsLoading(false);
      }
    };

    // Fetch core data needed for summary bar + overview tab
    if (id) {
      fetchChitFundDetails();
      fetchMembers();
      fetchAuctions();
      // fetchContributions is deferred — see lazy useEffect below
    }
  }, [id]);

  // Lazy-load contributions only when the contributions tab is first opened
  const contributionsInitialized = useRef(false);
  useEffect(() => {
    if (activeTab === 'contributions' && !contributionsInitialized.current && id) {
      contributionsInitialized.current = true;
      const fetchContributions = async () => {
        try {
          setContributionsLoading(true);
          const contributionsResponse = await fetch(`/api/chit-funds/consolidated?action=contributions&id=${id}&page=1&pageSize=1000`);
          if (!contributionsResponse.ok) throw new Error('Failed to fetch contributions');
          const contributionsData = await contributionsResponse.json();
          const contributionsArray = contributionsData.contributions && Array.isArray(contributionsData.contributions)
            ? contributionsData.contributions
            : (Array.isArray(contributionsData) ? contributionsData : []);
          setContributions(contributionsArray);
          const allContributionsArray = contributionsData.allContributions && Array.isArray(contributionsData.allContributions)
            ? contributionsData.allContributions
            : contributionsArray;
          setAllContributions(allContributionsArray);
        } catch (error) {
          console.error('Error fetching contributions:', error);
        } finally {
          setContributionsLoading(false);
        }
      };
      fetchContributions();
    }
  }, [activeTab, id]);

  // Calculate contributions by month when data is available
  useEffect(() => {
    if (!chitFund || !members.length || !allContributions.length) return;

    const calculateContributionsByMonth = () => {
      const monthlyContributions = [];
      
      // Parse start date and calculate which months should be visible
      const startDate = new Date(chitFund.startDate);
      const today = new Date();
      
      // Calculate the maximum month to display based on calendar dates
      // A month becomes visible starting from its 1st day
      let maxVisibleMonth = 0;
      for (let month = 1; month <= (chitFund?.duration || 0); month++) {
        // Calculate the calendar date for this chit month
        const monthStartDate = new Date(startDate);
        monthStartDate.setMonth(monthStartDate.getMonth() + (month - 1));
        monthStartDate.setDate(1); // Set to 1st of the month
        
        // If the 1st of this month has arrived, it's visible
        if (monthStartDate <= today) {
          maxVisibleMonth = month;
        } else {
          break; // Stop when we reach a future month
        }
      }

      // Create an array of months up to the current visible month only
      for (let month = 1; month <= maxVisibleMonth; month++) {
        const contributionsForMonth = allContributions.filter(
          (c) => c.month === month
        );

        // Get all members with their status for this month
        const membersWithStatus = [];
        for (const member of members) {
          const contribution = allContributions.find(
            (c) => c.memberId === member.id && c.month === month
          );

          if (contribution) {
            membersWithStatus.push({
              member,
              status: "paid",
              contribution,
            });
          } else {
            membersWithStatus.push({
              member,
              status: "pending",
              contribution: null,
            });
          }
        }

        const pendingMembers = membersWithStatus.filter(
          (m) => m.status === "pending"
        );
        const pendingCount = pendingMembers.length;
        const contributionCount = contributionsForMonth.length;

        // Calculate totals for this month
        const actualMembersCount = members.length;
        const totalExpected = chitFund.monthlyContribution * actualMembersCount;
        const totalCollected = contributionsForMonth.reduce(
          (sum, c) => sum + c.amount,
          0
        );

        // Calculate total balance
        const balanceFromPartialPayments = contributionsForMonth.reduce(
          (sum, c) => sum + (c.balance || 0),
          0
        );
        const pendingMembersExpectedAmount = pendingCount * chitFund.monthlyContribution;
        const totalBalance = balanceFromPartialPayments + pendingMembersExpectedAmount;

        monthlyContributions.push({
          month,
          contributionCount,
          memberCount: actualMembersCount,
          pendingCount,
          totalExpected,
          totalCollected,
          totalBalance,
          pendingMembers,
        });
      }

      return monthlyContributions;
    };

    const monthlyData = calculateContributionsByMonth();
    setContributionsByMonth(monthlyData);
  }, [chitFund, members, allContributions]);

  // Calculate financial metrics when contributions and auctions are available
  useEffect(() => {
    if (!chitFund || !contributions.length) return;

    // Calculate total balance and members with balance
    let totalBalanceAmount = 0;
    const membersWithBalanceData: MemberBalanceData[] = [];
    const memberBalances = new Map<number, MemberBalanceData>();

    // Process all contributions to calculate balances
    for (const contribution of contributions) {
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

    // Calculate financial metrics
    let totalInflow = 0;
    let totalOutflow = 0;

    // Calculate cash inflow from contributions
    if (contributions && contributions.length > 0) {
      totalInflow = contributions.reduce((sum: number, contribution: any) => sum + contribution.amount, 0);
    }

    // Calculate cash outflow from auctions
    if (auctions && auctions.length > 0) {
      totalOutflow = auctions.reduce((sum: number, auction: any) => sum + auction.amount, 0);
    }

    // Use derived fields from API response if available, otherwise calculate locally
    if (chitFund.derivedFields) {
      setCashInflow(chitFund.derivedFields.cashInflow);
      setCashOutflow(chitFund.derivedFields.cashOutflow);
      setTotalProfit(chitFund.derivedFields.totalProfit);
      setOutsideAmount(chitFund.derivedFields.outsideAmount);
    } else {
      // Fallback to local calculation for backward compatibility
      const profitAmount = calculateChitFundProfitUpToCurrentMonth(chitFund, contributions, auctions);
      const outsideAmountValue = calculateChitFundOutsideAmount(chitFund, contributions, auctions);

      setCashInflow(totalInflow);
      setCashOutflow(totalOutflow);
      setTotalProfit(profitAmount);
      setOutsideAmount(outsideAmountValue);
    }

    // Update loading state when all calculations are done
    setLoading(false);
  }, [chitFund, contributions, auctions]);

  // Using centralized formatting functions from formatUtils.ts

  // Calculate end date based on start date and duration
  const calculateEndDate = (startDate: string | Date, durationMonths: number): string => {
    if (!startDate) return 'N/A';
    const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
    const end = new Date(start);

    // For a 10-month chit fund starting on April 1, 2025, month 1 is April and month 10
    // (the last one) is January 2026, so the end date should be January 1, 2026.
    end.setMonth(start.getMonth() + durationMonths - 1);

    return formatDate(end.toISOString());
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

  // Show skeleton only if chit fund details are still loading
  if (chitFundLoading) {
    return <ChitFundDetailSkeleton />;
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="alert-error px-4 py-3 rounded">
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
        <div className="alert-error px-4 py-3 rounded">
          <h2 className="text-xl font-bold mb-2">Chit Fund Not Found</h2>
          <p>The chit fund you are looking for does not exist or has been removed.</p>
          <Link href="/chit-funds" className="mt-4 inline-block text-blue-600 hover:underline">
            Return to Chit Funds
          </Link>
        </div>
      </div>
    );
  }

  // Members who haven't won an auction yet - a fund can still have payouts left
  // even after its status flips to 'Completed' when multiple auctions share the final month
  const hasEligibleMembers = members.some(member => !auctions.some(auction => auction.winnerId === member.id));

  return (
    <div className="page-container">
      {/* Page header: title + action buttons */}
      <div className="flex flex-row flex-wrap items-center justify-between gap-2 mb-4 sm:mb-6">
        <BackTitle title="Chit Fund Overview" href="/chit-funds" ariaLabel="Back to Chit Funds" />
        <div className="flex flex-row flex-wrap gap-1 sm:gap-2 w-auto items-center">
          <button
            onClick={() => setShowDeleteModal(true)}
            aria-label="Delete Chit Fund"
            className="p-2 rounded-lg text-sm sm:text-base transition duration-300 flex items-center justify-center bg-red-600 text-white hover:bg-red-700 sm:px-4 sm:py-2"
          >
            <svg className="h-5 w-5 block sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path fill="currentColor" d="M6 7h12M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m2 0v13a2 2 0 01-2 2H8a2 2 0 01-2-2V7h12z" />
            </svg>
            <span className="hidden sm:inline-flex items-center">
              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path fill="currentColor" d="M6 7h12M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3m2 0v13a2 2 0 01-2 2H8a2 2 0 01-2-2V7h12z" />
              </svg>
              Delete
            </span>
          </button>
          <Link href={`/chit-funds/${chitFund?.id || ''}/edit`} aria-label="Edit Chit Fund"
            className="p-2 rounded-lg text-sm sm:text-base transition duration-300 flex items-center justify-center bg-yellow-500 text-white hover:bg-yellow-600 sm:px-4 sm:py-2"
          >
            <svg className="h-5 w-5 block sm:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path fill="currentColor" d="M16.862 3.487a2.25 2.25 0 113.182 3.182l-9.193 9.193a2.25 2.25 0 01-.708.471l-3.25 1.3a.75.75 0 01-.97-.97l1.3-3.25a2.25 2.25 0 01.471-.708l9.193-9.193zM19.5 6.75L17.25 4.5" />
            </svg>
            <span className="hidden sm:inline-flex items-center">
              <svg className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path fill="currentColor" d="M16.862 3.487a2.25 2.25 0 113.182 3.182l-9.193 9.193a2.25 2.25 0 01-.708.471l-3.25 1.3a.75.75 0 01-.97-.97l1.3-3.25a2.25 2.25 0 01.471-.708l9.193-9.193zM19.5 6.75L17.25 4.5" />
              </svg>
              Edit
            </span>
          </Link>
        </div>
      </div>

      {/* Chit fund summary — always visible */}
      <div className="themed-card p-4 sm:p-5 mb-4 sm:mb-6">
        {/* Row 1: name + month + status */}
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl sm:text-2xl font-semibold truncate flex-1 min-w-0">{chitFund.name}</h2>
          <div className="flex items-center gap-2 flex-shrink-0">
            <div className="text-right">
              <div className="text-xs text-gray-500 uppercase tracking-wider">Current Month</div>
              <div className="flex items-center gap-1.5 mt-0.5 justify-end">
                <span className="text-lg font-bold text-green-700">
                  {chitFund.currentMonth}{' '}
                  <span className="text-sm text-gray-500 font-normal">/ {chitFund.duration}</span>
                </span>
              </div>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap ${
              chitFund.status === 'Active' ? 'bg-blue-100 text-blue-800' :
              chitFund.status === 'Completed' ? 'bg-gray-100 text-gray-700' :
              'bg-yellow-100 text-yellow-800'
            }`}>
              {chitFund.status}
            </span>
          </div>
        </div>
        {/* Row 2: action pills — full width, always horizontal */}
        <div className="flex flex-row flex-wrap gap-2 mt-3">
          <Link href={`/chit-funds/${chitFund.id}/members`}
            className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 transition-colors whitespace-nowrap">
            Manage Members
          </Link>
          <Link href={`/chit-funds/${chitFund.id}/contributions`}
            className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300 transition-colors whitespace-nowrap">
            Manage Contributions
          </Link>
          {(chitFund.status === 'Active' || hasEligibleMembers) && (
            <Link href={`/chit-funds/${chitFund.id}/auctions`}
              className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-900/30 dark:text-purple-300 transition-colors whitespace-nowrap">
              Conduct Auction
            </Link>
          )}
        </div>
      </div>

      <div>
      {/* Tab navigation */}
      <div className="border-b border-gray-200 dark:border-surface-border mb-4 sm:mb-6">
        <nav className="flex gap-0 -mb-px overflow-x-auto" aria-label="Chit fund tabs">
          {(["overview", "contributions", "auctions"] as const).map((tab) => {
            const labels = {
              "overview": "Overview",
              "contributions": "Contributions",
              "auctions": "Auctions",
            };
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-shrink-0 px-4 sm:px-6 py-3 text-sm font-medium border-b-2 transition-colors duration-150 whitespace-nowrap focus:outline-none ${
                  isActive
                    ? "border-green-600 text-green-700 dark:text-green-400 dark:border-green-400"
                    : "border-transparent text-gray-500 dark:text-theme-muted hover:text-gray-700 dark:hover:text-theme-secondary hover:border-gray-300"
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab panels (swipeable on mobile) */}
      <SwipeableTabs
        tabs={["overview", "contributions", "auctions"] as const}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      >
        {/* Overview panel */}
        <div className="space-y-4 sm:space-y-6">
          {/* Main details */}
          <div className="themed-card overflow-hidden">
            <div className="p-4 sm:p-6">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-5 sm:gap-6">
                <div>
                  <h3 className="detail-label">Total Amount</h3>
                  <p className="text-lg sm:text-xl font-semibold dark:text-theme-secondary">{formatCurrency(chitFund.totalAmount)}</p>
                </div>
                <div>
                  <h3 className="detail-label">
                    {chitFund.chitFundType === 'Fixed' ? 'Monthly Contribution (2nd+)' : 'Monthly Contribution'}
                  </h3>
                  <p className="text-lg sm:text-xl font-semibold dark:text-theme-secondary">{formatCurrency(chitFund.monthlyContribution)}</p>
                </div>
                {chitFund.chitFundType === 'Fixed' && chitFund.firstMonthContribution && (
                  <div>
                    <h3 className="detail-label">1st Month Contribution</h3>
                    <p className="text-lg sm:text-xl font-semibold dark:text-theme-secondary">{formatCurrency(chitFund.firstMonthContribution)}</p>
                  </div>
                )}
                <div>
                  <h3 className="detail-label">Duration</h3>
                  <p className="text-lg sm:text-xl font-semibold dark:text-theme-secondary">{chitFund.duration} months</p>
                </div>
                <div>
                  <h3
                    className="detail-label flex items-center cursor-pointer"
                    onClick={() => document.getElementById('chitfund-profit')?.classList.toggle('hidden')}
                  >
                    Total Profit
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </h3>
                  <p id="chitfund-profit" className="text-lg sm:text-xl font-semibold text-green-600 hidden">{formatCurrency(totalProfit)}</p>
                </div>
                <div>
                  <h3
                    className="detail-label flex items-center cursor-pointer"
                    onClick={() => document.getElementById('chitfund-inflow')?.classList.toggle('hidden')}
                  >
                    Cash Inflow
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </h3>
                  <p id="chitfund-inflow" className="text-lg sm:text-xl font-semibold text-blue-600 hidden">{formatCurrency(cashInflow)}</p>
                </div>
                <div>
                  <h3
                    className="detail-label flex items-center cursor-pointer"
                    onClick={() => document.getElementById('chitfund-outflow')?.classList.toggle('hidden')}
                  >
                    Cash Outflow
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </h3>
                  <p id="chitfund-outflow" className="text-lg sm:text-xl font-semibold text-red-600 hidden">{formatCurrency(cashOutflow)}</p>
                </div>
                {outsideAmount > 0 && (
                  <div>
                    <h3
                      className="detail-label flex items-center cursor-pointer"
                      onClick={() => document.getElementById('chitfund-outside')?.classList.toggle('hidden')}
                    >
                      Outside Amount
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </h3>
                    <p id="chitfund-outside" className="text-lg sm:text-xl font-semibold text-orange-600 hidden">{formatCurrency(outsideAmount)}</p>
                  </div>
                )}
                <div>
                  <h3 className="detail-label">Members (Auctioned/Total)</h3>
                  <p className="text-lg sm:text-xl font-semibold dark:text-theme-secondary">
                    {auctionsLoading ? '…' : auctions.length} / {chitFund.membersCount}
                  </p>
                </div>
                <div>
                  <h3 className="detail-label">Next Auction Date</h3>
                  <p className="text-lg sm:text-xl font-semibold dark:text-theme-secondary">{formatDate(chitFund.nextAuctionDate)}</p>
                </div>
                <div>
                  <h3 className="detail-label">Start Date</h3>
                  <p className="text-lg sm:text-xl font-semibold dark:text-theme-secondary">{formatDate(chitFund.startDate)}</p>
                </div>
                <div>
                  <h3 className="detail-label">Expected End Date</h3>
                  <p className="text-lg sm:text-xl font-semibold dark:text-theme-secondary">{calculateEndDate(chitFund.startDate, chitFund.duration)}</p>
                </div>
                <div>
                  <h3 className="detail-label">Chit Fund Type</h3>
                  <p className="text-lg sm:text-xl font-semibold dark:text-theme-secondary">{chitFund.chitFundType || 'Auction'}</p>
                </div>
                <div>
                  <h3 className="detail-label">Template</h3>
                  <p className="text-lg sm:text-xl font-semibold dark:text-theme-secondary">
                    {chitFund.template ? (
                      <Link href={`/chit-fund-templates/${chitFund.template.id}`} className="text-blue-600 hover:underline">
                        {chitFund.template.name}
                      </Link>
                    ) : (
                      'Custom (Legacy)'
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Fixed Amounts - only for Fixed type */}
          {chitFund.chitFundType === 'Fixed' && chitFund.fixedAmounts && chitFund.fixedAmounts.length > 0 && (
            <div className="themed-card overflow-hidden">
              <div className="p-4 sm:p-6 border-b">
                <h2 className="text-lg sm:text-xl font-semibold dark:text-theme-secondary">Fixed Amounts by Month</h2>
                <p className="text-sm text-gray-500 mt-1">Predefined auction amounts for each month</p>
              </div>
              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3 sm:gap-4">
                  {chitFund.fixedAmounts.sort((a, b) => a.month - b.month).map((fixedAmount) => (
                    <div key={fixedAmount.month} className="bg-gray-50 dark:bg-surface-elevated rounded-lg p-3 sm:p-4 border text-center">
                      <h3 className="text-xs font-medium text-gray-500 mb-1">Month {fixedAmount.month}</h3>
                      <p className="text-base sm:text-lg font-semibold text-blue-600">{formatCurrency(fixedAmount.amount)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Next Payout */}
          {auctionsLoading || membersLoading ? (
            <div className="themed-card overflow-hidden">
              <div className="p-4 sm:p-6 border-b"><h2 className="text-lg sm:text-xl font-semibold dark:text-theme-secondary">Next Payout</h2></div>
              <div className="p-4 sm:p-6 animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-6 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-1/4"></div>
                <div className="h-6 bg-gray-200 rounded w-1/3"></div>
              </div>
            </div>
          ) : (
            <div className="themed-card overflow-hidden">
              <div className="p-4 sm:p-6 border-b"><h2 className="text-lg sm:text-xl font-semibold dark:text-theme-secondary">Next Payout</h2></div>
              <div className="p-4 sm:p-6">
                {chitFund.status === 'Completed' && !hasEligibleMembers ? (
                  <p className="text-center text-gray-500">This chit fund has been completed.</p>
                ) : chitFund.currentMonth >= chitFund.duration && !hasEligibleMembers ? (
                  <p className="text-center text-gray-500">All payouts have been distributed.</p>
                ) : !(chitFund as any).nextPayoutReceiver ? (
                  <p className="text-center text-gray-500">No eligible members for next payout.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-5">
                    <div>
                      <h3 className="detail-label">Receiver</h3>
                      <p className="text-lg sm:text-xl font-semibold dark:text-theme-secondary">{(chitFund as any).nextPayoutReceiver}</p>
                    </div>
                    <div>
                      <h3 className="detail-label">Estimated Amount</h3>
                      <p className="text-lg sm:text-xl font-semibold dark:text-theme-secondary">
                        {(chitFund as any).finalPayout ? formatCurrency((chitFund as any).finalPayout) : 'To be determined'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Contributions panel */}
        <div className="space-y-4 sm:space-y-6">
          {contributionsLoading ? (
            <div className="themed-card overflow-hidden">
              <div className="p-4 sm:p-6 border-b"><h2 className="text-lg sm:text-xl font-semibold dark:text-theme-secondary">Contributions Overview</h2></div>
              <div className="p-4 sm:p-6 animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          ) : (
            <ChitFundContributionsOverview
              chitFundId={chitFund.id}
              contributionsByMonth={contributionsByMonth}
              showAll={true}
              onViewMore={() => window.location.href = `/chit-funds/${chitFund.id}/contributions`}
            />
          )}

          {/* Outstanding Balances */}
          {contributionsLoading ? (
            <div className="themed-card overflow-hidden">
              <div className="p-4 sm:p-6 border-b flex justify-between items-center">
                <h2 className="text-lg sm:text-xl font-semibold dark:text-theme-secondary">Outstanding Balances</h2>
                <div className="animate-pulse h-6 bg-gray-200 rounded-full w-20"></div>
              </div>
              <div className="p-4 sm:p-6 animate-pulse space-y-3">
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          ) : membersWithBalance.length > 0 ? (
            <div className="themed-card overflow-hidden">
              <div className="p-4 sm:p-6 border-b flex justify-between items-center">
                <h2 className="text-lg sm:text-xl font-semibold dark:text-theme-secondary">Outstanding Balances</h2>
                <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-semibold">{formatCurrency(totalBalance)}</span>
              </div>
              <div className="p-4 sm:p-6">
                <ul className="divide-y divide-surface-border">
                  {membersWithBalance.map((member) => (
                    <li key={member.id} className="py-3">
                      <div className="flex justify-between items-center mb-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-theme-primary">{member.name}</p>
                        <span className="text-sm font-semibold text-red-600">{formatCurrency(member.totalBalance)}</span>
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
          ) : (
            <div className="themed-card p-4 sm:p-6 text-center text-gray-500">
              <p>No outstanding balances.</p>
            </div>
          )}
        </div>

        {/* Auctions panel */}
        <div className="themed-card overflow-hidden">
          <div className="p-4 sm:p-6 border-b flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg sm:text-xl font-semibold dark:text-theme-secondary">Auction History</h2>
            {(chitFund.status === 'Active' || hasEligibleMembers) && (
              <Link href={`/chit-funds/${chitFund.id}/auctions`} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300 text-sm">
                Conduct Next Auction
              </Link>
            )}
          </div>
          {auctionsLoading ? (
            <div className="p-4 sm:p-6 animate-pulse space-y-3">
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/2"></div>
            </div>
          ) : auctions.length === 0 ? (
            <div className="p-4 sm:p-6 text-center text-gray-500">No auctions conducted yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-[500px] w-full divide-y divide-surface-border text-xs sm:text-sm">
                <thead className="bg-gray-50 dark:bg-surface-elevated">
                  <tr>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-theme-muted uppercase tracking-wider">Month</th>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-theme-muted uppercase tracking-wider">Date</th>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-theme-muted uppercase tracking-wider">Winner</th>
                    <th scope="col" className="px-4 sm:px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-theme-muted uppercase tracking-wider">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {auctions.map((auction) => (
                    <tr key={auction.id} className="hover:bg-gray-50 dark:hover:bg-surface-hover">
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-theme-primary">{auction.month}</td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-theme-primary">{formatDate(auction.date)}</td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">{auction.winner?.globalMember?.name || `Member ID: ${auction.winnerId}`}</td>
                      <td className="px-4 sm:px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-theme-primary">{formatCurrency(auction.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </SwipeableTabs>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="modal-overlay flex items-center justify-center z-50 px-2">
          <div className="themed-card w-full max-w-xs sm:max-w-md px-2 sm:px-6 py-4 sm:py-6">
            <h2 className="text-xl font-bold text-red-700 mb-4">Confirm Deletion</h2>
            <p className="mb-6">Are you sure you want to delete this chit fund? This action cannot be undone.</p>
            {deleteError && (
              <div className="mb-4 alert-error px-4 py-3 rounded">
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
                className="btn-neutral px-4 py-2 rounded-lg transition duration-300"
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