'use client';

// Relative imports only: tests/trends-calculations.js renders this card with ts-node (no `@/` paths).
import { formatMoney } from '../../lib/format';

interface YieldMetricsCardProps { loanProfit: number; chitFundProfit: number; investedAmount: number; }

/** Combined earnings: chit payout commission + loan interest and document charges (all-time). */
export default function YieldMetricsCard({ loanProfit, chitFundProfit, investedAmount }: YieldMetricsCardProps) {
  const totalIncome = loanProfit + chitFundProfit;
  const rows = [
    ['Chit payout commission', chitFundProfit],
    ['Loan interest + document charges', loanProfit],
    ['Net recorded owner capital', investedAmount],
  ] as const;
  return (
    <section className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm sm:p-6">
      <div className="mb-3 flex justify-between gap-3">
        <h3 className="text-base font-semibold text-foreground">Business Earnings</h3>
        <span className="text-xs text-muted-foreground">All-time</span>
      </div>
      <p className={`text-3xl font-semibold tabular-nums ${totalIncome < 0 ? 'text-destructive-text' : 'text-foreground'}`}>{formatMoney(totalIncome)}</p>
      <p className="mt-2 text-xs text-muted-foreground">Combined income before operating expenses and losses.</p>
      <dl className="mt-5 space-y-3 text-sm">
        {rows.map(([label, amount]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium tabular-nums text-foreground">{formatMoney(amount)}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 text-xs text-muted-foreground">
        Member contributions and principal recoveries are cash movements, not earnings.
        Moving chit earnings into loans creates no additional income; interest earned afterwards belongs to loans.
      </p>
    </section>
  );
}
