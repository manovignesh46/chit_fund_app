// @ts-nocheck
'use client';

import React, { useEffect, useState } from 'react';

interface MonthlyData {
  label: string;
  loanInflow: number;
  chitInflow: number;
  totalInflow: number;
}

export default function MonthlyFlowCard() {
  const [data, setData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTooltip, setActiveTooltip] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/transactions/aggregations?months=6')
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        setData(
          (res?.months ?? []).map((m: any) => ({
            label: m.label,
            loanInflow: m.actualLoanRepayment ?? 0,
            chitInflow: m.actualChitContribution ?? 0,
            totalInflow: m.totalActualAmount ?? 0,
          }))
        );
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const fmt = (n: number) => {
    if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
    if (n >= 1_000) return `₹${(n / 1_000).toFixed(0)}K`;
    return `₹${n}`;
  };

  const fmtFull = (n: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(n);

  if (loading) {
    return (
      <div className="dark-card p-4 sm:p-6 animate-pulse">
        <div className="h-5 bg-gray-200 dark:bg-surface-elevated rounded w-1/3 mb-1" />
        <div className="h-3 bg-gray-100 dark:bg-surface-elevated rounded w-1/2 mb-5" />
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

  const maxValue = Math.max(...data.map((d) => d.totalInflow), 1);
  const totalLoanInflow = data.reduce((s, d) => s + d.loanInflow, 0);
  const totalChitInflow = data.reduce((s, d) => s + d.chitInflow, 0);
  const grandTotal = totalLoanInflow + totalChitInflow;

  return (
    <div className="dark-card p-4 sm:p-6">
      <div className="flex items-start justify-between mb-1">
        <h2 className="card-title">Monthly Inflow Trend</h2>
        <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Last 6 months</span>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">
        Loan EMIs collected + Chit fund contributions received
      </p>

      {/* Bars */}
      <div className="space-y-3">
        {data.map((month, i) => {
          const loanPct = maxValue ? (month.loanInflow / maxValue) * 100 : 0;
          const chitPct = maxValue ? (month.chitInflow / maxValue) * 100 : 0;
          const isCurrentMonth = i === data.length - 1;

          return (
            <div
              key={i}
              className="relative"
              onMouseEnter={() => setActiveTooltip(i)}
              onMouseLeave={() => setActiveTooltip(null)}
            >
              <div className="flex items-center gap-3">
                <span
                  className={`text-xs w-16 shrink-0 text-right ${
                    isCurrentMonth
                      ? 'text-green-600 dark:text-green-400 font-semibold'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {month.label}
                </span>

                {/* Stacked bar */}
                <div className="flex-1 h-5 bg-gray-100 dark:bg-surface-elevated rounded overflow-hidden flex">
                  <div
                    className="h-full bg-green-500 dark:bg-green-600 transition-all duration-700 ease-out"
                    style={{ width: `${loanPct}%` }}
                  />
                  <div
                    className="h-full bg-blue-400 dark:bg-blue-500 transition-all duration-700 ease-out"
                    style={{ width: `${chitPct}%` }}
                  />
                </div>

                <span
                  className={`text-xs w-14 shrink-0 font-medium ${
                    month.totalInflow > 0
                      ? 'text-gray-700 dark:text-gray-200'
                      : 'text-gray-400 dark:text-gray-500'
                  }`}
                >
                  {month.totalInflow > 0 ? fmt(month.totalInflow) : '—'}
                </span>
              </div>

              {/* Tooltip */}
              {activeTooltip === i && month.totalInflow > 0 && (
                <div className="absolute left-20 top-6 z-10 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-lg pointer-events-none whitespace-nowrap">
                  <p className="font-semibold mb-1">{month.label}</p>
                  <p className="text-green-400">Loan EMIs: {fmtFull(month.loanInflow)}</p>
                  <p className="text-blue-300">Chit contributions: {fmtFull(month.chitInflow)}</p>
                  <p className="text-gray-300 border-t border-gray-600 mt-1 pt-1">
                    Total: {fmtFull(month.totalInflow)}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend + summary */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-5 pt-4 border-t border-gray-200 dark:border-surface-border">
        <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-green-500 rounded-sm shrink-0" />
            Loan EMIs
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 bg-blue-400 rounded-sm shrink-0" />
            Chit Contributions
          </span>
        </div>
        {grandTotal > 0 && (
          <div className="flex gap-3 text-xs">
            <span className="text-green-600 dark:text-green-400 font-medium">
              Loans {((totalLoanInflow / grandTotal) * 100).toFixed(0)}%
            </span>
            <span className="text-blue-500 dark:text-blue-400 font-medium">
              Chit {((totalChitInflow / grandTotal) * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
