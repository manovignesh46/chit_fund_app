'use client';

import * as React from 'react';
import { ArrowDownRight, ArrowUpRight, Clock, IndianRupee } from 'lucide-react';
import { formatMoneyCompact } from '@/lib/format';
import { Money } from '@/components/kit/money';

interface LoanProfitCardProps {
  loanDisbursed: number;    // total principal given out (all-time)
  repaymentInflow: number;  // total EMIs collected back
  loanOutstanding: number;  // still pending recovery
  interestIncome?: number;
  documentCharges?: number;
  loanProfit: number;       // interest + document charges earned
}

/** Loan portfolio: principal given, recovered, outstanding, and income (all-time, from the dashboard summary). */
export default function LoanProfitCard({ loanDisbursed, loanOutstanding, loanProfit, interestIncome, documentCharges }: LoanProfitCardProps) {
  // Recovered principal = disbursed − still outstanding (repayments also contain income).
  const principalRecovered = Math.max(loanDisbursed - loanOutstanding, 0);
  const recoveryPct = loanDisbursed > 0 ? (principalRecovered / loanDisbursed) * 100 : 0;
  const yieldPct = loanDisbursed > 0 ? ((loanProfit / loanDisbursed) * 100).toFixed(1) : '—';

  const rows = [
    { label: 'Total Loans Given', value: <Money value={loanDisbursed} tone="plain" />, sub: 'All-time principal disbursed', Icon: ArrowDownRight },
    { label: 'Principal Recovered', value: <Money value={principalRecovered} tone="plain" />, sub: `${recoveryPct.toFixed(0)}% of disbursed returned`, Icon: ArrowUpRight },
    { label: 'Still Outstanding', value: <Money value={loanOutstanding} tone="plain" />, sub: 'Principal yet to be repaid', Icon: Clock },
    { label: 'Loan Income', value: <Money value={loanProfit} tone="auto" />, sub: `Cumulative income / disbursed: ${yieldPct}%`, Icon: IndianRupee },
  ];

  return (
    <section className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm sm:p-6">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground">Loan Portfolio</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Principal flow, interest and document charges</p>
        </div>
        {loanDisbursed > 0 ? (
          <span className="rounded-full bg-muted px-2 py-1 text-xs font-medium tabular-nums text-muted-foreground">{yieldPct}% cumulative</span>
        ) : null}
      </div>
      <ul className="space-y-3">
        {rows.map(({ label, value, sub, Icon }) => (
          <li key={label} className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Icon aria-hidden="true" className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </div>
            </div>
            <span className="shrink-0 text-base font-semibold">{value}</span>
          </li>
        ))}
      </ul>
      <dl className="mt-4 space-y-2 border-t pt-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Interest income</dt>
          <dd className="font-medium">{interestIncome === undefined ? '—' : <Money value={interestIncome} tone="plain" />}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Document charges</dt>
          <dd className="font-medium">{documentCharges === undefined ? '—' : <Money value={documentCharges} tone="plain" />}</dd>
        </div>
      </dl>
      {loanDisbursed > 0 ? (
        <div className="mt-5 border-t pt-4">
          <div className="mb-1.5 flex justify-between text-xs text-muted-foreground">
            <span>Recovery progress</span>
            <span className="font-medium tabular-nums text-foreground">{recoveryPct.toFixed(1)}%</span>
          </div>
          <div
            className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label="Recovery progress"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(Math.min(recoveryPct, 100))}
          >
            <div className="h-full rounded-full bg-primary transition-all duration-700" style={{ width: `${Math.min(recoveryPct, 100)}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-xs tabular-nums text-muted-foreground">
            <span>{formatMoneyCompact(principalRecovered)} recovered</span>
            <span>{formatMoneyCompact(loanOutstanding)} pending</span>
          </div>
        </div>
      ) : null}
    </section>
  );
}
