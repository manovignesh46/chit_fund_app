'use client';

import * as React from 'react';
import { formatMoney, formatMoneyCompact } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartCard } from '@/components/kit/chart-card';
import { ErrorState } from '@/components/kit/error-state';
import { useAggregationMonths } from '@/lib/query/transactions';
import { BarRows } from './dashboard/bar-rows';

/** Loan EMIs and chit contributions collected per month (last 6 months). */
export default function MonthlyFlowCard() {
  const query = useAggregationMonths(6);
  const months = (query.data?.months ?? []).map((m) => ({
    label: m.label,
    loanInflow: m.actualLoanRepayment ?? 0,
    chitInflow: m.actualChitContribution ?? 0,
    totalInflow: m.totalActualAmount ?? 0,
  }));
  const max = Math.max(...months.map((d) => d.totalInflow), 1);
  const totalLoan = months.reduce((s, d) => s + d.loanInflow, 0);
  const totalChit = months.reduce((s, d) => s + d.chitInflow, 0);
  const grand = totalLoan + totalChit;

  return (
    <ChartCard
      title="Monthly Inflow Trend"
      description="Cash collections: loan repayments include principal; chit contributions are member funds."
      actions={<span className="text-xs text-muted-foreground">Last 6 months</span>}
      legend={[
        { label: 'Loan EMIs', slot: 1 },
        { label: 'Chit contributions', slot: 2 },
      ]}
      height={230}
      tableNote={
        grand > 0 ? (
          <span className="tabular-nums">
            Loans {((totalLoan / grand) * 100).toFixed(0)}% · Chit {((totalChit / grand) * 100).toFixed(0)}% of the 6-month inflow
          </span>
        ) : undefined
      }
    >
      {query.data === undefined ? (
        query.error ? (
          <ErrorState compact title="Couldn't load the inflow trend" error={query.error} onRetry={() => void query.mutate()} />
        ) : (
          <div className="space-y-3 pt-1">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        )
      ) : (
        <BarRows
          max={max}
          rows={months.map((m, i) => ({
            key: `${i}-${m.label}`,
            label: m.label,
            current: i === months.length - 1,
            segments: [
              { value: m.loanInflow, slot: 1 },
              { value: m.chitInflow, slot: 2 },
            ],
            valueText: m.totalInflow > 0 ? formatMoneyCompact(m.totalInflow) : '—',
            details: m.totalInflow > 0
              ? [`Loan EMIs: ${formatMoney(m.loanInflow)}`, `Chit contributions: ${formatMoney(m.chitInflow)}`, `Total: ${formatMoney(m.totalInflow)}`]
              : [],
          }))}
        />
      )}
    </ChartCard>
  );
}
