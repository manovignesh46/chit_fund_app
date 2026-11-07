'use client';

import * as React from 'react';
import { formatMoney, formatMoneyCompact } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import { ChartCard } from '@/components/kit/chart-card';
import { ErrorState } from '@/components/kit/error-state';
import { Money } from '@/components/kit/money';
import { useChitCommission, type CommissionMonth } from '@/lib/query/dashboard';
import { BarRows } from './dashboard/bar-rows';

/** Commission from completed chit payouts per month (last 6), with the all-time figures. */
export default function ChitFundMonthlyProfitCard() {
  const query = useChitCommission(6);
  const months = query.data?.months ?? [];
  const summary = query.data?.summary;
  const max = Math.max(...months.map((d) => Math.abs(d.commission)), 1);
  const total = months.reduce((s, d) => s + d.commission, 0);
  const best = months.reduce((b, d) => (d.commission > (b?.commission ?? 0) ? d : b), null as CommissionMonth | null);

  if (query.error && !query.data) {
    return (
      <ChartCard title="Chit Fund Commission" height={180}>
        <ErrorState compact title="Unable to load commission" error={query.error} onRetry={() => void query.mutate()} />
      </ChartCard>
    );
  }

  return (
    <section className="rounded-xl border bg-card text-card-foreground shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 pt-4 sm:px-6 sm:pt-5">
        <div className="min-w-0 space-y-0.5">
          <h2 className="text-base font-semibold text-foreground">Chit Fund Commission</h2>
          <p className="text-sm text-muted-foreground">Commission from completed payouts, using each fund’s contribution rules.</p>
          <p className="text-xs text-muted-foreground">
            Member collections fund the rotation. Commission depends on the fixed payout amount; no chit ROI.
          </p>
        </div>
        <span className="text-xs text-muted-foreground">Last 6 months</span>
      </div>
      <div className="px-4 pt-4 sm:px-6">
        {query.data === undefined ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-5 w-full" />
            ))}
          </div>
        ) : months.every((d) => d.auctionCount === 0) ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No completed payouts in the last 6 months</p>
        ) : (
          <BarRows
            max={max}
            rows={months.map((m, i) => ({
              key: m.key,
              label: m.label,
              current: i === months.length - 1,
              segments: [{ value: m.commission, slot: 1 }],
              valueText: m.commission !== 0 ? formatMoneyCompact(m.commission) : '—',
              details: m.auctionCount > 0
                ? [`Commission: ${formatMoney(m.commission)}`, `${m.auctionCount} payout${m.auctionCount > 1 ? 's' : ''} completed`]
                : ['No payouts this month'],
            }))}
          />
        )}
      </div>
      {summary ? (
        <dl className="mx-4 mt-5 space-y-2 border-t pt-4 text-sm sm:mx-6">
          {(
            [
              ['All-time payout commission', <Money key="a" value={summary.commission} tone="plain" />],
              ['Expected remaining commission', summary.expectedRemainingCommission === null ? 'Unavailable' : <Money key="b" value={summary.expectedRemainingCommission} tone="plain" />],
              ['Member collections received', <Money key="c" value={summary.collections} tone="plain" />],
              ['Payouts completed', <Money key="d" value={summary.payouts} tone="plain" />],
              ['Collections less payouts', <Money key="e" value={summary.collectionPayoutBalance} tone="auto" />],
            ] as const
          ).map(([label, value]) => (
            <div key={label} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="font-medium text-foreground">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p className="mx-4 mt-3 text-xs text-muted-foreground sm:mx-6">
        Remaining commission is projected from recorded fixed schedules, assuming one payout per remaining fund month.
        Collections less payouts is a cash movement balance, not additional profit or cash available for loans.
      </p>
      <div className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-2 border-t py-4 sm:mx-6">
        <div>
          <p className="text-xs text-muted-foreground">6-month total commission</p>
          <p className="text-base font-semibold text-foreground">
            <Money value={total} tone="plain" />
          </p>
        </div>
        {best && best.commission > 0 ? (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Best month</p>
            <p className="text-sm font-medium text-foreground">
              {best.label} — {formatMoneyCompact(best.commission)}
            </p>
          </div>
        ) : null}
      </div>
    </section>
  );
}
