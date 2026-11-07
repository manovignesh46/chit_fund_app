'use client';

// Relative imports only: tests/trends-calculations.js renders this card with ts-node (no `@/` paths).
import { formatMoney } from '../../lib/format';

interface CapitalUtilizationCardProps { loanOutstanding: number; investedAmount: number; }

/** Outstanding loan principal relative to net owner capital. */
export default function CapitalUtilizationCard({ loanOutstanding, investedAmount }: CapitalUtilizationCardProps) {
  const ratio = investedAmount > 0 ? `${(loanOutstanding / investedAmount).toFixed(2)}x` : '—';
  return (
    <section className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm sm:p-6">
      <h3 className="mb-3 text-base font-semibold text-foreground">Loan Capital Position</h3>
      <p className="text-3xl font-semibold tabular-nums text-foreground">{ratio}</p>
      <p className="mt-2 text-sm text-muted-foreground">Outstanding loan principal relative to net owner capital.</p>
      <dl className="mt-5 space-y-3 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Outstanding principal</dt>
          <dd className="font-medium tabular-nums text-foreground">{formatMoney(loanOutstanding)}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Net recorded owner capital</dt>
          <dd className="font-medium tabular-nums text-foreground">{formatMoney(investedAmount)}</dd>
        </div>
      </dl>
      <p className="mt-5 text-xs text-muted-foreground">
        Reinvested earnings can also fund loans. This comparison does not measure cash available or how often capital was lent again.
      </p>
    </section>
  );
}
