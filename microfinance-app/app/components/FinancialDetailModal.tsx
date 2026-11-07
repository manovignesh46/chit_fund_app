'use client';

/**
 * One period's breakdown on the trends page (row click). Loaded with next/dynamic.
 * Figures are the server's (financial-data periodsData); nothing is computed here.
 */
import * as React from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Money } from '@/components/kit/money';
import { ResponsiveDialog } from '@/components/kit/responsive-dialog';
import { formatDate } from '@/lib/format';
import { dashboardAPI } from '@/lib/api';
import { toast } from '@/lib/toast';
import type { FinancialPeriod } from '@/lib/query/dashboard';

interface FinancialDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  periodData: FinancialPeriod | null;
}

function Group({ title, rows }: { title: string; rows: { label: string; value: React.ReactNode; sub?: boolean; total?: boolean }[] }) {
  return (
    <section className="rounded-lg border p-3 sm:p-4">
      <h3 className="mb-2 text-sm font-semibold text-foreground">{title}</h3>
      <dl className="space-y-1.5 text-sm">
        {rows.map((row) => (
          <div key={row.label} className={`flex justify-between gap-3 ${row.sub ? 'pl-3 text-muted-foreground' : ''} ${row.total ? 'border-t pt-1.5 font-semibold' : ''}`}>
            <dt className={row.sub ? '' : 'text-muted-foreground'}>{row.label}</dt>
            <dd className="tabular-nums text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export default function FinancialDetailModal({ isOpen, onClose, periodData }: FinancialDetailModalProps) {
  if (!periodData) return null;
  const flow = periodData.cashFlowDetails;
  const profit = periodData.profitDetails;
  const outside = periodData.outsideAmountBreakdown;
  const counts = periodData.transactionCounts as Record<string, number | undefined> | undefined;
  const range = periodData.periodRange;
  const m = (value: number | undefined, tone: 'plain' | 'auto' = 'plain') => <Money value={value ?? 0} tone={tone} />;

  return (
    <ResponsiveDialog
      open={isOpen}
      onOpenChange={(open) => !open && onClose()}
      size="lg"
      title={`Financial details: ${periodData.period}`}
      description={range ? `${formatDate(range.startDate)} – ${formatDate(range.endDate)}` : undefined}
      footer={
        <>
          {range ? (
            <Button
              variant="outline"
              onClick={() => {
                void dashboardAPI.exportSinglePeriodData(periodData.period, range.startDate, range.endDate);
                toast('Downloading the period export');
              }}
            >
              <Download aria-hidden="true" />
              Export period
            </Button>
          ) : null}
          <Button onClick={onClose}>Close</Button>
        </>
      }
    >
      <div className="grid max-h-[60vh] grid-cols-1 gap-3 overflow-y-auto pr-1 lg:grid-cols-2">
        <Group
          title="Cash flow"
          rows={[
            { label: 'Cash inflow', value: m(periodData.cashInflow) },
            ...(flow
              ? [
                  { label: 'Chit fund contributions', value: m(flow.contributionInflow), sub: true },
                  { label: 'Loan repayments', value: m(flow.repaymentInflow), sub: true },
                ]
              : []),
            { label: 'Cash outflow', value: m(periodData.cashOutflow) },
            ...(flow
              ? [
                  { label: 'Chit fund auctions', value: m(flow.auctionOutflow), sub: true },
                  { label: 'Loan disbursements', value: m(flow.loanOutflow), sub: true },
                  { label: 'Net cash flow', value: m(flow.netCashFlow, 'auto'), total: true },
                ]
              : []),
          ]}
        />
        <Group
          title="Profit"
          rows={[
            { label: 'Total profit', value: m(periodData.profit, 'auto') },
            ...(profit
              ? [
                  { label: 'Interest payments', value: m(profit.interestPayments), sub: true },
                  { label: 'Document charges', value: m(profit.documentCharges), sub: true },
                  { label: 'Auction commissions', value: m(profit.auctionCommissions), sub: true },
                ]
              : []),
          ]}
        />
        {outside ? (
          <Group
            title="Outside amount"
            rows={[
              { label: 'Loan remaining', value: m(outside.loanRemainingAmount) },
              { label: 'Chit fund outside', value: m(outside.chitFundOutsideAmount) },
              { label: 'Total outside amount', value: m(periodData.outsideAmount), total: true },
            ]}
          />
        ) : null}
        {counts ? (
          <Group
            title="Transactions"
            rows={[
              { label: 'Contributions', value: counts.contributions ?? '—' },
              { label: 'Loan repayments', value: counts.repayments ?? '—' },
              { label: 'Auctions', value: counts.auctions ?? '—' },
              { label: 'Loan disbursements', value: counts.loans ?? '—' },
            ]}
          />
        ) : null}
      </div>
    </ResponsiveDialog>
  );
}
