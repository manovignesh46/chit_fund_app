'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { dashboardAPI, FinancialDataPoint } from '@/lib/api';
import FinancialGraph from '../components/FinancialGraph';
import { DashboardSkeleton } from '../components/skeletons/DashboardSkeletons';

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
    status?: 'Paid' | 'Overdue';
    paymentType?: string;
  }

  interface OutsideAmountBreakdown {
    loanRemainingAmount: number;
    chitFundOutsideAmount: number;
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
    outsideAmountBreakdown: {
      loanRemainingAmount: 0,
      chitFundOutsideAmount: 0
    },
    activeChitFunds: 0,
    totalMembers: 0,
    activeLoans: 0,
    recentActivities: [],
    upcomingEvents: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProfit, setShowProfit] = useState(false);

  // Financial graph data and controls
  const [financialData, setFinancialData] = useState<FinancialDataPoint[]>([]);
  const [financialDataLoading, setFinancialDataLoading] = useState(true);
  const [financialDataError, setFinancialDataError] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<'weekly' | 'monthly' | 'yearly'>('monthly');

  useEffect(() => {
    // Fetch dashboard data from the API
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        console.log('Fetching dashboard data...');

        const data = await dashboardAPI.getSummary();

        console.log('Fetched dashboard data:', data);
        console.log('Loan profit from API:', data.profit?.loans);

        // Map API response to dashboard data structure
        setDashboardData({
          totalCashInflow: data.cashInflow || 0,
          totalCashOutflow: data.cashOutflow || 0,
          totalProfit: data.profit?.total || 0,
          loanProfit: data.profit?.loans || 0,
          chitFundProfit: data.profit?.chitFunds || 0,
          totalOutsideAmount: data.outsideAmount || 0,
          outsideAmountBreakdown: {
            loanRemainingAmount: data.outsideAmountBreakdown?.loanRemainingAmount || 0,
            chitFundOutsideAmount: data.outsideAmountBreakdown?.chitFundOutsideAmount || 0
          },
          activeChitFunds: data.counts?.activeChitFunds || 0,
          totalMembers: data.counts?.members || 0,
          activeLoans: data.counts?.activeLoans || 0,
          recentActivities: data.recentActivities || [],
          upcomingEvents: data.upcomingEvents || [],
          totalUpcomingEvents: data.totalUpcomingEvents || 0
        });

        console.log('Dashboard data after setting:', {
          loanProfit: data.profit?.loans,
          chitFundProfit: data.profit?.chitFunds,
          totalProfit: data.profit?.total
        });

        setError(null);
      } catch (err: any) {
        console.error('Error fetching dashboard data:', err);
        setError(err.message || 'Failed to load dashboard data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // No need to import FinancialDataResponse here as it's already imported at the top

  // Fetch financial data for the graph based on selected duration
  useEffect(() => {
    const fetchFinancialData = async () => {
      try {
        setFinancialDataLoading(true);
        console.log(`Fetching financial data with duration: ${selectedDuration}`);

        // Determine limit based on duration
        const limit = selectedDuration === 'weekly' ? 8 : selectedDuration === 'monthly' ? 12 : 5;

        // Fetch data using the API client
        const apiData = await dashboardAPI.getFinancialData(selectedDuration, limit);
        console.log('Fetched financial data from API:', apiData);

        // Transform the API response into the format expected by FinancialGraph
        if (apiData && apiData.labels && Array.isArray(apiData.labels) && apiData.labels.length > 0) {
          // Validate that all required arrays exist and have the same length
          if (!apiData.cashInflow || !Array.isArray(apiData.cashInflow) ||
              !apiData.cashOutflow || !Array.isArray(apiData.cashOutflow) ||
              !apiData.profit || !Array.isArray(apiData.profit) ||
              !apiData.outsideAmount || !Array.isArray(apiData.outsideAmount)) {
            console.error('Missing required data arrays in API response:', apiData);
            setFinancialDataError('Missing required data in API response');
            return;
          }

          // Ensure all arrays have the same length
          const labelsLength = apiData.labels.length;
          if (apiData.cashInflow.length !== labelsLength ||
              apiData.cashOutflow.length !== labelsLength ||
              apiData.profit.length !== labelsLength ||
              apiData.outsideAmount.length !== labelsLength) {
            console.error('Data arrays have inconsistent lengths:', {
              labels: apiData.labels.length,
              cashInflow: apiData.cashInflow.length,
              cashOutflow: apiData.cashOutflow.length,
              profit: apiData.profit.length,
              outsideAmount: apiData.outsideAmount.length
            });
            setFinancialDataError('Inconsistent data format received from API');
            return;
          }

          // Check if all values are zero
          const allZeros = apiData.cashInflow.every(val => val === 0) &&
                          apiData.cashOutflow.every(val => val === 0) &&
                          apiData.profit.every(val => val === 0) &&
                          apiData.outsideAmount.every(val => val === 0);

          // If all values are zero, create sample data based on dashboard summary
          if (allZeros) {
            console.log(`All zeros detected in ${selectedDuration} data, creating sample data from dashboard summary`);

            // Create sample data based on the selected duration
            let periodLabel: string;
            let startDate: Date;
            let endDate: Date = new Date();

            if (selectedDuration === 'yearly') {
              // For yearly, use the current year
              periodLabel = new Date().getFullYear().toString();
              startDate = new Date(new Date().getFullYear(), 0, 1); // Jan 1 of current year
            } else if (selectedDuration === 'monthly') {
              // For monthly, use the current month
              const now = new Date();
              periodLabel = now.toLocaleString('default', { month: 'long', year: 'numeric' });
              startDate = new Date(now.getFullYear(), now.getMonth(), 1); // First day of current month
            } else {
              // For weekly, use the current week
              const now = new Date();
              const weekNumber = Math.ceil(now.getDate() / 7);
              const monthName = now.toLocaleString('default', { month: 'short' });
              periodLabel = `Week ${weekNumber} of ${monthName} ${now.getFullYear()}`;

              // Calculate start of week (go back to previous Sunday or current day if it's Sunday)
              startDate = new Date(now);
              const day = startDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
              if (day !== 0) {
                startDate.setDate(startDate.getDate() - day);
              }
            }

            const sampleData = [{
              period: periodLabel,
              cashInflow: dashboardData.totalCashInflow,
              cashOutflow: dashboardData.totalCashOutflow,
              profit: dashboardData.totalProfit,
              outsideAmount: dashboardData.totalOutsideAmount,
              loanProfit: dashboardData.loanProfit,
              chitFundProfit: dashboardData.chitFundProfit,
              outsideAmountBreakdown: {
                loanRemainingAmount: dashboardData.outsideAmountBreakdown.loanRemainingAmount,
                chitFundOutsideAmount: dashboardData.outsideAmountBreakdown.chitFundOutsideAmount
              },
              cashFlowDetails: {
                contributionInflow: 0, // We don't have this breakdown
                repaymentInflow: dashboardData.totalCashInflow,
                auctionOutflow: 0, // We don't have this breakdown
                loanOutflow: dashboardData.totalCashOutflow,
                netCashFlow: dashboardData.totalCashInflow - dashboardData.totalCashOutflow
              },
              profitDetails: {
                interestPayments: dashboardData.loanProfit,
                documentCharges: 0, // We don't have this breakdown
                auctionCommissions: dashboardData.chitFundProfit
              },
              transactionCounts: {
                loanDisbursements: 1, // Assuming at least one loan
                loanRepayments: 1, // Assuming at least one repayment
                chitFundContributions: 0,
                chitFundAuctions: 0,
                totalTransactions: 2 // Sum of the above
              },
              periodRange: {
                startDate: startDate.toISOString(),
                endDate: endDate.toISOString()
              }
            }];

            console.log(`Created sample data for current ${selectedDuration} period:`, sampleData);
            setFinancialData(sampleData);
            return;
          }

          // Check if we have detailed period data
          let transformedData;

          if (apiData.periodsData && Array.isArray(apiData.periodsData)) {
            console.log('Using detailed period data from API');
            transformedData = apiData.periodsData;
          } else {
            console.log('Detailed period data not available, creating basic data');
            // Create basic data points if detailed data is not available
            transformedData = apiData.labels.map((label: string, index: number) => {
              // Create a data point object for each period
              return {
                period: label,
                cashInflow: apiData.cashInflow[index] || 0,
                cashOutflow: apiData.cashOutflow[index] || 0,
                profit: apiData.profit[index] || 0,
                outsideAmount: apiData.outsideAmount[index] || 0,
                // Add default values for other required properties
                loanProfit: 0,
                chitFundProfit: 0,
                outsideAmountBreakdown: {
                  loanRemainingAmount: 0,
                  chitFundOutsideAmount: 0
                },
                cashFlowDetails: {
                  contributionInflow: 0,
                  repaymentInflow: 0,
                  auctionOutflow: 0,
                  loanOutflow: 0,
                  netCashFlow: (apiData.cashInflow[index] || 0) - (apiData.cashOutflow[index] || 0)
                },
                profitDetails: {
                  interestPayments: 0,
                  documentCharges: 0,
                  auctionCommissions: 0
                },
                transactionCounts: {
                  loanDisbursements: 0,
                  loanRepayments: 0,
                  chitFundContributions: 0,
                  chitFundAuctions: 0,
                  totalTransactions: 0
                },
                periodRange: {
                  startDate: new Date().toISOString(), // Default value
                  endDate: new Date().toISOString() // Default value
                }
              };
            });
          }

          console.log('Transformed financial data for graph:', transformedData);
          setFinancialData(transformedData);
        } else {
          console.error('Invalid data format received from API:', apiData);
          setFinancialDataError('Invalid data format received from API');
        }

      } catch (err: any) {
        console.error('Error fetching financial data:', err);
        setFinancialDataError(err.message || 'Failed to load financial data. Please try again later.');
      } finally {
        setFinancialDataLoading(false);
      }
    };

    fetchFinancialData();
  }, [selectedDuration, dashboardData]);



  // Create stats array from dashboard data
  const stats = [
    { label: 'Active Chit Funds', value: dashboardData.activeChitFunds, color: 'bg-blue-500' },
    { label: 'Total Members', value: dashboardData.totalMembers, color: 'bg-green-500' },
    { label: 'Active Loans', value: dashboardData.activeLoans, color: 'bg-purple-500' },
  ];

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-blue-700">Dashboard</h1>
        <div className="flex space-x-4">
          <Link href="/members" className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition duration-300">
            Manage Members
          </Link>
          <Link href="/chit-funds/new" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300">
            New Chit Fund
          </Link>
          <Link href="/loans/new" className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition duration-300">
            New Loan
          </Link>
        </div>
      </div>

      {loading ? (
        <DashboardSkeleton />
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      ) : (
        <>
          {/* Financial Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white shadow-md rounded-lg p-6 border-t-4 border-purple-500">
              <h2 className="text-lg font-semibold text-gray-600">Remaining Loan Balances</h2>
              <p className="text-2xl font-bold text-purple-700">{formatCurrency(dashboardData.outsideAmountBreakdown.loanRemainingAmount)}</p>
              <p className="text-sm text-gray-500 mt-2">Pending loan repayments to be collected</p>
            </div>
            <div className="bg-white shadow-md rounded-lg p-6 border-t-4 border-blue-500">
              <h2 className="text-lg font-semibold text-gray-600">Chit Fund Outside Amount</h2>
              <p className="text-2xl font-bold text-blue-700">{formatCurrency(dashboardData.outsideAmountBreakdown.chitFundOutsideAmount)}</p>
              <p className="text-sm text-gray-500 mt-2">Pending or over-disbursed from chit funds</p>
            </div>
            <div className="bg-white shadow-md rounded-lg p-6 border-t-4 border-green-500">
              <h2
                className="text-lg font-semibold text-gray-600 flex items-center cursor-pointer"
                onClick={() => setShowProfit(!showProfit)}
              >
                Total Profit
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </h2>
              {showProfit ? (
                <p className="text-2xl font-bold text-green-700">{formatCurrency(dashboardData.totalProfit)}</p>
              ) : (
                <p className="text-2xl font-bold text-gray-400">***</p>
              )}
            </div>
          </div>

          {/* Profit Breakdown - Only show if showProfit is true */}
          {showProfit && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div className="bg-white shadow-md rounded-lg p-6 border-t-4 border-purple-500">
                <h2 className="text-lg font-semibold text-gray-600">Loan Profit</h2>
                <p className="text-2xl font-bold text-purple-700">{formatCurrency(dashboardData.loanProfit)}</p>
                <p className="text-sm text-gray-500 mt-2">From interest and document charges</p>
              </div>
              <div className="bg-white shadow-md rounded-lg p-6 border-t-4 border-blue-500">
                <h2 className="text-lg font-semibold text-gray-600">Chit Fund Profit</h2>
                <p className="text-2xl font-bold text-blue-700">{formatCurrency(dashboardData.chitFundProfit)}</p>
                <p className="text-sm text-gray-500 mt-2">From auction commissions</p>
              </div>
            </div>
          )}

          {/* Financial Graph */}
          <div className="mb-8">
            <div className="bg-white rounded-lg shadow-md p-4 mb-4">
              <div className="flex flex-wrap justify-between items-center">
                <h2 className="text-xl font-bold text-blue-700">Financial Trends</h2>
                <div className="flex flex-wrap items-center gap-4 mt-2 sm:mt-0">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setSelectedDuration('weekly')}
                      className={`px-3 py-1 text-sm rounded-md ${
                        selectedDuration === 'weekly'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Weekly
                    </button>
                    <button
                      onClick={() => setSelectedDuration('monthly')}
                      className={`px-3 py-1 text-sm rounded-md ${
                        selectedDuration === 'monthly'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setSelectedDuration('yearly')}
                      className={`px-3 py-1 text-sm rounded-md ${
                        selectedDuration === 'yearly'
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      Yearly
                    </button>
                  </div>
                  <a
                    href={`/api/dashboard/consolidated?action=export&duration=${selectedDuration}&limit=${selectedDuration === 'weekly' ? 8 : selectedDuration === 'monthly' ? 12 : 5}`}
                    download={`financial_data_${selectedDuration}_${new Date().toISOString().split('T')[0]}.xlsx`}
                    className="flex items-center px-3 py-1 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition duration-300"
                    title={`Export ${selectedDuration} financial data to Excel`}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Export
                  </a>
                </div>
              </div>
            </div>
            <FinancialGraph
              data={financialData}
              loading={financialDataLoading}
              error={financialDataError}
            />
          </div>

          {/* Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {stats.map((stat, index) => (
              <div key={index} className="bg-white rounded-lg shadow-md p-6">
                <div className={`${stat.color} text-white rounded-full w-12 h-12 flex items-center justify-center mb-4`}>
                  <span className="text-xl font-bold">{index + 1}</span>
                </div>
                <h3 className="text-gray-500 text-sm mb-1">{stat.label}</h3>
                <p className="text-2xl font-bold">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Activities */}
            <div className="lg:col-span-2 bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-blue-700 mb-4">Recent Activities</h2>
              {dashboardData.recentActivities.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No recent activities found.</p>
              ) : (
                <div className="space-y-4">
                  {dashboardData.recentActivities.map((activity: Activity) => {
                    // Generate link based on entity type
                    let activityLink = '#';
                    if (activity.entityType === 'loan' && activity.entityId) {
                      activityLink = `/loans/${activity.entityId}`;
                    } else if (activity.entityType === 'chitFund' && activity.entityId) {
                      activityLink = `/chit-funds/${activity.entityId}`;
                    }

                    return (
                      <Link
                        href={activityLink}
                        key={activity.id}
                        className="block border-l-4 pl-4 border-gray-300 hover:bg-gray-50 transition-colors duration-200 pb-4"
                        style={{
                          borderColor: activity.type === 'Chit Fund' ? '#3b82f6' : '#10b981'
                        }}
                      >
                        <div className="flex justify-between">
                          <span className={`px-2 py-1 rounded-full text-xs ${
                            activity.type === 'Chit Fund' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {activity.type}
                          </span>
                          <span className="text-gray-500 text-sm">{activity.date}</span>
                        </div>
                        <h3 className="font-semibold mt-1">{activity.action}</h3>
                        <p className="text-gray-600 text-sm">{activity.details}</p>
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
                {dashboardData.totalActivities && dashboardData.totalActivities > 3 ? (
                  <Link
                    href="/activities"
                    className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300"
                  >
                    <span>View All {dashboardData.totalActivities} Activities</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ) : (
                  <Link
                    href="/activities"
                    className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300"
                  >
                    <span>View All Activities</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                )}
              </div>
            </div>

            {/* Upcoming Events */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-blue-700 mb-4">Upcoming Events</h2>
              {!dashboardData.upcomingEvents || dashboardData.upcomingEvents.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No upcoming events found.</p>
              ) : (
                <div className="space-y-4">
                  {dashboardData.upcomingEvents.map((event: Event) => {
                    // Generate link based on entity type
                    let eventLink = '#';
                    if (event.entityType === 'loan' && event.entityId) {
                      eventLink = `/loans/${event.entityId}`;
                    } else if (event.entityType === 'chitFund' && event.entityId) {
                      eventLink = `/chit-funds/${event.entityId}`;
                    }

                    return (
                      <Link
                        href={eventLink}
                        key={event.id}
                        className={`block border-l-4 pl-4 hover:bg-gray-50 transition-colors duration-200 ${event.isDueTomorrow ? 'bg-yellow-50 rounded-r p-2' : ''}`}
                        style={{
                          borderColor: event.type === 'Chit Fund' ? '#3b82f6' : '#10b981'
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
                          <span className={`inline-block px-2 py-1 rounded-full text-xs ${
                            event.type === 'Chit Fund' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                          }`}>
                            {event.type}
                          </span>
                          {event.isDueTomorrow && (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-amber-100 text-amber-800 border border-amber-200"
                                  title="This event is due tomorrow">
                              Due Tomorrow
                            </span>
                          )}
                          {event.status === 'Paid' && (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200"
                                  title="This payment has been made">
                              Paid
                            </span>
                          )}
                          {event.status === 'Overdue' && (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800 border border-red-200"
                                  title="This payment is overdue">
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
                {dashboardData.totalUpcomingEvents && dashboardData.totalUpcomingEvents > 3 ? (
                  <Link
                    href="/calendar"
                    className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300"
                  >
                    <span>View All {dashboardData.totalUpcomingEvents} Events</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ) : (
                  <Link
                    href="/calendar"
                    className="inline-flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition duration-300"
                  >
                    <span>View Full Calendar</span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
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