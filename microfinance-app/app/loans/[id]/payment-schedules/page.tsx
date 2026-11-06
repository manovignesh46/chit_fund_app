'use client';

/**
 * A loan's payment schedule (the same rows as the detail page's Schedule tab), with a
 * status filter in the URL (?status=). The whole schedule is one response, so the
 * filter runs on the client.
 */
import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { Info } from 'lucide-react';

import { ScheduleTable, scheduleState, useQuickPay, useRecordPayment, withPending } from '@/app/components/loans/payments';
import { useListParams } from '@/lib/list/useListParams';
import { ALL } from '@/lib/list/types';
import { useLoan, useLoanSchedules } from '@/lib/query/loans';
import { ApiError } from '@/lib/query/fetcher';
import { Button } from '@/components/ui/button';
import { useBreadcrumbLabel } from '@/components/kit/app-shell/breadcrumb-labels';
import { EmptyState } from '@/components/kit/empty-state';
import { ErrorState } from '@/components/kit/error-state';
import { FilterChips } from '@/components/kit/filter-chips';
import { ListToolbar } from '@/components/kit/list-toolbar';
import { Money } from '@/components/kit/money';
import { NativeSelect } from '@/components/kit/native-select';
import { PageContainer } from '@/components/kit/page-container';
import { PageHeader } from '@/components/kit/page-header';
import { StatCard } from '@/components/kit/stat-card';

const STATUS_OPTIONS = [
  { value: ALL, label: 'All' },
  { value: 'Pending', label: 'Pending' },
  { value: 'Paid', label: 'Paid' },
  { value: 'Overdue', label: 'Overdue' },
  { value: 'Interest Only', label: 'Interest Only' },
];

export default function PaymentSchedulesPage() {
  return (
    <PageContainer>
      <PaymentSchedules />
    </PageContainer>
  );
}

function PaymentSchedules() {
  const params = useParams<{ id: string }>();
  const id = parseInt(params.id, 10) || 0;
  const loanQuery = useLoan(id || null);
  const loan = loanQuery.data;
  useBreadcrumbLabel(id ? `/loans/${id}` : null, loan?.borrower?.name);

  const list = useListParams<'status'>({ id: 'loan-schedules', filters: ['status'] as const, defaults: { status: ALL } });
  const schedulesQuery = useLoanSchedules(id || null, false, list.ready);
  const payment = useRecordPayment(loan);
  const quickPay = useQuickPay(loan, payment.record);
  const status = list.params.status ?? ALL;

  const rows = React.useMemo(() => {
    const all = withPending(schedulesQuery.schedules, payment.pending);
    if (status === ALL || !loan) return all;
    return all.filter((s) => s.saving || scheduleState(s, loan).label === status);
  }, [schedulesQuery.schedules, payment.pending, status, loan]);

  if (!loan && loanQuery.error) {
    const code = loanQuery.error instanceof ApiError ? loanQuery.error.status : 0;
    return code === 404 || code === 403 ? (
      <EmptyState
        title="Loan not found"
        action={
          <Button size="sm" variant="outline" asChild>
            <Link href="/loans">Return to loans</Link>
          </Button>
        }
      />
    ) : (
      <ErrorState title="Failed to load payment schedules" error={loanQuery.error} onRetry={() => void loanQuery.mutate()} />
    );
  }

  return (
    <div>
      <PageHeader title="Payment schedule" description={loan?.borrower?.name} />

      <div className="mb-6 flex gap-3 rounded-xl border border-info-border bg-info-subtle p-4 text-sm text-info-text">
        <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <p>The payment schedule shows all past due dates (including missed payments), the next payment when it is due within 3 days, and any payments that have been made.</p>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatCard label="Borrower" value={<span className="text-lg">{loan?.borrower?.name || 'Unknown'}</span>} loading={!loan} />
        <StatCard label="Total amount" value={<Money value={loan?.amount} tone="plain" />} loading={!loan} />
        <StatCard label="Remaining balance" value={<Money value={loan?.remainingAmount} tone="plain" />} loading={!loan || payment.saving} />
      </div>

      <ListToolbar
        primaryFilter={
          <NativeSelect aria-label="Status" className="w-44" value={status} onValueChange={(value) => list.setParams({ status: value })} options={STATUS_OPTIONS} />
        }
        chips={
          <FilterChips
            chips={status !== ALL ? [{ key: 'status', label: `Status: ${status}`, onRemove: () => list.setParams({ status: null }) }] : []}
            onClearAll={list.clearFilters}
          />
        }
        resultSummary={schedulesQuery.data !== undefined ? `${rows.length} ${rows.length === 1 ? 'period' : 'periods'}` : null}
      />

      {loan ? (
        <ScheduleTable
          loan={loan}
          rows={rows}
          isInitialLoading={schedulesQuery.data === undefined && !schedulesQuery.error}
          isRefreshing={schedulesQuery.data !== undefined && schedulesQuery.isLoading}
          error={schedulesQuery.error}
          onRetry={() => void schedulesQuery.mutate()}
          actionsDisabled={payment.saving || schedulesQuery.isValidating}
          onQuickPay={quickPay}
          emptyState={
            status !== ALL ? (
              <EmptyState variant="no-results" onClearFilters={list.clearFilters} />
            ) : (
              <EmptyState
                title="No payment schedules found for this loan."
                description="Schedules are generated from the disbursement date and repayment history: past due dates (including missed payments), the next due date within 3 days, and payments that have been made."
              />
            )
          }
        />
      ) : null}
    </div>
  );
}
