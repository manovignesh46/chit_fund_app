'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/kit/error-state';
import { Money } from '@/components/kit/money';
import { currentMonthKey, MonthPicker, monthLabel, monthRange, parseMonth } from '@/components/kit/period-picker';
import { useUrlState } from '@/lib/list/useUrlState';
import { useAggregations } from '@/lib/query/transactions';

const PendingLoansDialog = dynamic(() => import('./dashboard/pending-dialogs').then((m) => m.PendingLoansDialog), { ssr: false });
const PendingChitsDialog = dynamic(() => import('./dashboard/pending-dialogs').then((m) => m.PendingChitsDialog), { ssr: false });

function Progress({ value, label }: { value: number; label: string }) {
  return (
    <div className="pt-2">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-muted-foreground">Progress</span>
        <span className="font-medium tabular-nums text-foreground">{value.toFixed(0)}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(value, 100))}>
        <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
    </div>
  );
}

function CollectionCard({ title, expected, collected, onPending, pendingLabel }: { title: string; expected: number; collected: number; onPending?: () => void; pendingLabel: string }) {
  const pending = expected - collected;
  const progress = expected > 0 ? (collected / expected) * 100 : 0;
  return (
    <section className="rounded-xl border bg-card p-4 text-card-foreground shadow-sm sm:p-5">
      <h3 className="mb-3 text-sm font-semibold text-foreground">{title}</h3>
      <dl className="space-y-2.5 text-sm">
        <div className="flex items-center justify-between gap-2">
          <dt className="text-xs text-muted-foreground">Expected</dt>
          <dd className="font-medium"><Money value={expected} tone="plain" /></dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-xs text-muted-foreground">Collected</dt>
          <dd className="font-semibold"><Money value={collected} tone="plain" /></dd>
        </div>
        <div className="flex items-center justify-between gap-2">
          <dt className="text-xs text-muted-foreground">Pending</dt>
          <dd className="font-semibold">
            {onPending && pending !== 0 ? (
              <button
                type="button"
                onClick={onPending}
                aria-label={pendingLabel}
                className="rounded-sm text-primary-text underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Money value={pending} tone="plain" />
              </button>
            ) : (
              <Money value={pending} tone="plain" />
            )}
          </dd>
        </div>
      </dl>
      <Progress value={progress} label={`${title} progress`} />
    </section>
  );
}

/**
 * Expected vs collected for one month (the month is `?month=YYYY-MM`, default this month).
 * Pending amounts open the month's pending loans / chit members.
 */
export default function CurrentMonthCollections() {
  const url = useUrlState({ month: '' });
  const month = parseMonth(url.values.month) ? url.values.month : currentMonthKey();
  const { year, month: m } = parseMonth(month)!;
  const range = monthRange(year, m);
  const query = useAggregations(url.ready ? range.startDate : null, range.endDate);
  const data = query.data;
  const [open, setOpen] = React.useState<'loans' | 'chits' | null>(null);
  const [mounted, setMounted] = React.useState<{ loans: boolean; chits: boolean }>({ loans: false, chits: false });
  const show = (kind: 'loans' | 'chits') => {
    setMounted((prev) => ({ ...prev, [kind]: true }));
    setOpen(kind);
  };
  const label = monthLabel(year, m);
  const refreshing = !!data && query.isLoading;

  return (
    <section aria-labelledby="monthly-collections-heading" className="mb-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="monthly-collections-heading" className="text-lg font-semibold text-foreground">
          Monthly Collections
        </h2>
        <MonthPicker value={month} onChange={(next) => url.set({ month: next === currentMonthKey() ? null : next })} />
      </div>
      {!data ? (
        query.error ? (
          <ErrorState title="Failed to load collections data" error={query.error} onRetry={() => void query.mutate()} />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full rounded-xl" />
            ))}
          </div>
        )
      ) : (
        <div className={cn('grid grid-cols-1 gap-4 transition-opacity sm:grid-cols-2 md:grid-cols-3', refreshing && 'opacity-60')} aria-busy={refreshing || undefined}>
          <CollectionCard
            title="Loan Repayments"
            expected={data.expectedLoanRepayment}
            collected={data.actualLoanRepayment}
            onPending={() => show('loans')}
            pendingLabel={`Show pending loan repayments for ${label}`}
          />
          <CollectionCard
            title="Chit Contributions"
            expected={data.expectedChitContribution}
            collected={data.actualChitContribution}
            onPending={() => show('chits')}
            pendingLabel={`Show pending chit contributions for ${label}`}
          />
          <CollectionCard title="Total Collections" expected={data.totalExpectedAmount} collected={data.totalActualAmount} pendingLabel="" />
        </div>
      )}
      {mounted.loans ? <PendingLoansDialog open={open === 'loans'} onOpenChange={(o) => setOpen(o ? 'loans' : null)} range={range} monthLabel={label} /> : null}
      {mounted.chits ? <PendingChitsDialog open={open === 'chits'} onOpenChange={(o) => setOpen(o ? 'chits' : null)} range={range} monthLabel={label} /> : null}
    </section>
  );
}
