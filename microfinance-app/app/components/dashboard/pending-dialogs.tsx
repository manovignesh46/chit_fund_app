'use client';

/**
 * The month's pending loan repayments / chit contributions (dashboard Collections tab).
 * Loaded with next/dynamic when first opened. Each dialog fetches its own list when open
 * and shows loading and errors in place (no alert()).
 */
import * as React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/kit/error-state';
import { EmptyState } from '@/components/kit/empty-state';
import { Money } from '@/components/kit/money';
import { ResponsiveDialog } from '@/components/kit/responsive-dialog';
import { formatDate, formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';
import { usePendingChits, usePendingLoans, type PendingPeriod } from '@/lib/query/transactions';

export interface PendingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  range: { startDate: string; endDate: string };
  /** e.g. "November 2026" */
  monthLabel: string;
}

function PeriodChips({ periods, label }: { periods?: PendingPeriod[]; label: string }) {
  if (!periods || periods.length === 0) return null;
  return (
    <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Pending periods">
      {periods.map((p) => (
        <li
          key={p.period}
          title={`Due ${formatDate(p.dueDate)} · ${formatMoney(p.outstanding)} outstanding`}
          className={cn(
            'rounded-full border px-2 py-0.5 text-xs tabular-nums',
            p.status === 'overdue' ? 'border-destructive-border bg-destructive-subtle text-destructive-text' : 'bg-muted text-muted-foreground'
          )}
        >
          {label}
          {p.period} · {formatMoney(p.outstanding)}
        </li>
      ))}
    </ul>
  );
}

function Totals({ items }: { items: { label: string; value: React.ReactNode }[] }) {
  return (
    <dl className="mb-4 grid grid-cols-2 gap-3 rounded-lg border bg-muted/60 p-3 sm:grid-cols-3">
      {items.map((item) => (
        <div key={item.label}>
          <dt className="text-xs text-muted-foreground">{item.label}</dt>
          <dd className="text-lg font-semibold tabular-nums text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

const Loading = () => (
  <div className="space-y-3" aria-busy="true">
    <Skeleton className="h-16 w-full" />
    <Skeleton className="h-24 w-full" />
    <Skeleton className="h-24 w-full" />
  </div>
);

const duesFooter = (close: () => void) => (
  <>
    <Button variant="ghost" asChild>
      <Link href="/dues" onClick={close}>
        View all overdue dues
      </Link>
    </Button>
    <Button variant="outline" onClick={close}>
      Close
    </Button>
  </>
);

export function PendingLoansDialog({ open, onOpenChange, range, monthLabel }: PendingDialogProps) {
  const query = usePendingLoans(open ? range : null);
  const loans = query.data?.pendingLoans ?? [];
  const total = loans.reduce((sum, loan) => sum + loan.pendingAmount, 0);
  const close = () => onOpenChange(false);
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} size="lg" title={`Pending loan repayments — ${monthLabel}`} description="Installments due this month with an unpaid balance." hideDescription footer={duesFooter(close)}>
      <div className="max-h-[60vh] overflow-y-auto pr-1">
        {!query.data ? (
          query.error ? <ErrorState compact title="Failed to load pending loans" error={query.error} onRetry={() => void query.mutate()} /> : <Loading />
        ) : loans.length === 0 ? (
          <EmptyState compact title="No pending loan repayments" description="All loans are up to date for this period." />
        ) : (
          <>
            <Totals items={[{ label: 'Pending loans', value: loans.length }, { label: 'Total pending', value: <Money value={total} tone="plain" /> }]} />
            <ul className="space-y-3">
              {loans.map((loan) => (
                <li key={loan.id} className="rounded-lg border p-3 sm:p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{loan.borrowerName}</p>
                      <p className="text-xs text-muted-foreground">{loan.loanType}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Pending</p>
                      <p className="font-semibold"><Money value={loan.pendingAmount} tone="plain" /></p>
                    </div>
                  </div>
                  <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-sm">
                    <div><dt className="text-xs text-muted-foreground">Total loan amount</dt><dd><Money value={loan.totalAmount} tone="plain" /></dd></div>
                    <div><dt className="text-xs text-muted-foreground">Installment</dt><dd><Money value={loan.installmentAmount} tone="plain" /></dd></div>
                    <div><dt className="text-xs text-muted-foreground">Pending periods</dt><dd className="tabular-nums">{loan.pendingPeriods} {loan.repaymentType === 'Weekly' ? 'weeks' : 'months'}</dd></div>
                    <div><dt className="text-xs text-muted-foreground">Repayment type</dt><dd>{loan.repaymentType}</dd></div>
                  </dl>
                  <PeriodChips periods={loan.periods} label={loan.repaymentType === 'Weekly' ? 'W' : '#'} />
                  <div className="mt-3 flex items-center justify-between gap-2">
                    {loan.maxDaysOverdue ? <span className="text-xs font-medium text-destructive-text">{loan.maxDaysOverdue} days overdue</span> : <span />}
                    <Button size="sm" asChild>
                      <Link href={`/loans/${loan.id}/repayments/new`} onClick={close}>Record payment</Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </ResponsiveDialog>
  );
}

export function PendingChitsDialog({ open, onOpenChange, range, monthLabel }: PendingDialogProps) {
  const query = usePendingChits(open ? range : null);
  const funds = query.data?.pendingChitFunds ?? [];
  const total = funds.reduce((sum, fund) => sum + fund.totalPendingAmount, 0);
  const members = funds.reduce((sum, fund) => sum + fund.pendingMembers.length, 0);
  const close = () => onOpenChange(false);
  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} size="lg" title={`Pending chit fund contributions — ${monthLabel}`} description="Contributions due this month with an unpaid balance." hideDescription footer={duesFooter(close)}>
      <div className="max-h-[60vh] overflow-y-auto pr-1">
        {!query.data ? (
          query.error ? <ErrorState compact title="Failed to load pending chit funds" error={query.error} onRetry={() => void query.mutate()} /> : <Loading />
        ) : funds.length === 0 ? (
          <EmptyState compact title="No pending chit fund contributions" description="All contributions are up to date for this period." />
        ) : (
          <>
            <Totals
              items={[
                { label: 'Chit funds with pending', value: funds.length },
                { label: 'Members with pending', value: members },
                { label: 'Total pending', value: <Money value={total} tone="plain" /> },
              ]}
            />
            <ul className="space-y-4">
              {funds.map((fund) => (
                <li key={fund.id} className="rounded-lg border p-3 sm:p-4">
                  <div className="mb-3 flex items-start justify-between gap-3 border-b pb-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground">{fund.name}</p>
                      <p className="text-xs text-muted-foreground">{fund.frequency} contributions</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Total <Money value={fund.totalAmount} tone="plain" /> · Installment <Money value={fund.installmentAmount} tone="plain" />
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Fund pending</p>
                      <p className="font-semibold"><Money value={fund.totalPendingAmount} tone="plain" /></p>
                    </div>
                  </div>
                  <p className="mb-2 text-sm font-medium text-foreground">Pending members ({fund.pendingMembers.length})</p>
                  <ul className="space-y-2">
                    {fund.pendingMembers.map((member, index) => (
                      <li key={`${member.memberId ?? index}-${member.memberName}`} className="rounded-md bg-muted/60 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium text-foreground">{member.memberName}</p>
                            <p className="text-xs text-muted-foreground">
                              {member.pendingPeriods} {fund.frequency === 'Weekly' ? 'weeks' : 'months'} pending
                            </p>
                          </div>
                          <p className="font-semibold"><Money value={member.pendingAmount} tone="plain" /></p>
                        </div>
                        <PeriodChips periods={member.periods} label="M" />
                        <div className="mt-2 flex items-center justify-between gap-2">
                          {member.maxDaysOverdue ? <span className="text-xs font-medium text-destructive-text">{member.maxDaysOverdue} days overdue</span> : <span />}
                          <Button size="sm" asChild>
                            <Link
                              href={`/chit-funds/${fund.id}/contributions${member.pendingMonths?.length ? `?month=${member.pendingMonths[0]}` : ''}`}
                              onClick={close}
                            >
                              Record contribution
                            </Link>
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </ResponsiveDialog>
  );
}
