'use client';

import * as React from 'react';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/kit/error-state';
import { Money } from '@/components/kit/money';
import { currentMonthKey, monthRange, parseMonth } from '@/components/kit/period-picker';
import { useAggregations } from '@/lib/query/transactions';

/**
 * This month's collection rate for loans or chit funds: expected vs collected, as a ring.
 * Both cards share one request (same key).
 */
export default function CollectionHealthCard({ business }: { business: 'loan' | 'chit' }) {
  const title = business === 'loan' ? 'Loan Collections' : 'Chit Fund Collections';
  const { year, month } = parseMonth(currentMonthKey())!;
  const range = monthRange(year, month);
  const query = useAggregations(range.startDate, range.endDate);
  const data = query.data;

  if (!data) {
    return (
      <section className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm sm:p-6">
        <h2 className="mb-4 text-center text-base font-semibold text-foreground">{title}</h2>
        {query.error ? (
          <ErrorState compact title="Failed to load collection data" error={query.error} onRetry={() => void query.mutate()} />
        ) : (
          <div className="flex flex-col items-center gap-4">
            <Skeleton className="h-48 w-48 rounded-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        )}
      </section>
    );
  }

  const expected = business === 'loan' ? data.expectedLoanRepayment ?? 0 : data.expectedChitContribution ?? 0;
  const collected = business === 'loan' ? data.actualLoanRepayment ?? 0 : data.actualChitContribution ?? 0;
  const rate = expected === 0 ? 0 : (collected / expected) * 100;
  const tone = rate < 50 ? 'destructive' : rate <= 80 ? 'warning' : 'success';
  const stroke = `hsl(var(--${tone === 'warning' ? 'warning' : tone === 'success' ? 'success' : 'destructive'}))`;
  const text = tone === 'destructive' ? 'text-destructive-text' : tone === 'warning' ? 'text-warning-text' : 'text-success-text';
  const status =
    expected === 0
      ? { label: 'No collections scheduled', Icon: Clock }
      : rate < 50
        ? { label: 'Needs attention', Icon: AlertTriangle }
        : rate <= 80
          ? { label: 'Fair progress', Icon: Clock }
          : { label: 'Excellent performance', Icon: CheckCircle2 };

  const size = 200;
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(Math.max(rate, 0), 100) / 100) * circumference;

  return (
    <section className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm sm:p-6" aria-busy={query.isValidating || undefined}>
      <h2 className="mb-4 text-center text-base font-semibold text-foreground">{title}</h2>
      <div className="mb-4 flex justify-center">
        <div className="relative inline-flex items-center justify-center">
          <svg width={size} height={size} className="max-w-full -rotate-90" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
            <circle cx={size / 2} cy={size / 2} r={radius} stroke="hsl(var(--border))" strokeWidth={strokeWidth} fill="none" />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              stroke={stroke}
              strokeWidth={strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="transition-all duration-700 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={cn('text-4xl font-semibold tabular-nums', expected > 0 ? text : 'text-muted-foreground')}>
              {expected > 0 ? `${rate.toFixed(1)}%` : '—'}
            </span>
            <span className="mt-1 text-xs text-muted-foreground">collected</span>
          </div>
        </div>
      </div>
      <p className="mb-4 text-center text-sm text-muted-foreground">Current month collection status</p>
      <dl className="space-y-2 rounded-lg bg-muted p-3 text-sm">
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Expected</dt>
          <dd className="font-medium"><Money value={expected} tone="plain" /></dd>
        </div>
        <div className="flex items-center justify-between">
          <dt className="text-muted-foreground">Collected</dt>
          <dd className="font-medium"><Money value={collected} tone="plain" /></dd>
        </div>
        <div className="flex items-center justify-between border-t pt-2">
          <dt className="text-muted-foreground">Pending</dt>
          <dd className="font-medium"><Money value={Math.max(0, expected - collected)} tone="plain" /></dd>
        </div>
      </dl>
      <p className={cn('mt-4 flex items-center justify-center gap-1.5 text-xs font-medium', expected > 0 ? text : 'text-muted-foreground')}>
        <status.Icon aria-hidden="true" className="h-3.5 w-3.5" />
        {status.label}
      </p>
    </section>
  );
}
