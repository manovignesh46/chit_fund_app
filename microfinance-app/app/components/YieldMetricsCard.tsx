// @ts-nocheck
'use client';

import React, { useState } from 'react';

interface YieldMetricsCardProps {
  totalProfit: number;
  loanProfit: number;
  chitFundProfit: number;
  investedAmount: number;
  loanDisbursed: number;   // total principal ever given out
  loanOutstanding: number;
  totalCashInflow: number;
}

interface MetricRowProps {
  label: string;
  value: string;
  sub: string;
  color: string;
  tooltip: string;
}

function MetricRow({ label, value, sub, color, tooltip }: MetricRowProps) {
  const [show, setShow] = useState(false);
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-gray-100 dark:border-surface-border last:border-0">
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-sm text-gray-600 dark:text-gray-300 truncate">{label}</span>
        <button
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 shrink-0 relative"
          onMouseEnter={() => setShow(true)}
          onMouseLeave={() => setShow(false)}
          aria-label="info"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {show && (
            <div className="absolute left-5 bottom-0 z-20 w-52 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg px-3 py-2 shadow-xl pointer-events-none">
              {tooltip}
            </div>
          )}
        </button>
      </div>
      <div className="text-right shrink-0 ml-4">
        <span className={`text-base font-bold ${color}`}>{value}</span>
        <p className="text-xs text-gray-400">{sub}</p>
      </div>
    </div>
  );
}

export default function YieldMetricsCard({
  totalProfit,
  loanProfit,
  chitFundProfit,
  investedAmount,
  loanDisbursed,
  loanOutstanding,
  totalCashInflow,
}: YieldMetricsCardProps) {
  const pct = (num: number, den: number) =>
    den > 0 ? ((num / den) * 100).toFixed(1) + '%' : '—';

  const fmtCur = (n: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(n);

  // Overall ROI: total profit / net invested capital
  const roi = pct(totalProfit, investedAmount);

  // Profit margin: profit per ₹100 collected
  const profitMargin = pct(totalProfit, totalCashInflow);

  // Loan yield: profit on total principal ever disbursed
  const loanYield = pct(loanProfit, loanDisbursed);

  // Loan yield on outstanding: how much profit the active book is generating
  const activeBookYield = pct(loanProfit, loanOutstanding);

  // Profit split
  const loanSplit = totalProfit > 0 ? ((loanProfit / totalProfit) * 100).toFixed(0) : '0';
  const chitSplit = totalProfit > 0 ? ((chitFundProfit / totalProfit) * 100).toFixed(0) : '0';

  return (
    <div className="dark-card p-4 sm:p-6">
      <div className="flex items-start justify-between mb-1">
        <h2 className="card-title">Returns Overview</h2>
        <span className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">All-time</span>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
        Loan-based yield metrics. Chit fund commission tracked separately — no capital deployed.
      </p>

      <div>
        <MetricRow
          label="Overall ROI"
          value={roi}
          sub={`${fmtCur(totalProfit)} profit on ${fmtCur(investedAmount)} invested`}
          color="text-green-600 dark:text-green-400"
          tooltip="Total profit (loans + chit commissions) ÷ net capital invested. Chit commission is included even though no capital is deployed for it."
        />
        <MetricRow
          label="Loan Yield on Disbursed"
          value={loanYield}
          sub={`${fmtCur(loanProfit)} earned on ${fmtCur(loanDisbursed)} given`}
          color="text-blue-600 dark:text-blue-400"
          tooltip="Loan interest + document charges ÷ total principal ever disbursed. The flat return on every rupee lent out."
        />
        <MetricRow
          label="Active Book Yield"
          value={activeBookYield}
          sub="profit on currently outstanding loans"
          color="text-purple-600 dark:text-purple-400"
          tooltip="Loan profit ÷ current outstanding principal. Shows return on capital still at risk."
        />
        <MetricRow
          label="Profit Margin"
          value={profitMargin}
          sub="per ₹100 of total inflow"
          color="text-green-600 dark:text-green-400"
          tooltip="Net profit ÷ total cash inflow (EMIs + contributions). How much of every rupee collected is pure profit."
        />
      </div>

      {/* Profit source split */}
      {totalProfit > 0 && (
        <div className="mt-4 pt-3 border-t border-gray-200 dark:border-surface-border">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Profit source</p>
          <div className="flex h-3 rounded overflow-hidden">
            <div className="bg-green-500 h-full" style={{ width: `${loanSplit}%` }} title={`Loans ${loanSplit}%`} />
            <div className="bg-blue-400 h-full" style={{ width: `${chitSplit}%` }} title={`Chit ${chitSplit}%`} />
          </div>
          <div className="flex justify-between text-xs mt-1.5 text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-sm inline-block" />
              Loan interest {loanSplit}%
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 bg-blue-400 rounded-sm inline-block" />
              Chit commission {chitSplit}%
            </span>
          </div>
        </div>
      )}

      {/* IRR/XIRR note */}
      <div className="mt-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
        <p className="text-xs text-amber-700 dark:text-amber-400">
          <span className="font-semibold">IRR / XIRR</span> — requires per-transaction dates.
          Use Excel export → <code className="font-mono">=XIRR(cashflows, dates)</code> for true time-weighted returns.
        </p>
      </div>
    </div>
  );
}
