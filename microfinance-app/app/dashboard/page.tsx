// @ts-nocheck
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { dashboardAPI } from "../../lib/api";
import { DashboardSkeleton } from "../components/skeletons/DashboardSkeletons";
import CurrentMonthCollections from "../components/CurrentMonthCollections";
import {
  UserGroupIcon,
  PlusCircleIcon,
  CurrencyRupeeIcon,
} from "@heroicons/react/24/outline";

export default function DashboardPage() {
  interface Activity {
    id: string | number;
    type: string;
    action: string;
    details: string;
    date: string;
    amount?: number;
    entityId?: number;
    entityType?: string;
  }

  interface Event {
    id: string | number;
    title: string;
    date: string;
    type: string;
    isDueTomorrow?: boolean;
    totalCount?: number;
    entityId?: number;
    entityType?: string;
    period?: number;
    dueAmount?: number;
    status?: "Paid" | "Overdue";
    paymentType?: string;
  }

  interface OutsideAmountBreakdown {
    loanRemainingAmount: number;
    chitFundOutsideAmount: number;
  }

  interface PartnerBalance {
    id: number;
    name: string;
    balance: number;
  }

  interface BalanceSummaryData {
    totalBalance: number;
    partnerBalances: Array<{
      partnerId: number;
      partnerName: string;
      balance: number;
    }>;
  }

  interface DashboardData {
    totalCashInflow: number;
    totalCashOutflow: number;
    totalProfit: number;
    loanProfit: number;
    chitFundProfit: number;
    totalOutsideAmount: number;
    outsideAmountBreakdown: OutsideAmountBreakdown;
    activeChitFunds: number;
    totalMembers: number;
    activeLoans: number;
    investedAmount?: number; // Recorded amount transactions
    recentActivities: Activity[];
    upcomingEvents: Event[];
    totalUpcomingEvents?: number; // Total count of upcoming events
    totalActivities?: number; // Total count of activities
  }

  // Using FinancialDataPoint from the API

  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totalCashInflow: 0,
    totalCashOutflow: 0,
    totalProfit: 0,
    loanProfit: 0,
    chitFundProfit: 0,
    totalOutsideAmount: 0,
    investedAmount: 0,
    outsideAmountBreakdown: {
      loanRemainingAmount: 0,
      chitFundOutsideAmount: 0,
    },
    activeChitFunds: 0,
    totalMembers: 0,
    activeLoans: 0,
    recentActivities: [],
    upcomingEvents: [],
  });
  const [balanceSummary, setBalanceSummary] = useState<BalanceSummaryData | null>(null);
  const [partnerBalances, setPartnerBalances] = useState<PartnerBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProfit, setShowProfit] = useState(false);

  useEffect(() => {
    // Fetch dashboard data and partner balances from the API
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        console.log("Fetching dashboard data...");

        // Fetch dashboard summary
        const data = await dashboardAPI.getSummary();

        console.log("Fetched dashboard data:", data);
        console.log("Loan profit from API:", data.profit?.loans);

        // Map API response to dashboard data structure
        setDashboardData({
          totalCashInflow: data.cashInflow || 0,
          totalCashOutflow: data.cashOutflow || 0,
          totalProfit: data.profit?.total || 0,
          loanProfit: data.profit?.loans || 0,
          chitFundProfit: data.profit?.chitFunds || 0,
          totalOutsideAmount: data.outsideAmount || 0,
          investedAmount: data.investedAmount || 0,
          outsideAmountBreakdown: {
            loanRemainingAmount:
              data.outsideAmountBreakdown?.loanRemainingAmount || 0,
            chitFundOutsideAmount:
              data.outsideAmountBreakdown?.chitFundOutsideAmount || 0,
          },
          activeChitFunds: data.counts?.activeChitFunds || 0,
          totalMembers: data.counts?.members || 0,
          activeLoans: data.counts?.activeLoans || 0,
          recentActivities: data.recentActivities || [],
          upcomingEvents: data.upcomingEvents || [],
          totalUpcomingEvents: data.totalUpcomingEvents || 0,
        });

        console.log("Dashboard data after setting:", {
          loanProfit: data.profit?.loans,
          chitFundProfit: data.profit?.chitFunds,
          totalProfit: data.profit?.total,
        });

        // Fetch balance summary for accurate total balance
        const balanceSummaryResponse = await fetch('/api/balance/summary');
        if (balanceSummaryResponse.ok) {
          const balanceSummaryData = await balanceSummaryResponse.json();
          setBalanceSummary(balanceSummaryData);
          console.log("Balance summary:", balanceSummaryData);
        }

        // Fetch partner balances for the Partner Balances card
        const partnersResponse = await fetch('/api/partners?includeBalances=true');
        if (partnersResponse.ok) {
          const partnersData = await partnersResponse.json();
          setPartnerBalances(partnersData.partners || []);
        }

        setError(null);
      } catch (err: any) {
        console.error("Error fetching dashboard data:", err);
        setError(
          err.message ||
            "Failed to load dashboard data. Please try again later."
        );
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Create stats array from dashboard data
  const stats = [
    {
      label: "Active Loans",
      value: dashboardData.activeLoans,
      color: "bg-purple-500",
    },
    {
      label: "Active Chit Funds",
      value: dashboardData.activeChitFunds,
      color: "bg-blue-500",
    },
    {
      label: "Total Members",
      value: dashboardData.totalMembers,
      color: "bg-green-500",
    },
  ];

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="container mx-auto px-2 sm:px-4 py-6 sm:py-8 max-w-screen-xl w-full">
      <div className="flex flex-row flex-wrap items-center justify-between gap-2 mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-blue-700">
          Dashboard
        </h1>
        <div className="flex flex-row flex-wrap gap-1 sm:gap-2 w-auto">
          {/* Manage Members */}
          <Link
            href="/members"
            aria-label="Manage Members"
            className="p-2 rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition flex items-center justify-center sm:px-4 sm:py-2"
          >
            <UserGroupIcon className="h-5 w-5 block sm:hidden" />
            <span className="hidden sm:inline-flex items-center">
              <UserGroupIcon className="h-5 w-5 mr-2" />
              Manage Members
            </span>
          </Link>
          {/* New Chit Fund */}
          <Link
            href="/chit-funds/new"
            aria-label="New Chit Fund"
            className="p-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition flex items-center justify-center sm:px-4 sm:py-2"
          >
            <PlusCircleIcon className="h-5 w-5 block sm:hidden" />
            <span className="hidden sm:inline-flex items-center">
              <PlusCircleIcon className="h-5 w-5 mr-2" />
              New Chit Fund
            </span>
          </Link>
          {/* New Loan */}
          <Link
            href="/loans/new"
            aria-label="New Loan"
            className="p-2 rounded-lg bg-green-600 text-white hover:bg-green-700 transition flex items-center justify-center sm:px-4 sm:py-2"
          >
            <CurrencyRupeeIcon className="h-5 w-5 block sm:hidden" />
            <span className="hidden sm:inline-flex items-center">
              <CurrencyRupeeIcon className="h-5 w-5 mr-2" />
              New Loan
            </span>
          </Link>
        </div>
      </div>

      {loading ? (
        <DashboardSkeleton />
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-sm sm:text-base">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      ) : (
        <>
          {/* Financial Overview */}
          <div className="grid grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8 md:grid-cols-3">
            <div className="bg-white shadow-md rounded-lg p-4 sm:p-6 border-t-4 border-purple-500">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-600">
                Outstanding Loan Amount
              </h2>
              <p className="text-2xl font-bold text-purple-700">
                {formatCurrency(
                  dashboardData.outsideAmountBreakdown.loanRemainingAmount
                )}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Pending loan repayments
              </p>
            </div>
            <div className="bg-white shadow-md rounded-lg p-4 sm:p-6 border-t-4 border-blue-500">
              <h2 className="text-lg sm:text-xl font-semibold text-gray-600">
                Outstanding Chit Fund Amount
              </h2>
              <p className="text-2xl font-bold text-blue-700">
                {formatCurrency(
                  dashboardData.outsideAmountBreakdown.chitFundOutsideAmount
                )}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                Pending or over-disbursed
              </p>
            </div>
            <div className="bg-white shadow-md rounded-lg p-4 sm:p-6 border-t-4 border-green-500">
              <h2
                className="text-lg sm:text-xl font-semibold text-gray-600 flex items-center cursor-pointer"
                onClick={() => setShowProfit(!showProfit)}
              >
                Total Profit
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 ml-1"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </h2>
              {showProfit ? (
                <p className="text-2xl font-bold text-green-700">
                  {formatCurrency(dashboardData.totalProfit)}
                </p>
              ) : (
                <p className="text-2xl font-bold text-gray-400">***</p>
              )}
            </div>
          </div>

          {/* Profit Breakdown - Only show if showProfit is true */}
          {showProfit && (
            <div className="grid grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
              <div className="bg-white shadow-md rounded-lg p-4 sm:p-6 border-t-4 border-purple-500">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-600">
                  Loan Profit
                </h2>
                <p className="text-2xl font-bold text-purple-700">
                  {formatCurrency(dashboardData.loanProfit)}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  From interest and document charges
                </p>
              </div>
              <div className="bg-white shadow-md rounded-lg p-4 sm:p-6 border-t-4 border-blue-500">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-600">
                  Chit Fund Profit
                </h2>
                <p className="text-2xl font-bold text-blue-700">
                  {formatCurrency(dashboardData.chitFundProfit)}
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  From auction commissions
                </p>
              </div>
            </div>
          )}

          {/* Balance Summary and Partner Balances */}
          <div className="grid grid-cols-1 gap-4 sm:gap-6 mb-6 sm:mb-8 md:grid-cols-2">
            {/* Balance Summary Card - Cash Flow */}
            <div className="bg-white shadow-md rounded-lg p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-blue-700 mb-4">
                Cash Flow Summary
              </h2>
              <div className="space-y-4">

                {/* Invested Amount (Recorded Amount) */}
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-medium">Invested Amount</p>
                      <p className="text-xs text-gray-400">Total recorded transactions</p>
                    </div>
                  </div>
                  <p className="text-lg font-bold text-blue-600">
                    {formatCurrency(dashboardData.investedAmount || 0)}
                  </p>
                </div>
                {/* Cash Inflow */}
                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center mr-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-medium">Cash Inflow</p>
                      <p className="text-xs text-gray-400">Loan repayments + Chit contributions</p>
                    </div>
                  </div>
                  <p className="text-lg font-bold text-green-600">
                    {formatCurrency(dashboardData.totalCashInflow)}
                  </p>
                </div>

                {/* Cash Outflow */}
                <div className="flex items-center justify-between p-3 bg-red-50 rounded-lg">
                  <div className="flex items-center">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mr-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 font-medium">Cash Outflow</p>
                      <p className="text-xs text-gray-400">Loan disbursements + Auction payouts</p>
                    </div>
                  </div>
                  <p className="text-lg font-bold text-red-600">
                    {formatCurrency(dashboardData.totalCashOutflow)}
                  </p>
                </div>
              </div>
            </div>

            {/* Partner Balances Card with Total Balance */}
            <div className="bg-white shadow-md rounded-lg p-4 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-blue-700 mb-4">
                Partner-wise Balance
              </h2>
              
              {/* Total Balance at the top */}
              <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg mb-4 border border-blue-200">
                <div className="flex items-center">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 font-semibold">Total Balance</p>
                    <p className="text-xs text-gray-400">Sum of all partners</p>
                  </div>
                </div>
                <p className={`text-xl font-bold ${balanceSummary && balanceSummary.totalBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {balanceSummary ? formatCurrency(balanceSummary.totalBalance) : formatCurrency(0)}
                </p>
              </div>

              {partnerBalances.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p>No partners found</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {partnerBalances.map((partner) => (
                    <div key={partner.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition">
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mr-3 ${partner.balance >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                          <span className="text-sm font-bold text-gray-700">
                            {partner.name.substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700">{partner.name}</p>
                          <p className="text-xs text-gray-400">
                            {partner.balance >= 0 ? 'Credit balance' : 'Debit balance'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-base font-bold ${partner.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(Math.abs(partner.balance))}
                        </p>
                        {partner.balance >= 0 ? (
                          <span className="text-xs text-green-500 flex items-center justify-end">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                            </svg>
                            CR
                          </span>
                        ) : (
                          <span className="text-xs text-red-500 flex items-center justify-end">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                            </svg>
                            DR
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Current Month Collections */}
          <CurrentMonthCollections />

          {/* Stats Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
            {stats.map((stat, index) => (
              <div
                key={index}
                className={`bg-white rounded-lg shadow-md p-4 sm:p-6 flex flex-col items-center ${
                  stats.length % 2 !== 0 && index === stats.length - 1
                    ? "col-span-2 justify-self-center md:col-span-1 md:justify-self-auto"
                    : ""
                }`}
              >
                <div
                  className={`${stat.color} text-white rounded-full w-12 h-12 flex items-center justify-center mb-4`}
                >
                  <span className="text-xl font-bold">{stat.value}</span>
                </div>
                <h3 className="text-gray-500 text-sm text-center font-bold">
                  {stat.label}
                </h3>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Recent Activities */}
            <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-2 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-blue-700 mb-2 sm:mb-4">
                Recent Activities
              </h2>
              {dashboardData.recentActivities.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No recent activities found.
                </p>
              ) : (
                <div className="space-y-4">
                  {dashboardData.recentActivities.map((activity: Activity) => {
                    // Generate link based on entity type
                    let activityLink = "#";
                    if (activity.entityType === "loan" && activity.entityId) {
                      activityLink = `/loans/${activity.entityId}`;
                    } else if (
                      activity.entityType === "chitFund" &&
                      activity.entityId
                    ) {
                      activityLink = `/chit-funds/${activity.entityId}`;
                    }

                    return (
                      <Link
                        href={activityLink}
                        key={activity.id}
                        className="block border-l-4 pl-4 border-gray-300 hover:bg-gray-50 transition-colors duration-200 pb-4"
                        style={{
                          borderColor:
                            activity.type === "Chit Fund"
                              ? "#3b82f6"
                              : "#10b981",
                        }}
                      >
                        <div className="flex justify-between">
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              activity.type === "Chit Fund"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {activity.type}
                          </span>
                          <span className="text-gray-500 text-sm">
                            {activity.date}
                          </span>
                        </div>
                        <h3 className="font-semibold mt-1">
                          {activity.action}
                        </h3>
                        <p className="text-gray-600 text-sm">
                          {activity.details}
                        </p>
                        {activity.amount && (
                          <p className="text-gray-700 text-sm font-medium mt-1">
                            Amount: {formatCurrency(activity.amount)}
                          </p>
                        )}
                      </Link>
                    );
                  })}
                </div>
              )}
              <div className="mt-6 text-center">
                {dashboardData.totalActivities &&
                dashboardData.totalActivities > 3 ? (
                  <Link
                    href="/activities"
                    className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300"
                  >
                    <span>
                      View All {dashboardData.totalActivities} Activities
                    </span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 ml-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                ) : (
                  <Link
                    href="/activities"
                    className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300"
                  >
                    <span>View All Activities</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 ml-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                )}
              </div>
            </div>

            {/* Upcoming Events */}
            <div className="bg-white rounded-lg shadow-md p-2 sm:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-blue-700 mb-2 sm:mb-4">
                Upcoming Events
              </h2>
              {!dashboardData.upcomingEvents ||
              dashboardData.upcomingEvents.length === 0 ? (
                <p className="text-gray-500 text-center py-4">
                  No upcoming events found.
                </p>
              ) : (
                <div className="space-y-4">
                  {dashboardData.upcomingEvents.map((event: Event) => {
                    // Generate link based on entity type
                    let eventLink = "#";
                    if (event.entityType === "loan" && event.entityId) {
                      eventLink = `/loans/${event.entityId}`;
                    } else if (
                      event.entityType === "chitFund" &&
                      event.entityId
                    ) {
                      eventLink = `/chit-funds/${event.entityId}`;
                    }

                    return (
                      <Link
                        href={eventLink}
                        key={event.id}
                        className={`block border-l-4 pl-4 hover:bg-gray-50 transition-colors duration-200 ${
                          event.isDueTomorrow
                            ? "bg-yellow-50 rounded-r p-2"
                            : ""
                        }`}
                        style={{
                          borderColor:
                            event.type === "Chit Fund" ? "#3b82f6" : "#10b981",
                        }}
                      >
                        <h3 className="font-semibold">{event.title}</h3>
                        <p className="text-gray-600 text-sm">{event.date}</p>
                        {event.dueAmount !== undefined && (
                          <p className="text-gray-700 text-sm font-medium mt-1">
                            Amount: {formatCurrency(event.dueAmount)}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-1">
                          <span
                            className={`inline-block px-2 py-1 rounded-full text-xs ${
                              event.type === "Chit Fund"
                                ? "bg-blue-100 text-blue-800"
                                : "bg-green-100 text-green-800"
                            }`}
                          >
                            {event.type}
                          </span>
                          {event.isDueTomorrow && (
                            <span
                              className="px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200"
                              title="This event is due tomorrow"
                            >
                              Due Tomorrow
                            </span>
                          )}
                          {event.status === "Paid" && (
                            <span
                              className="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200"
                              title="This payment has been made"
                            >
                              Paid
                            </span>
                          )}
                          {event.status === "Overdue" && (
                            <span
                              className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 border border-red-200"
                              title="This payment is overdue"
                            >
                              Overdue
                            </span>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
              <div className="mt-6 text-center">
                {dashboardData.totalUpcomingEvents &&
                dashboardData.totalUpcomingEvents > 3 ? (
                  <Link
                    href="/calendar"
                    className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300"
                  >
                    <span>
                      View All {dashboardData.totalUpcomingEvents} Events
                    </span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 ml-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                ) : (
                  <Link
                    href="/calendar"
                    className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300"
                  >
                    <span>View Full Calendar</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 ml-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
