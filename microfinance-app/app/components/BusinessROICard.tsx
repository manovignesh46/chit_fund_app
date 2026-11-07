'use client';

// Relative imports only: tests/trends-calculations.js renders this card with ts-node (no `@/` paths).
import { formatMoney } from '../../lib/format';

interface BusinessROICardProps { loanProfit: number; investedAmount: number; }

/** Loan income ÷ net recorded owner capital (all-time). Unavailable without positive capital. */
export default function BusinessROICard({ loanProfit, investedAmount }: BusinessROICardProps) {
  const roi = investedAmount > 0 ? `${((loanProfit / investedAmount) * 100).toFixed(1)}%` : '—';
  return (
    <section className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm sm:p-6">
      <div className="mb-3 flex justify-between gap-3">
        <h3 className="text-base font-semibold text-foreground">Loan Return on Owner Capital</h3>
        <span className="text-xs text-muted-foreground">All-time</span>
      </div>
      <p className={`text-3xl font-semibold tabular-nums ${loanProfit < 0 ? 'text-destructive-text' : 'text-foreground'}`}>{roi}</p>
      <p className="mt-3 text-sm text-muted-foreground">Interest and document charges ÷ net recorded owner capital.</p>
      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Loan income</dt>
          <dd className="font-medium tabular-nums text-foreground">{formatMoney(loanProfit)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Net owner capital</dt>
          <dd className="font-medium tabular-nums text-foreground">{formatMoney(investedAmount)}</dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-muted-foreground">
        Chit commission is excluded. This is a cumulative ratio, not an annual return.
        {investedAmount <= 0 && ' Return is unavailable without positive recorded capital.'}
      </p>
    </section>
  );
}
