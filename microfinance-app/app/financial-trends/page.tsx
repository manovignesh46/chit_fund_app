// @ts-nocheck
"use client";

import React, { useState, useEffect } from "react";
import { dashboardAPI, FinancialDataPoint } from "../../lib/api";
import FinancialGraph from "../components/FinancialGraph";

export default function FinancialTrendsPage() {
  // Financial graph data and controls
  const [financialData, setFinancialData] = useState<FinancialDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<
    "weekly" | "monthly" | "yearly"
  >("monthly");

  // Fetch dashboard data for summary (needed for fallback when no data)
  const [dashboardSummary, setDashboardSummary] = useState({
    totalCashInflow: 0,
    totalCashOutflow: 0,
    totalProfit: 0,
    totalOutsideAmount: 0,
  });

  useEffect(() => {
    // Fetch basic dashboard summary
    const fetchDashboardSummary = async () => {
      try {
        const data = await dashboardAPI.getSummary();
        setDashboardSummary({
          totalCashInflow: data.totalCashInflow,
          totalCashOutflow: data.totalCashOutflow,
          totalProfit: data.totalProfit,
          totalOutsideAmount: data.totalOutsideAmount,
        });
      } catch (err) {
        console.error("Error fetching dashboard summary:", err);
      }
    };

    fetchDashboardSummary();
  }, []);

  // Fetch financial data for the graph based on selected duration
  useEffect(() => {
    const fetchFinancialData = async () => {
      try {
        setLoading(true);
        setError(null);
        console.log(
          `Fetching financial data with duration: ${selectedDuration}`
        );

        // Determine limit based on duration
        const limit =
          selectedDuration === "weekly"
            ? 8
            : selectedDuration === "monthly"
            ? 12
            : 5;

        // Fetch data using the API client
        const apiData = await dashboardAPI.getFinancialData(
          selectedDuration,
          limit
        );
        console.log("Fetched financial data from API:", apiData);

        // Transform the API response into the format expected by FinancialGraph
        if (
          apiData &&
          apiData.labels &&
          Array.isArray(apiData.labels) &&
          apiData.labels.length > 0
        ) {
          // Validate that all required arrays exist and have the same length
          if (
            !apiData.cashInflow ||
            !Array.isArray(apiData.cashInflow) ||
            !apiData.cashOutflow ||
            !Array.isArray(apiData.cashOutflow) ||
            !apiData.profit ||
            !Array.isArray(apiData.profit) ||
            !apiData.outsideAmount ||
            !Array.isArray(apiData.outsideAmount)
          ) {
            console.error(
              "Missing required data arrays in API response:",
              apiData
            );
            setError("Missing required data in API response");
            return;
          }

          // Ensure all arrays have the same length
          const labelsLength = apiData.labels.length;
          if (
            apiData.cashInflow.length !== labelsLength ||
            apiData.cashOutflow.length !== labelsLength ||
            apiData.profit.length !== labelsLength ||
            apiData.outsideAmount.length !== labelsLength
          ) {
            console.error("Data arrays have inconsistent lengths:", {
              labels: apiData.labels.length,
              cashInflow: apiData.cashInflow.length,
              cashOutflow: apiData.cashOutflow.length,
              profit: apiData.profit.length,
              outsideAmount: apiData.outsideAmount.length,
            });
            setError("Inconsistent data format received from API");
            return;
          }

          // Check if all values are zero
          const allZeros =
            apiData.cashInflow.every((val) => val === 0) &&
            apiData.cashOutflow.every((val) => val === 0) &&
            apiData.profit.every((val) => val === 0) &&
            apiData.outsideAmount.every((val) => val === 0);

          // If all values are zero, create sample data based on dashboard summary
          if (allZeros) {
            console.log(
              `All zeros detected in ${selectedDuration} data, creating sample data from dashboard summary`
            );

            // Create sample data based on the selected duration
            let periodLabel: string;
            let startDate: Date;
            let endDate: Date = new Date();

            if (selectedDuration === "yearly") {
              // For yearly, use the current year
              periodLabel = new Date().getFullYear().toString();
              startDate = new Date(new Date().getFullYear(), 0, 1);
            } else if (selectedDuration === "monthly") {
              // For monthly, use the current month
              const now = new Date();
              periodLabel = now.toLocaleString("default", {
                month: "long",
                year: "numeric",
              });
              startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            } else {
              // For weekly, use the current week
              const now = new Date();
              const startOfWeek = new Date(now);
              startOfWeek.setDate(now.getDate() - now.getDay());
              periodLabel = `Week of ${startOfWeek.toLocaleDateString()}`;
              startDate = startOfWeek;
            }

            // Transform to FinancialDataPoint format using summary data
            const transformedData: FinancialDataPoint[] = [
              {
                label: periodLabel,
                period: periodLabel,
                cashInflow: dashboardSummary.totalCashInflow,
                cashOutflow: dashboardSummary.totalCashOutflow,
                profit: dashboardSummary.totalProfit,
                outsideAmount: dashboardSummary.totalOutsideAmount,
                periodRange: {
                  startDate: startDate.toISOString(),
                  endDate: endDate.toISOString()
                },
                cashFlowDetails: {
                  contributionInflow: 0,
                  repaymentInflow: 0,
                  auctionOutflow: 0,
                  loanOutflow: 0,
                  netCashFlow: dashboardSummary.totalCashInflow - dashboardSummary.totalCashOutflow
                },
                profitDetails: {
                  interestPayments: 0,
                  documentCharges: 0,
                  auctionCommissions: 0
                },
                outsideAmountBreakdown: {
                  loanRemainingAmount: 0,
                  chitFundOutsideAmount: 0
                },
                transactionCounts: {
                  contributions: 0,
                  repayments: 0,
                  auctions: 0,
                  loans: 0
                }
              },
            ];

            setFinancialData(transformedData);
          } else {
            // Transform API data to FinancialDataPoint format
            // Include detailed period data from periodsData if available
            const transformedData: FinancialDataPoint[] = apiData.labels.map(
              (label: string, index: number) => {
                const periodDetail = apiData.periodsData?.[index] || {};
                return {
                  label,
                  period: label, // Use label as period for graph display
                  cashInflow: apiData.cashInflow[index],
                  cashOutflow: apiData.cashOutflow[index],
                  profit: apiData.profit[index],
                  outsideAmount: apiData.outsideAmount[index],
                  // Include detailed period information if available
                  ...periodDetail
                };
              }
            );

            console.log("Transformed financial data:", transformedData);
            setFinancialData(transformedData);
          }
        } else {
          console.error("Invalid or empty financial data response:", apiData);
          setError("No financial data available");
        }
      } catch (err) {
        console.error("Error fetching financial data:", err);
        setError("Failed to load financial data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchFinancialData();
  }, [selectedDuration, dashboardSummary]);

  return (
    <div className="page-container">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="page-title mb-2">
          Financial Trends
        </h1>
        <p className="text-gray-700 dark:text-theme-secondary">
          Visualize your financial data over time with interactive charts
        </p>
      </div>

      {/* Duration selector */}
      <div className="mb-6 flex flex-wrap gap-2">
        <button
          onClick={() => setSelectedDuration("weekly")}
          className={`px-4 py-2 rounded-lg font-medium transition duration-300 ${
            selectedDuration === "weekly"
              ? "bg-blue-600 text-white"
              : "btn-neutral"
          }`}
        >
          Weekly
        </button>
        <button
          onClick={() => setSelectedDuration("monthly")}
          className={`px-4 py-2 rounded-lg font-medium transition duration-300 ${
            selectedDuration === "monthly"
              ? "bg-blue-600 text-white"
              : "btn-neutral"
          }`}
        >
          Monthly
        </button>
        <button
          onClick={() => setSelectedDuration("yearly")}
          className={`px-4 py-2 rounded-lg font-medium transition duration-300 ${
            selectedDuration === "yearly"
              ? "bg-blue-600 text-white"
              : "btn-neutral"
          }`}
        >
          Yearly
        </button>
      </div>

      {/* Financial Graph */}
      <div className="themed-card p-4 sm:p-6">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : error ? (
          <div className="alert-error px-4 py-3 rounded">
            <p className="font-bold">Error</p>
            <p>{error}</p>
          </div>
        ) : (
          <FinancialGraph
            data={financialData}
            duration={selectedDuration}
            loading={loading}
          />
        )}
      </div>

      {/* Information cards */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-green-800">Cash Inflow</h3>
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 11l5-5m0 0l5 5m-5-5v12" />
            </svg>
          </div>
          <p className="text-sm text-gray-700 dark:text-theme-secondary">Money coming in from loans, contributions, and repayments</p>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-red-800">Cash Outflow</h3>
            <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
            </svg>
          </div>
          <p className="text-sm text-gray-700 dark:text-theme-secondary">Money going out for loan disbursements and payouts</p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-blue-800">Profit</h3>
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
          <p className="text-sm text-gray-700 dark:text-theme-secondary">Net profit from interest and fees</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-purple-800">Outside Amount</h3>
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm text-gray-700 dark:text-theme-secondary">Total amount owed (loans + chit funds)</p>
        </div>
      </div>
    </div>
  );
}
