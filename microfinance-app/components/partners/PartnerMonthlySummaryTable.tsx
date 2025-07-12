'use client';

import React, { useState, useEffect } from 'react';
import { format, parse } from 'date-fns';
import { getLast12Months, getCurrentMonth, extractMonthYear, formatMonthYear } from '../../lib/partnerSummaryUtils';

// Type definitions
type PartnerSummary = {
  id: number;
  partnerId: number;
  month: number;  // Changed from string to number
  year: number;   // Added year field
  closingBalance: number;
  loanRepayment: number;
  loanDisbursement: number;
  chitContributions: number;
  auctionPayout: number;
  remainingAmount: number;
  partner?: {
    id: number;
    name: string;
    code?: string;
  };
};

type Partner = {
  id: number;
  name: string;
  code?: string;
};

const PartnerMonthlySummaryTable = () => {
  // Get current date for defaults
  const currentDate = new Date();
  const currentMonthStr = getCurrentMonth();
  const { month: currentMonthNum, year: currentYearNum } = extractMonthYear(currentMonthStr);

  // State for selected month and year
  const [selectedMonth, setSelectedMonth] = useState(currentMonthNum);
  const [selectedYear, setSelectedYear] = useState(currentYearNum);
  
  // Other state
  const [partners, setPartners] = useState<Partner[]>([]);
  const [summaries, setSummaries] = useState<PartnerSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Generate years for dropdown (current year and 4 previous years)
  const years = Array.from({ length: 5 }, (_, i) => currentYearNum - i);
  
  // Generate months for dropdown (1-12)
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  useEffect(() => {
    // Fetch partners
    const fetchPartners = async () => {
      try {
        const response = await fetch('/api/partners');
        const data = await response.json();
        if (data.success) {
          setPartners(data.data);
        } else {
          setError('Failed to fetch partners');
        }
      } catch (error) {
        console.error('Error fetching partners:', error);
        setError('An error occurred while fetching partners');
      }
    };

    fetchPartners();
  }, []);

  useEffect(() => {
    // Fetch summaries for selected month and year
    const fetchSummaries = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/partner-summary?month=${selectedMonth}&year=${selectedYear}`);
        const data = await response.json();
        
        if (data.success) {
          setSummaries(data.data);
        } else {
          setError(data.error || 'Failed to fetch summaries');
        }
      } catch (error) {
        console.error('Error fetching summaries:', error);
        setError('An error occurred while fetching summaries');
      } finally {
        setLoading(false);
      }
    };

    fetchSummaries();
  }, [selectedMonth, selectedYear]);

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  // Format month and year for display
  const formatMonthDisplay = (monthNum: number, yearNum: number) => {
    const date = new Date(yearNum, monthNum - 1, 1);
    return format(date, 'MMMM yyyy');
  };

  const handleRefreshSummary = async (partnerId: number) => {
    try {
      setLoading(true);
      const response = await fetch('/api/partner-summary', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          partnerId, 
          month: selectedMonth,
          year: selectedYear 
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        // Update the specific partner's summary in the state
        setSummaries(prev => 
          prev.map(summary => 
            summary.partnerId === partnerId ? data.data : summary
          )
        );
      } else {
        setError(data.error || 'Failed to refresh summary');
      }
    } catch (error) {
      console.error('Error refreshing summary:', error);
      setError('An error occurred while refreshing the summary');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-2">
        <h1 className="text-2xl font-bold">Partner Monthly Financial Summary</h1>
        <div className="text-lg font-semibold text-blue-600">
          {formatMonthDisplay(selectedMonth, selectedYear)}
        </div>
      </div>
      
      {/* Month and Year selectors */}
      <div className="mb-4 grid grid-cols-2 gap-x-4">
        <div>
          <label htmlFor="month-select" className="block text-sm font-medium text-gray-700 mb-1">
            Select Month:
          </label>
          <select
            id="month-select"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            {months.map((month) => (
              <option key={month} value={month}>
                {new Date(0, month - 1).toLocaleString('default', { month: 'long' })}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label htmlFor="year-select" className="block text-sm font-medium text-gray-700 mb-1 ">
            Select Year:
          </label>
          <select
            id="year-select"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="block w-full max-w-xs px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-4">
          <svg className="animate-spin h-8 w-8 mx-auto text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="mt-2 text-gray-600">Loading summaries...</p>
        </div>
      ) : (
        <div className="overflow-x-auto w-full" style={{ maxWidth: '80vw' }}>
          <table
            className="w-full bg-white border border-gray-200 table-auto text-xs sm:text-sm"
            style={{ minWidth: '800px' }}
          >
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-left text-xs sm:text-sm font-medium text-gray-500 uppercase tracking-wider border-b">
                  Partner
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Last Month Closing Balance
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Loan Repayment
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Loan Disbursement
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Chit Contributions
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Auction Payout
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Remaining Amount
                </th>
                <th className="px-2 sm:px-4 py-2 sm:py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {summaries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-2 sm:px-4 py-2 sm:py-4 text-center text-gray-500">
                    No summaries found for this month.
                  </td>
                </tr>
              ) : (
                summaries.map((summary) => {
                  const partner = partners.find(p => p.id === summary.partnerId);
                  return (
                    <tr key={summary.id} className="hover:bg-gray-50">
                      <td className="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-sm sm:text-sm font-medium text-gray-900 border-r">
                        {partner?.name || `Partner #${summary.partnerId}`}
                        {partner?.code && <span className="text-xs text-gray-500 ml-1">({partner.code})</span>}
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-sm text-right text-gray-900 border-r">
                        {formatCurrency(summary.closingBalance)}
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-sm text-right text-green-600 border-r">
                        {formatCurrency(summary.loanRepayment)}
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-sm text-right text-red-600 border-r">
                        {formatCurrency(summary.loanDisbursement)}
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-sm text-right text-green-600 border-r">
                        {formatCurrency(summary.chitContributions)}
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-sm text-right text-red-600 border-r">
                        {formatCurrency(summary.auctionPayout)}
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-sm text-right font-semibold border-r">
                        {formatCurrency(summary.remainingAmount)}
                      </td>
                      <td className="px-2 sm:px-4 py-2 sm:py-4 whitespace-nowrap text-sm text-center">
                        <button
                          onClick={() => handleRefreshSummary(summary.partnerId)}
                          className="inline-flex items-center px-3 py-1 border border-transparent text-xs leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Refresh
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
      
      <div className="mt-4 text-sm text-gray-500">
        <p>
          * Last Month Closing Balance is the remaining amount from the previous month.
        </p>
        <p>
          * Remaining Amount = Last Month Closing Balance + Loan Repayment - Loan Disbursement + Chit Contributions - Auction Payout
        </p>
      </div>
    </div>
  );
};

export default PartnerMonthlySummaryTable;
