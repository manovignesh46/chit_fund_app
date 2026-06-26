// @ts-nocheck
'use client';

import React from 'react';

interface LoanProfitCardProps {
  loanDisbursed: number;    // total principal given out (all-time)
  repaymentInflow: number;  // total EMIs collected back
  loanOutstanding: number;  // still pending recovery
  loanProfit: number;       // interest + document charges earned
}

export default function LoanProfitCard({
  loanDisbursed,
  repaymentInflow,
  loanOutstanding,
  loanProfit,
}: LoanProfitCardProps) {
  const fmtCur = (n: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(n);

  const fmt = (n: number) => {
    if (n >= 1_00_00_000) return `₹${(n / 1_00_00_000).toFixed(2)}Cr`;
    if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(1)}L`;
    if (n >= 1_000) return `₹${(n / 1_000).toFixed(0)}K`;
    return `₹${n}`;
  };

  // Recovery rate = how much of disbursed has come back (EMIs only, not profit)
  // principal_recovered = repaymentInflow - loanProfit  (approx — repayments include profit)
  // Simpler: use loanDisbursed - loanOutstanding = recovered principal
  const principalRecovered = Math.max(loanDisbursed - loanOutstanding, 0);
  const recoveryPct = loanDisbursed > 0 ? (principalRecovered / loanDisbursed) * 100 : 0;

  // Effective yield on disbursed capital
  const yieldPct = loanDisbursed > 0 ? ((loanProfit / loanDisbursed) * 100).toFixed(1) : '—';

  const rows = [
    {
      label: 'Total Loans Given',
      value: fmtCur(loanDisbursed),
      sub: 'All-time principal disbursed',
      color: 'text-gray-800 dark:text-theme-heading',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 13l-5 5m0 0l-5-5m5 5V6" />
        </svg>
      ),
    },
    {
      label: 'Principal Recovered',
      value: fmtCur(principalRecovered),
      sub: `${recoveryPct.toFixed(0)}% of disbursed returned`,
      color: 'text-green-600 dark:text-green-400',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11l5-5m0 0l5 5m-5-5v12" />
        </svg>
      ),
    },
    {
      label: 'Still Outstanding',
      value: fmtCur(loanOutstanding),
      sub: 'Principal yet to be repaid',
      color: 'text-amber-600 dark:text-amber-400',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
    {
      label: 'Profit Earned',
      value: fmtCur(loanProfit),
      sub: `Yield: ${yieldPct}% on disbursed capital`,
      color: 'text-green-600 dark:text-green-400',
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="dark-card p-4 sm:p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="card-title">Loan Portfolio</h2>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Principal flow + profit earned</p>
        </div>
        {loanDisbursed > 0 && (
          <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
            {yieldPct}% yield
          </span>
        )}
      </div>

      <div className="space-y-3">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-gray-100 dark:bg-surface-elevated flex items-center justify-center shrink-0">
                {row.icon}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-gray-600 dark:text-gray-300 font-medium">{row.label}</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">{row.sub}</p>
              </div>
            </div>
            <span className={`text-base font-bold ml-3 shrink-0 ${row.color}`}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* Recovery progress bar */}
      {loanDisbursed > 0 && (
        <div className="mt-5 pt-4 border-t border-gray-200 dark:border-surface-border">
          <div className="flex justify-between text-xs text-gray-500 mb-1.5">
            <span>Recovery progress</span>
            <span className="font-semibold text-green-600 dark:text-green-400">{recoveryPct.toFixed(1)}%</span>
          </div>
          <div className="w-full h-2.5 bg-gray-100 dark:bg-surface-elevated rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all duration-700"
              style={{ width: `${Math.min(recoveryPct, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>{fmt(principalRecovered)} recovered</span>
            <span>{fmt(loanOutstanding)} pending</span>
          </div>
        </div>
      )}
    </div>
  );
}
