// @ts-nocheck
"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { dashboardAPI } from "../../lib/api";
import { DashboardSkeleton } from "../components/skeletons/DashboardSkeletons";
import CurrentMonthCollections from "../components/CurrentMonthCollections";
import BusinessROICard from "../components/BusinessROICard";
import CollectionHealthCard from "../components/CollectionHealthCard";
import CapitalUtilizationCard from "../components/CapitalUtilizationCard";
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
      color: "bg-blue-500",
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
    <div className="page-container">
      <div className="flex flex-row flex-wrap items-center justify-between gap-3 mb-6 sm:mb-8">
        <h1 className="page-title">Dashboard</h1>
        <div className="flex flex-row flex-wrap items-center gap-2 w-auto">
          <Link
            href="/members"
            aria-label="Manage Members"
            className="btn-secondary p-2 sm:px-4 sm:py-2"
          >
            <UserGroupIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Members</span>
          </Link>
          <Link
            href="/chit-funds/new"
            aria-label="New Chit Fund"
            className="btn-secondary p-2 sm:px-4 sm:py-2"
          >
            <PlusCircleIcon className="h-4 w-4" />
            <span className="hidden sm:inline">New Chit Fund</span>
          </Link>
          <Link
            href="/loans/new"
            aria-label="New Loan"
            className="btn-primary p-2 sm:px-4 sm:py-2"
          >
            <CurrencyRupeeIcon className="h-4 w-4" />
            <span className="hidden sm:inline">New Loan</span>
          </Link>
        </div>
      </div>

      {loading ? (
        <DashboardSkeleton />
      ) : error ? (
        <div className="alert-error text-sm sm:text-base">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      ) : (
        <>
          {/* Balance Summary and Partner Balances - Moved to Top */}
          <div className="grid grid-cols-1 gap-4 sm:gap-6 mb-6 sm:mb-8 md:grid-cols-2">
            {/* Balance Summary Card - Cash Flow */}
            <div className="dark-card p-4 sm:p-6">
              <h2 className="card-title">
                Cash Flow Summary
              </h2>
              <div className="space-y-4">

                <div className="metric-row-blue">
                  <div className="flex items-center">
                    <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-surface-elevated flex items-center justify-center mr-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">Invested Amount</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">Total recorded transactions</p>
                    </div>
                  </div>
                  <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(dashboardData.investedAmount || 0)}
                  </p>
                </div>
                <div className="metric-row-green">
                  <div className="flex items-center">
                    <div className="w-9 h-9 rounded-lg bg-green-50 dark:bg-surface-elevated flex items-center justify-center mr-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">Cash Inflow</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">Loan repayments + Chit contributions</p>
                    </div>
                  </div>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">
                    {formatCurrency(dashboardData.totalCashInflow)}
                  </p>
                </div>

                <div className="metric-row-red">
                  <div className="flex items-center">
                    <div className="w-9 h-9 rounded-lg bg-red-50 dark:bg-surface-elevated flex items-center justify-center mr-3">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">Cash Outflow</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">Loan disbursements + Auction payouts</p>
                    </div>
                  </div>
                  <p className="text-lg font-bold text-red-600 dark:text-red-400">
                    {formatCurrency(dashboardData.totalCashOutflow)}
                  </p>
                </div>
              </div>
            </div>

            <div className="dark-card p-4 sm:p-6">
              <h2 className="card-title">
                Partner-wise Balance
              </h2>
              
              <div className="metric-row-highlight">
                <div className="flex items-center">
                  <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-surface-elevated flex items-center justify-center mr-3">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-300 font-semibold">Total Balance</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">Sum of all partners</p>
                  </div>
                </div>
                <p className={`text-xl font-bold ${balanceSummary && balanceSummary.totalBalance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {balanceSummary ? formatCurrency(balanceSummary.totalBalance) : formatCurrency(0)}
                </p>
              </div>

              {partnerBalances.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-2 text-gray-300 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <p>No partners found</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {partnerBalances.map((partner) => (
                    <div key={partner.id} className="list-item-row gap-4">
                      <div className="flex items-center min-w-0 flex-1">
                        <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-surface-elevated flex items-center justify-center mr-3">
                          <span className="text-sm font-bold text-gray-700 dark:text-gray-200">
                            {partner.name.substring(0, 2).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-200">{partner.name}</p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">
                            {partner.balance >= 0 ? 'Credit balance' : 'Debit balance'}
                          </p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <p className={`text-base font-bold ${partner.balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
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

          {/* Financial Overview */}
          <div className="grid grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8 md:grid-cols-3">
            <div className="dark-card p-4 sm:p-6">
              <p className="text-sm font-medium text-gray-500 dark:text-theme-muted mb-1">Outstanding Loans</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-theme-heading">
                {formatCurrency(dashboardData.outsideAmountBreakdown.loanRemainingAmount)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Pending loan repayments</p>
            </div>
            <div className="dark-card p-4 sm:p-6">
              <p className="text-sm font-medium text-gray-500 dark:text-theme-muted mb-1">Outstanding Chit Funds</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-theme-heading">
                {formatCurrency(dashboardData.outsideAmountBreakdown.chitFundOutsideAmount)}
              </p>
              <p className="text-xs text-gray-400 mt-1">Pending or over-disbursed</p>
            </div>
            <div className="dark-card p-4 sm:p-6">
              <button
                className="flex items-center gap-1 text-sm font-medium text-gray-500 dark:text-theme-muted mb-1 w-full text-left"
                onClick={() => setShowProfit(!showProfit)}
              >
                Total Profit
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              {showProfit ? (
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{formatCurrency(dashboardData.totalProfit)}</p>
              ) : (
                <p className="text-2xl font-bold text-gray-300 dark:text-theme-muted tracking-widest">• • •</p>
              )}
            </div>
          </div>

          {/* Profit Breakdown */}
          {showProfit && (
            <div className="grid grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
              <div className="dark-card p-4 sm:p-6">
                <p className="text-sm font-medium text-gray-500 dark:text-theme-muted mb-1">Loan Profit</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-theme-heading">{formatCurrency(dashboardData.loanProfit)}</p>
                <p className="text-xs text-gray-400 mt-1">From interest and document charges</p>
              </div>
              <div className="dark-card p-4 sm:p-6">
                <p className="text-sm font-medium text-gray-500 dark:text-theme-muted mb-1">Chit Fund Profit</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-theme-heading">{formatCurrency(dashboardData.chitFundProfit)}</p>
                <p className="text-xs text-gray-400 mt-1">From auction commissions</p>
              </div>
            </div>
          )}

          {/* Business ROI Card */}
          {/* <div className="grid grid-cols-1 gap-4 sm:gap-6 mb-6 sm:mb-8 md:grid-cols-2 lg:grid-cols-3">
            <BusinessROICard
              totalProfit={dashboardData.totalProfit}
              investedAmount={dashboardData.investedAmount || 0}
            />
            <CollectionHealthCard />
            <CapitalUtilizationCard
              totalOutstanding={
                dashboardData.outsideAmountBreakdown.loanRemainingAmount + 
                dashboardData.outsideAmountBreakdown.chitFundOutsideAmount
              }
              investedAmount={dashboardData.investedAmount || 0}
            />
          </div> */}

          {/* Current Month Collections */}
          <CurrentMonthCollections />

          {/* Stats Overview */}
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
            {stats.map((stat, index) => (
              <div
                key={index}
                className={`dark-card p-4 sm:p-6 ${
                  stats.length % 2 !== 0 && index === stats.length - 1
                    ? "col-span-2 md:col-span-1"
                    : ""
                }`}
              >
                <p className="text-3xl font-bold text-gray-900 dark:text-theme-heading">{stat.value}</p>
                <p className="text-sm text-gray-500 dark:text-theme-muted mt-1">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {/* Recent Activities */}
            <div className="lg:col-span-2 dark-card p-2 sm:p-6">
              <h2 className="section-heading mb-2 sm:mb-4">
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
                        className="block border-l-4 pl-4 border-gray-200 dark:border-surface-border hover:bg-gray-50 dark:hover:bg-surface-hover transition-colors duration-200 pb-4 rounded-r-lg"
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
                                ? "badge-blue"
                                : "badge-green"
                            }`}
                          >
                            {activity.type}
                          </span>
                          <span className="text-gray-500 text-sm">
                            {activity.date}
                          </span>
                        </div>
                        <h3 className="font-semibold mt-1 text-gray-900 dark:text-theme-heading">
                          {activity.action}
                        </h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                          {activity.details}
                        </p>
                        {activity.amount && (
                          <p className="text-gray-700 dark:text-gray-300 text-sm font-medium mt-1">
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
            <div className="dark-card p-2 sm:p-6">
              <h2 className="section-heading mb-2 sm:mb-4">
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
                        className={`block border-l-4 pl-4 hover:bg-gray-50 dark:hover:bg-surface-hover transition-colors duration-200 rounded-r-lg ${
                          event.isDueTomorrow
                            ? "bg-yellow-50 dark:bg-yellow-900 dark:bg-opacity-20 rounded-r p-2"
                            : ""
                        }`}
                        style={{
                          borderColor:
                            event.type === "Chit Fund" ? "#3b82f6" : "#10b981",
                        }}
                      >
                        <h3 className="font-semibold text-gray-900 dark:text-theme-heading">{event.title}</h3>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">{event.date}</p>
                        {event.dueAmount !== undefined && (
                          <p className="text-gray-700 dark:text-gray-300 text-sm font-medium mt-1">
                            Amount: {formatCurrency(event.dueAmount)}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-1">
                          <span
                            className={`inline-block px-2 py-1 rounded-full text-xs ${
                              event.type === "Chit Fund"
                                ? "badge-blue"
                                : "badge-green"
                            }`}
                          >
                            {event.type}
                          </span>
                          {event.isDueTomorrow && (
                            <span className="badge-amber" title="This event is due tomorrow">
                              Due Tomorrow
                            </span>
                          )}
                          {event.status === "Paid" && (
                            <span className="badge-paid" title="This payment has been made">
                              Paid
                            </span>
                          )}
                          {event.status === "Overdue" && (
                            <span className="badge-overdue" title="This payment is overdue">
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
