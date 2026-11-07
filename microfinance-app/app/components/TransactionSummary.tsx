'use client';

/**
 * Totals by partner for the current filters (GET /api/transactions/summary): each partner's
 * repayments, contributions, recorded amounts, disbursements, document charges, auction
 * payouts, transfers and total, with a total row. Scrolls sideways on narrow screens with
 * the partner column pinned.
 */
import * as React from 'react';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/kit/error-state';
import { Money } from '@/components/kit/money';
import { SectionCard } from '@/components/kit/section-card';
import { describePeriod } from '@/components/kit/period-picker';
import { useTransactionSummary } from '@/lib/query/transactions';
import type { QueryParams } from '@/lib/query/keys';

const COLUMNS = [
  { key: 'loanRepayments', total: 'totalLoanRepayment', label: 'Loan repayments', tone: 'plain' },
  { key: 'chitContributions', total: 'totalChitContributions', label: 'Chit contributions', tone: 'plain' },
  { key: 'recordedAmounts', total: 'totalRecordedAmount', label: 'Recorded amounts', tone: 'auto' },
  { key: 'loanDisbursements', total: 'totalLoanDisbursement', label: 'Loan disbursements', tone: 'plain' },
  { key: 'documentCharges', total: 'totalDocumentCharges', label: 'Document charges', tone: 'plain' },
  { key: 'auctionPayouts', total: 'totalAuctionPayouts', label: 'Auction payouts', tone: 'plain' },
  { key: 'partnerTransfers', total: 'totalPartnerTransfers', label: 'Partner transfers', tone: 'plain' },
  { key: 'partnerTotalAmount', total: 'totalAmount', label: 'Total amount', tone: 'auto' },
] as const;

export default function TransactionSummary({ params, partnerLabel }: { params: QueryParams | null; partnerLabel?: string | null }) {
  const query = useTransactionSummary(params);
  const data = query.data;
  const from = (params?.startDate as string | undefined) ?? null;
  const to = (params?.endDate as string | undefined) ?? null;
  const refreshing = !!data && query.isLoading;

  return (
    <SectionCard
      title="Summary by partner"
      description={
        data ? (
          <span className="tabular-nums">
            {describePeriod(from, to)} · {data.totalTransactions} transactions{partnerLabel ? ` · ${partnerLabel}` : ''}
          </span>
        ) : (
          'Totals for the current filters'
        )
      }
      flush
      footer={
        <p className="text-xs text-muted-foreground">
          Balances are calculated from transaction records. Total amount = (repayments + document charges + contributions + net recorded) − (disbursements + auction payouts).
        </p>
      }
    >
      {!data ? (
        query.error ? (
          <ErrorState compact title="Failed to load transaction summary" error={query.error} onRetry={() => void query.mutate()} />
        ) : (
          <div className="space-y-2 p-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        )
      ) : (
        <div className={cn('overflow-x-auto transition-opacity', refreshing && 'opacity-60')} aria-busy={refreshing || undefined}>
          <table className="w-full min-w-[60rem] text-sm">
            <thead className="bg-muted/60 text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="sticky left-0 z-10 bg-muted px-4 py-2.5 text-left font-medium">Partner</th>
                {COLUMNS.map((c) => (
                  <th key={c.key} scope="col" className="px-3 py-2.5 text-right font-medium">{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.partnerBreakdown.map((partner, index) => (
                <tr key={`${partner.partnerName}-${index}`} className="border-t">
                  <th scope="row" className="sticky left-0 z-10 whitespace-nowrap bg-card px-4 py-2.5 text-left font-medium text-foreground">{partner.partnerName}</th>
                  {COLUMNS.map((c) => (
                    <td key={c.key} className="px-3 py-2.5 text-right">
                      <Money value={partner[c.key] || 0} tone={c.tone} />
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t-2 bg-muted/40 font-semibold">
                <th scope="row" className="sticky left-0 z-10 bg-muted px-4 py-2.5 text-left text-foreground">Total</th>
                {COLUMNS.map((c) => (
                  <td key={c.key} className="px-3 py-2.5 text-right">
                    <Money value={(data as unknown as Record<string, number>)[c.total] ?? 0} tone={c.tone} />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </SectionCard>
  );
}
