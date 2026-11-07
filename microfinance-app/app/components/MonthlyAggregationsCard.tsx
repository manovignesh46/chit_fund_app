'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Money } from '@/components/kit/money';
import { useAggregations } from '@/lib/query/transactions';

interface Props {
  startDate?: string | null;
  endDate?: string | null;
}

/** Expected vs actual collections for the selected period (shown only when both dates are set). */
export default function MonthlyAggregationsCard({ startDate, endDate }: Props) {
  const query = useAggregations(startDate || null, endDate || null);
  if (!startDate || !endDate) return null;
  const data = query.data;
  const groups = data
    ? [
        { title: 'Loan Repayments', expected: data.expectedLoanRepayment, actual: data.actualLoanRepayment },
        { title: 'Chit Fund Contributions', expected: data.expectedChitContribution, actual: data.actualChitContribution },
        { title: 'Total Collections', expected: data.totalExpectedAmount, actual: data.totalActualAmount },
      ]
    : null;
  return (
    <section aria-label="Collections for the period" className={cn('grid grid-cols-1 gap-3 md:grid-cols-3', data && query.isLoading && 'opacity-60')}>
      {groups
        ? groups.map((g) => (
            <div key={g.title} className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm">
              <h3 className="mb-2 text-sm font-medium text-muted-foreground">{g.title}</h3>
              <dl className="space-y-1.5 text-sm">
                <div className="flex items-center justify-between">
                  <dt className="text-xs text-muted-foreground">Expected</dt>
                  <dd className="font-medium"><Money value={g.expected} tone="plain" /></dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-xs text-muted-foreground">Actual</dt>
                  <dd className="font-semibold"><Money value={g.actual} tone="plain" /></dd>
                </div>
              </dl>
            </div>
          ))
        : [1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
    </section>
  );
}
