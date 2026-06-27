// @ts-nocheck
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiGet } from '../../../lib/apiUtils';
import { formatCurrency } from '../../../lib/formatUtils';
import PageSectionHeader from '../../components/layout/PageSectionHeader';

interface ChitFundOption {
  id: number;
  name: string;
  duration: number;
  currentMonth: number;
  monthlyContribution: number;
  startDate: string;
}

interface PayoutDetail {
  fundName: string;
  amount: number;
  bookedCount: number;
}

interface BookedMember {
  fundId: number;
  fundName: string;
  memberName: string;
  fundMonth: number;
  payoutAmount: number;
}

interface ProjectionRow {
  year: number;
  month: number;
  label: string;
  expectedLoanRepayments: number;
  expectedChitContributions: number;
  totalExpectedCollection: number;
  totalAuctionPayout: number;
  net: number;
  cumulativeBalance: number;
  isCurrentMonth?: boolean;
  payoutSource?: 'actual' | 'booked';
  auctionPayoutDetails?: PayoutDetail[];
  bookedMembers?: BookedMember[];
}

export default function ChitFundProjectionPage() {
  const [chitFunds, setChitFunds] = useState<ChitFundOption[]>([]);
  const [projection, setProjection] = useState<ProjectionRow[]>([]);
  const [simulatedProjection, setSimulatedProjection] = useState<ProjectionRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showSimulation, setShowSimulation] = useState(false);
  const [simulateFundId, setSimulateFundId] = useState<string>('');
  const [simulateCalendarKey, setSimulateCalendarKey] = useState<string>('');
  const [simulatedContribution, setSimulatedContribution] = useState<string>('');
  const [expandedMonthKey, setExpandedMonthKey] = useState<string | null>(null);
  const [openingBalance, setOpeningBalance] = useState<number | null>(null);

  const fetchProjection = async (simParams?: {
    fundId: string;
    year: string;
    month: string;
    contribution: string;
  }) => {
    try {
      setLoading(true);
      setError(null);
      let url = '/api/projection/consolidated';
      if (simParams?.fundId && simParams?.year && simParams?.month) {
        const params = new URLSearchParams({
          simulateFundId: simParams.fundId,
          simulateFromYear: simParams.year,
          simulateFromMonth: simParams.month,
        });
        if (simParams.contribution) {
          params.set('simulatedContribution', simParams.contribution);
        }
        url += `?${params.toString()}`;
      }
      const data = await apiGet(url, 'Failed to load projection');
      setProjection(data.projection || []);
      setSimulatedProjection(data.simulatedProjection || null);
      setChitFunds(data.chitFunds || []);
      setOpeningBalance(data.openingBalance ?? null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjection();
  }, []);

  useEffect(() => {
    if (simulateFundId && !simulatedContribution) {
      const fund = chitFunds.find((f) => String(f.id) === simulateFundId);
      if (fund) {
        setSimulatedContribution(String(fund.monthlyContribution));
      }
    }
  }, [simulateFundId, chitFunds]);

  const calendarMonthOptions = projection.map((row) => ({
    key: `${row.year}-${row.month}`,
    label: row.label,
    year: row.year,
    month: row.month,
  }));

  const applySimulation = () => {
    if (!simulateFundId || !simulateCalendarKey) return;
    const [year, month] = simulateCalendarKey.split('-');
    setShowSimulation(true);
    fetchProjection({
      fundId: simulateFundId,
      year,
      month,
      contribution: simulatedContribution,
    });
  };

  const clearSimulation = () => {
    setShowSimulation(false);
    setSimulatedProjection(null);
    setSimulateFundId('');
    setSimulateCalendarKey('');
    fetchProjection();
  };

  const displayRows = showSimulation && simulatedProjection ? simulatedProjection : projection;
  const compareMode = showSimulation && simulatedProjection && projection.length > 0;

  const toggleMonthExpand = (year: number, month: number) => {
    const key = `${year}-${month}`;
    setExpandedMonthKey((prev) => (prev === key ? null : key));
  };

  const colSpan = compareMode ? 8 : 7;

  return (
    <div className="container mx-auto px-4 py-8">
      <PageSectionHeader
        title="Consolidated Cash Flow Projection"
        subtitle="Calendar-month view across all loans and chit funds — one shared pool of funds."
        actions={
          <Link
            href="/chit-funds/auction-bookings"
            className="btn-primary px-4 py-2 text-sm"
          >
            Edit Bookings
          </Link>
        }
      />

      <div className="dark-card p-4 sm:p-6 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-theme-secondary mb-3">
          Simulate Adding a New Member
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          Add one member&apos;s monthly contribution to a selected chit fund from a calendar month
          onward, and see the impact on consolidated cumulative balance.
        </p>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Chit fund</label>
            <select
              value={simulateFundId}
              onChange={(e) => setSimulateFundId(e.target.value)}
              className="themed-input text-sm min-w-[180px]"
            >
              <option value="">Select fund…</option>
              {chitFunds.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Starting calendar month</label>
            <select
              value={simulateCalendarKey}
              onChange={(e) => setSimulateCalendarKey(e.target.value)}
              className="themed-input text-sm min-w-[180px]"
              disabled={calendarMonthOptions.length === 0}
            >
              <option value="">Select month…</option>
              {calendarMonthOptions.map((opt) => (
                <option key={opt.key} value={opt.key}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Monthly contribution</label>
            <input
              type="number"
              value={simulatedContribution}
              onChange={(e) => setSimulatedContribution(e.target.value)}
              className="themed-input text-sm w-32"
              min="0"
            />
          </div>
          <button
            type="button"
            onClick={applySimulation}
            disabled={!simulateFundId || !simulateCalendarKey || loading}
            className="btn-primary text-sm px-4 py-2 disabled:opacity-50"
          >
            Run Simulation
          </button>
          {showSimulation && (
            <button
              type="button"
              onClick={clearSimulation}
              className="btn-neutral text-sm px-4 py-2"
            >
              Clear Simulation
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="alert-error mb-6 px-4 py-3 rounded">
          <p>{error}</p>
        </div>
      )}

      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
        </div>
      )}

      {!loading && projection.length > 0 && (
        <div className="themed-card overflow-hidden">
          {compareMode && (
            <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-surface-border text-sm text-amber-800 dark:text-amber-200">
              Showing <strong>simulated</strong> consolidated projection. Cumulative balance
              differences vs baseline are highlighted.
            </div>
          )}
          {openingBalance !== null && (
            <div className="px-4 py-2 border-b border-surface-border text-xs text-gray-500 dark:text-theme-muted">
              Current month cumulative balance is anchored to your actual cash balance (
              {formatCurrency(openingBalance)}). Completed auction payouts this month are deducted
              from the payout column. Future months project from that starting point.
            </div>
          )}
          <div className="px-4 py-2 border-b border-surface-border text-xs text-gray-500">
            Click a calendar month to see booked auction winners.
          </div>
          <div className="table-shell">
            <table className="w-full min-w-[960px] divide-y divide-surface-border text-sm">
              <thead className="bg-gray-50 dark:bg-surface-elevated">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Calendar Month
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Loan Repayments
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Chit Contributions
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Total Collection
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Auction Payout
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Net
                  </th>
                  <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    {compareMode ? 'Sim. Cumulative' : 'Cumulative Balance'}
                  </th>
                  {compareMode && (
                    <th className="px-3 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Baseline Cumulative
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {displayRows.map((row, idx) => {
                  const baseline = projection[idx];
                  const cumDiff = compareMode
                    ? row.cumulativeBalance - baseline.cumulativeBalance
                    : 0;
                  const now = new Date();
                  const isCurrent =
                    row.year === now.getFullYear() && row.month === now.getMonth() + 1;
                  const rowKey = `${row.year}-${row.month}`;
                  const isExpanded = expandedMonthKey === rowKey;
                  const hasBookings = (row.bookedMembers?.length ?? 0) > 0;

                  return (
                    <React.Fragment key={rowKey}>
                    <tr
                      onClick={() => toggleMonthExpand(row.year, row.month)}
                      className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-surface-hover ${
                        isCurrent ? 'bg-blue-50/50 dark:bg-blue-900/20' : ''
                      } ${isExpanded ? 'bg-gray-50 dark:bg-surface-hover' : ''}`}
                    >
                      <td className="px-3 py-3 whitespace-nowrap font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          <svg
                            className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                          {row.label}
                          {isCurrent && (
                            <span className="text-xs text-blue-600">(current)</span>
                          )}
                          {hasBookings && (
                            <span className="text-xs text-gray-400 font-normal">
                              ({row.bookedMembers!.length} booked)
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        {row.expectedLoanRepayments > 0
                          ? formatCurrency(row.expectedLoanRepayments)
                          : '—'}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {row.expectedChitContributions > 0
                          ? formatCurrency(row.expectedChitContributions)
                          : '—'}
                      </td>
                      <td className="px-3 py-3 text-right font-medium">
                        {formatCurrency(row.totalExpectedCollection)}
                      </td>
                      <td className="px-3 py-3 text-right text-red-600 dark:text-red-400">
                        {row.totalAuctionPayout > 0 ? (
                          formatCurrency(row.totalAuctionPayout)
                        ) : (
                          '—'
                        )}
                      </td>
                      <td
                        className={`px-3 py-3 text-right font-medium ${
                          row.net > 0
                            ? 'text-green-600 dark:text-green-400'
                            : row.net < 0
                              ? 'text-red-600 dark:text-red-400'
                              : ''
                        }`}
                      >
                        {formatCurrency(row.net)}
                      </td>
                      <td
                        className={`px-3 py-3 text-right font-semibold ${
                          row.cumulativeBalance >= 0
                            ? 'text-green-700 dark:text-green-300'
                            : 'text-red-700 dark:text-red-300'
                        }`}
                      >
                        {formatCurrency(row.cumulativeBalance)}
                        {compareMode && cumDiff !== 0 && (
                          <span
                            className={`block text-xs ${
                              cumDiff >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}
                          >
                            {cumDiff >= 0 ? '+' : ''}
                            {formatCurrency(cumDiff)} vs baseline
                          </span>
                        )}
                      </td>
                      {compareMode && (
                        <td className="px-3 py-3 text-right text-gray-500">
                          {formatCurrency(baseline.cumulativeBalance)}
                        </td>
                      )}
                    </tr>
                    {isExpanded && (
                      <tr className="bg-gray-50 dark:bg-surface-elevated">
                        <td colSpan={colSpan} className="px-6 py-4 border-t border-gray-200 dark:border-surface-border">
                          <div className="rounded-lg border border-gray-200 dark:border-surface-border bg-white dark:bg-surface-card p-4">
                            <div className="text-xs font-semibold text-gray-600 dark:text-theme-secondary uppercase tracking-wide mb-3">
                              {row.payoutSource === 'actual'
                                ? `Completed auction payouts — ${row.label}`
                                : `Booked auction winners — ${row.label}`}
                            </div>
                            {hasBookings ? (
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="text-left text-xs text-gray-500 dark:text-theme-muted">
                                      <th className="pb-2 pr-4 font-medium">Chit Fund</th>
                                      <th className="pb-2 pr-4 font-medium">Member</th>
                                      <th className="pb-2 pr-4 font-medium">Fund Month</th>
                                      <th className="pb-2 font-medium text-right">Payout</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-gray-200 dark:divide-surface-border">
                                    {row.bookedMembers!.map((b, i) => (
                                      <tr key={`${b.fundId}-${b.memberName}-${i}`}>
                                        <td className="py-2 pr-4 text-gray-900 dark:text-theme-primary">
                                          {b.fundName}
                                        </td>
                                        <td className="py-2 pr-4 font-medium text-blue-600 dark:text-blue-400">
                                          {b.memberName}
                                        </td>
                                        <td className="py-2 pr-4 text-gray-600 dark:text-theme-muted">
                                          Month {b.fundMonth}
                                        </td>
                                        <td className="py-2 text-right text-red-600 dark:text-red-400">
                                          {formatCurrency(b.payoutAmount)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            ) : (
                              <p className="text-sm text-gray-500 dark:text-theme-muted italic">
                                {row.payoutSource === 'actual'
                                  ? 'No completed auction payouts this month.'
                                  : 'No members booked for this month.'}
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!loading && projection.length === 0 && !error && (
        <p className="text-center text-gray-500 py-12">
          No active chit funds found. Projection requires at least one active chit fund.
        </p>
      )}
    </div>
  );
}
