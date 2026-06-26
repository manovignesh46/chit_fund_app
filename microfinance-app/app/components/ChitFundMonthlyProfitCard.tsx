// @ts-nocheck
'use client';

import React, { useEffect, useState } from 'react';

interface MonthEntry {
  key: string;
  label: string;
  commission: number;
  auctionCount: number;
}

export default function ChitFundMonthlyProfitCard() {
  const [data, setData] = useState<MonthEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTooltip, setActiveTooltip] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/chit-funds/monthly-profit?months=6')
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        setData(res?.months ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const fmtFull = (n: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(n);

  const fmt = (n: number) => {
    if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
    if (n >= 1_000) return `₹${(n / 1_000).toFixed(0)}K`;
    return `₹${n}`;
  };

  if (loading) {
    return (
      <div className="dark-card p-4 sm:p-6 animate-pulse">
        <div className="h-5 bg-gray-200 dark:bg-surface-elevated rounded w-1/2 mb-1" />
        <div className="h-3 bg-gray-100 dark:bg-surface-elevated rounded w-2/3 mb-5" />
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="h-3 bg-gray-100 dark:bg-surface-elevated rounded w-16" />
              <div className="flex-1 h-5 bg-gray-200 dark:bg-surface-elevated rounded" />
              <div className="h-3 bg-gray-100 dark:bg-surface-elevated rounded w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...data.map((d) => d.commission), 1);
  const totalCommission = data.reduce((s, d) => s + d.commission, 0);
  const bestMonth = data.reduce(
    (best, d) => (d.commission > (best?.commission ?? 0) ? d : best),
    null as MonthEntry | null
  );

  return (
    <div className="dark-card p-4 sm:p-6">
      <div className="flex items-start justify-between mb-1">
        <h2 className="card-title">Chit Fund Commission</h2>
        <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Last 6 months</span>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">
        Per-month auction commission — (member contributions) minus (payout to winner)
      </p>
      <p className="text-xs text-amber-600 dark:text-amber-400 mb-5">
        No personal investment needed; commission comes from the auction discount
      </p>

      {data.every((d) => d.commission === 0) ? (
        <p className="text-center text-gray-400 text-sm py-6">No auction data in last 6 months</p>
      ) : (
        <div className="space-y-3">
          {data.map((month, i) => {
            const pct = maxValue ? (month.commission / maxValue) * 100 : 0;
            const isCurrentMonth = i === data.length - 1;
            const isBest = bestMonth?.key === month.key && month.commission > 0;

            return (
              <div
                key={month.key}
                className="relative"
                onMouseEnter={() => setActiveTooltip(i)}
                onMouseLeave={() => setActiveTooltip(null)}
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`text-xs w-16 shrink-0 text-right ${
                      isCurrentMonth
                        ? 'text-blue-600 dark:text-blue-400 font-semibold'
                        : 'text-gray-500 dark:text-gray-400'
                    }`}
                  >
                    {month.label}
                  </span>

                  <div className="flex-1 h-5 bg-gray-100 dark:bg-surface-elevated rounded overflow-hidden">
                    <div
                      className={`h-full transition-all duration-700 ease-out rounded ${
                        isBest ? 'bg-blue-600 dark:bg-blue-500' : 'bg-blue-400 dark:bg-blue-500/70'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>

                  <span
                    className={`text-xs w-14 shrink-0 font-medium ${
                      month.commission > 0
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {month.commission > 0 ? fmt(month.commission) : '—'}
                  </span>
                </div>

                {/* Tooltip */}
                {activeTooltip === i && (
                  <div className="absolute left-20 top-6 z-10 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none whitespace-nowrap">
                    <p className="font-semibold mb-1">{month.label}</p>
                    {month.auctionCount > 0 ? (
                      <>
                        <p className="text-blue-300">Commission: {fmtFull(month.commission)}</p>
                        <p className="text-gray-400">{month.auctionCount} auction{month.auctionCount > 1 ? 's' : ''} conducted</p>
                      </>
                    ) : (
                      <p className="text-gray-400">No auctions this month</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Summary footer */}
      <div className="mt-5 pt-4 border-t border-gray-200 dark:border-surface-border flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400">6-month total commission</p>
          <p className="text-base font-bold text-blue-600 dark:text-blue-400">{fmtFull(totalCommission)}</p>
        </div>
        {bestMonth && bestMonth.commission > 0 && (
          <div className="text-right">
            <p className="text-xs text-gray-500 dark:text-gray-400">Best month</p>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">
              {bestMonth.label} — {fmt(bestMonth.commission)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
