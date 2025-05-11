'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { dashboardAPI } from '@/lib/api';

export default function DashboardPage() {
  interface Activity {
    id: string | number;
    type: string;
    action: string;
    details: string;
    date: string;
  }

  interface Event {
    id: string | number;
    title: string;
    date: string;
    type: string;
  }

  interface DashboardData {
    totalCashInflow: number;
    totalCashOutflow: number;
    totalProfit: number;
    loanProfit: number;
    chitFundProfit: number;
    activeChitFunds: number;
    totalMembers: number;
    activeLoans: number;
    recentActivities: Activity[];
    upcomingEvents: Event[];
  }

  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totalCashInflow: 0,
    totalCashOutflow: 0,
    totalProfit: 0,
    loanProfit: 0,
    chitFundProfit: 0,
    activeChitFunds: 0,
    totalMembers: 0,
    activeLoans: 0,
    recentActivities: [],
    upcomingEvents: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showProfit, setShowProfit] = useState(false);

  useEffect(() => {
    // Fetch dashboard data from the API
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        console.log('Fetching dashboard data...');

        const data = await dashboardAPI.getSummary();

        console.log('Fetched dashboard data:', data);
        setDashboardData(data);
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
        <div className="flex justify-center items-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-700 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading dashboard data...</p>
          </div>
        </div>
      ) : error ? (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      ) : (
        <>
          {/* Financial Overview */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white shadow-md rounded-lg p-6 border-t-4 border-blue-500">
              <h2 className="text-lg font-semibold text-gray-600">Total Cash Inflow</h2>
              <p className="text-2xl font-bold text-blue-700">{formatCurrency(dashboardData.totalCashInflow)}</p>
            </div>
            <div className="bg-white shadow-md rounded-lg p-6 border-t-4 border-red-500">
              <h2 className="text-lg font-semibold text-gray-600">Total Cash Outflow</h2>
              <p className="text-2xl font-bold text-red-700">{formatCurrency(dashboardData.totalCashOutflow)}</p>
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
                  {dashboardData.recentActivities.map((activity: Activity) => (
                    <div key={activity.id} className="border-b pb-4 last:border-b-0 last:pb-0">
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
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 text-center">
                <Link href="/activities" className="text-blue-600 hover:underline">
                  View All Activities
                </Link>
              </div>
            </div>

            {/* Upcoming Events */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-bold text-blue-700 mb-4">Upcoming Events</h2>
              {dashboardData.upcomingEvents.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No upcoming events found.</p>
              ) : (
                <div className="space-y-4">
                  {dashboardData.upcomingEvents.map((event: Event) => (
                    <div key={event.id} className="border-l-4 pl-4" style={{
                      borderColor: event.type === 'Chit Fund' ? '#3b82f6' : '#10b981'
                    }}>
                      <h3 className="font-semibold">{event.title}</h3>
                      <p className="text-gray-600 text-sm">{event.date}</p>
                      <span className={`inline-block mt-1 px-2 py-1 rounded-full text-xs ${
                        event.type === 'Chit Fund' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                      }`}>
                        {event.type}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-4 text-center">
                <Link href="/calendar" className="text-blue-600 hover:underline">
                  View Calendar
                </Link>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}